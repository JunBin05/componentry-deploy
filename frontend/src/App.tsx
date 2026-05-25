import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import SpecsInputView from "./components/SpecsInputView";
import SpecsProcessingView from "./components/SpecsProcessingView";
import SpecsVerifyView from "./components/SpecsVerifyView";
import SpecsPreviewView from "./components/SpecsPreviewView";
import CatalogView from "./components/CatalogView";
import SettingsView from "./components/SettingsView";
import AuthView from "./components/AuthView";

import { QuoteProposal, SupplierConfig, QuoteLineItem, QuoteStatus } from "./types";
import { supabase } from "./context/InventoryContext";

import { useInventory } from "./context/InventoryContext";
import { streamQuote } from "./services/pythonApi";
import { adaptPyQuoteToLineItems } from "./services/quoteAdapter";

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>("dashboard");

  const { inventory, refreshInventory } = useInventory();
  
  // Specs Sub-flow State Tracker
  const [specsFlowState, setSpecsFlowState] = useState<"input" | "loading" | "verify" | "preview">("input");

  // Synthetic specs current state
  const [synthProjectName, setSynthProjectName] = useState("Enterprise AI Workstation");
  const [synthTargetBudget, setSynthTargetBudget] = useState(15000);
  const [synthLineItems, setSynthLineItems] = useState<QuoteLineItem[]>([]);
  const [processingStatus, setProcessingStatus] = useState("Initializing quote engine...");
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);

  // Authenticated State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [supplierNode, setSupplierNode] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [userId, setUserId] = useState<string>("");

  // Welcome screen shown after new registration (full-page, blocks dashboard)
  const [welcomePending, setWelcomePending] = useState(false);
  const [welcomeCompany, setWelcomeCompany] = useState("");

  // Auto-dismiss welcome screen after 3 seconds
  useEffect(() => {
    if (!welcomePending) return;
    const t = setTimeout(() => setWelcomePending(false), 3000);
    return () => clearTimeout(t);
  }, [welcomePending]);

  const [quotes, setQuotes] = useState<QuoteProposal[]>([]);
  const [settings, setSettings] = useState<SupplierConfig>({
    companyName: "TechRigs Distribution Sdn Bhd",
    contactNumber: "+60 3-2142 0000",
    supportEmail: "quotes@techrigs.com.my",
    businessAddress: "Level 3, Plaza Low Yat, Bukit Bintang, 55100 Kuala Lumpur.",
    customQuotePrefix: "TRD"
  });

  // 1. Initial Database Loading on Mount
  useEffect(() => {
    async function loadInitialData() {
      // Helper: Fetch this user's settings row from Supabase
      const loadUserSettings = async (uid: string) => {
        const { data, error } = await supabase
          .from('supplier_settings')
          .select('*')
          .eq('user_id', uid)
          .single();
        if (data && !error) {
          setSettings({
            companyName: data.company_name || "TechRigs Distribution Sdn Bhd",
            contactNumber: data.contact_number || "+60 3-2142 0000",
            supportEmail: data.support_email || "quotes@techrigs.com.my",
            businessAddress: data.business_address || "Level 3, Plaza Low Yat, Bukit Bintang, 55100 Kuala Lumpur.",
            customQuotePrefix: data.custom_quote_prefix || "TRD",
          });
        }
        // If no row yet, keep defaults — saved on first settings update
      };

      // Helper: Fetch this user's quotes from Supabase
      const loadUserQuotes = async (uid: string) => {
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
        if (data && !error) {
          const mapped: QuoteProposal[] = data.map((row: any) => ({
            id: row.id,
            date: row.date,
            customer: row.customer,
            brief: row.brief,
            total: row.total,
            status: row.status,
            items: row.items || [],
            targetBudget: row.target_budget,
            project: row.project,
            contactNumber: row.contact_number,
            supportEmail: row.support_email,
            address: row.address,
            quotePrefix: row.quote_prefix,
          }));
          setQuotes(mapped);
        } else if (error) {
          console.error('Error fetching quotes:', error);
        }
      };

      // Supabase Authentication Check
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsAuthenticated(true);
        setSupplierEmail(session.user.email || "");
        setSupplierNode("Supplier Node (Supabase Authenticated)");
        setUserId(session.user.id);
        await loadUserSettings(session.user.id);
        await loadUserQuotes(session.user.id);
      }

      // Live Supabase Listener for auto-login/auto-logout
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setIsAuthenticated(true);
          setSupplierEmail(session.user.email || "");
          setSupplierNode("Supplier Node (Supabase Authenticated)");
          setUserId(session.user.id);
          await loadUserSettings(session.user.id);
          await loadUserQuotes(session.user.id);
        } else if (event === "SIGNED_OUT") {
          setIsAuthenticated(false);
          setSupplierEmail("");
          setSupplierNode("");
          setUserId("");
          setQuotes([]);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
    loadInitialData();
  }, []);

  const handleUpdateSettings = async (newConfig: SupplierConfig) => {
    setSettings(newConfig);
    if (userId) {
      const { error } = await supabase
        .from('supplier_settings')
        .upsert({
          user_id: userId,
          company_name: newConfig.companyName,
          contact_number: newConfig.contactNumber,
          support_email: newConfig.supportEmail,
          business_address: newConfig.businessAddress,
          custom_quote_prefix: newConfig.customQuotePrefix,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) {
        console.error("Failed to sync settings to Supabase:", error);
      }
    }
  };

  // 2. AI Synthesis Flow Trigger
  const handleGenerateSpecifications = async (promptText: string, budgetLimit: number) => {
    setSynthTargetBudget(budgetLimit);
    setActiveQuoteId(null);
    setSpecsFlowState("loading");
    setProcessingStatus("Connecting to Python quote engine...");

    try {
      for await (const event of streamQuote({ brief: promptText, budget: budgetLimit })) {
        if (event.message) {
          setProcessingStatus(event.message);
        }

        if (event.step === "result" && event.data) {
          setSynthProjectName("AI-Optimized Hardware Quote");
          setSynthLineItems(adaptPyQuoteToLineItems(event.data, inventory));
          setSpecsFlowState("verify");
          return;
        }

        if (event.step === "error") {
          throw new Error(event.message || "Quote generation failed.");
        }
      }
    } catch (e) {
      console.error("Error generating specifications via Python backend.", e);
      setSpecsFlowState("input");
      alert("Failed to generate quote. Check that the Python backend is running on port 8000.");
    }
  };

  // 3. User Confirmed Verify Selection -> Leads to Invoice Preview
  const handleConfirmVerification = (finalItems: QuoteLineItem[], finalProjectName: string) => {
    setSynthLineItems(finalItems);
    setSynthProjectName(finalProjectName);
    setActiveQuoteId(null);
    setSpecsFlowState("preview");
  };

  // 4. Save Quote proposal to Supabase
  const handleFinishSavingQuote = async (saveToHistory: boolean) => {
    if (saveToHistory && userId) {
      const computedTotal = synthLineItems.reduce((acc, cur) => acc + (cur.component.price * cur.quantity), 0);
      const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: userId,
          date: dateStr,
          customer: "Neural Nexus Corp",
          brief: synthProjectName,
          total: computedTotal,
          status: 'Draft',
          items: synthLineItems,
          target_budget: synthTargetBudget,
          project: synthProjectName,
          contact_number: settings.contactNumber,
          support_email: settings.supportEmail,
          address: "67 Innovation Way, Austin, TX 78701",
          quote_prefix: settings.customQuotePrefix,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to save quote to Supabase:", error);
      } else if (data) {
        const saved: QuoteProposal = {
          id: data.id,
          date: data.date,
          customer: data.customer,
          brief: data.brief,
          total: data.total,
          status: data.status,
          items: data.items || [],
          targetBudget: data.target_budget,
          project: data.project,
          contactNumber: data.contact_number,
          supportEmail: data.support_email,
          address: data.address,
          quotePrefix: data.quote_prefix,
        };
        setQuotes((prev) => [saved, ...prev]);
      }
    }

    // Reset Specs Flow
    setSpecsFlowState("input");
    setActiveQuoteId(null);
    setCurrentTab("dashboard");
  };

  const deductCatalogStockForQuote = async (items: QuoteLineItem[]) => {
    const requiredById = items.reduce<Record<string, number>>((acc, item) => {
      const id = item.component.id;
      if (!id) return acc;
      acc[id] = (acc[id] || 0) + item.quantity;
      return acc;
    }, {});
    const ids = Object.keys(requiredById);
    if (ids.length === 0) return;

    const { data, error } = await supabase
      .from("catalog")
      .select("id, part_name, stock_level")
      .in("id", ids);

    if (error) throw error;

    const rowsById = new Map((data || []).map((row: any) => [row.id, row]));
    const insufficient = ids
      .map((id) => {
        const row = rowsById.get(id);
        const currentStock = Number(row?.stock_level || 0);
        return {
          id,
          name: row?.part_name || id,
          required: requiredById[id],
          available: currentStock,
        };
      })
      .filter((row) => row.available < row.required);

    if (insufficient.length > 0) {
      throw new Error(
        "Not enough stock to confirm: " +
        insufficient.map((row) => `${row.name} needs ${row.required}, has ${row.available}`).join("; ")
      );
    }

    for (const id of ids) {
      const row = rowsById.get(id);
      const nextStock = Number(row.stock_level || 0) - requiredById[id];
      const { error: updateError } = await supabase
        .from("catalog")
        .update({ stock_level: nextStock })
        .eq("id", id);
      if (updateError) throw updateError;
    }
  };

  const handleHistoricalQuoteStatusChange = async (nextStatus: QuoteStatus) => {
    if (!activeQuoteId || !userId) return;

    const quote = quotes.find((entry) => entry.id === activeQuoteId);
    if (!quote) return;

    const previousStatus = quote.status;
    if (previousStatus === nextStatus) return;

    try {
      if (nextStatus === "Approved" && previousStatus !== "Approved") {
        await deductCatalogStockForQuote(quote.items);
      }

      const { error } = await supabase
        .from("quotes")
        .update({ status: nextStatus })
        .eq("id", activeQuoteId)
        .eq("user_id", userId);

      if (error) throw error;

      setQuotes((prev) =>
        prev.map((entry) =>
          entry.id === activeQuoteId ? { ...entry, status: nextStatus } : entry
        )
      );
      await refreshInventory();
    } catch (error) {
      console.error("Failed to update quote status:", error);
      alert(error instanceof Error ? error.message : "Failed to update quote status.");
      throw error;
    }
  };

  // 5. Auth handlers
  const handleAuthenticate = (company: string, email: string, isNewUser?: boolean) => {
    setCurrentTab("dashboard");
    if (isNewUser) {
      setWelcomeCompany(company);
      setWelcomePending(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // State clearing is handled automatically by the auth listener above
    setCurrentTab("dashboard");
  };

  // Quick view proposal in print format from billing click list
  const handleViewHistoricalQuote = (quote: QuoteProposal) => {
    setSynthProjectName(quote.project || quote.brief);
    setSynthTargetBudget(quote.targetBudget || quote.total);
    setSynthLineItems(quote.items);
    setActiveQuoteId(quote.id);
    setSpecsFlowState("preview");
    setCurrentTab("specs");
  };

  const activeQuote = activeQuoteId
    ? quotes.find((quote) => quote.id === activeQuoteId)
    : null;

  // Calculate dynamic Low Stock alerts from catalog
  const stockAlerts = inventory
    .filter((it) => it.stock_level <= 10)
    .map((it) => ({
      id: it.id,
      name: it.part_name,
      sku: it.sku,
      stock: it.stock_level,
      icon: it.icon
    }));

  if (!isAuthenticated) {
    return <AuthView onAuthenticate={handleAuthenticate} />;
  }

  // Full-page welcome screen — dashboard does NOT render until this is dismissed
  if (welcomePending) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#faf9f6] relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full blur-[120px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(13,110,0,0.12) 0%, rgba(188,222,181,0.2) 50%, transparent 80%)" }}
          />
        </div>
        {/* Card */}
        <div className="relative z-10 bg-white rounded-2xl border border-[#dadad7]/60 shadow-2xl p-10 max-w-sm w-full mx-4 flex flex-col items-center text-center gap-6">
          {/* Icon */}
          <div className="w-20 h-20 rounded-2xl bg-[#e2f3df] border-2 border-[#bcdeb5] flex items-center justify-center text-[#0d6e00]">
            <span className="material-symbols-outlined text-4xl">verified</span>
          </div>
          {/* Text */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#141514] tracking-tight">Account Created!</h2>
            <p className="text-[13px] text-[#585956] leading-relaxed">
              Welcome, <span className="font-semibold text-[#141514]">{welcomeCompany}</span>!<br />
              Your supplier account is ready.<br />
              You have been signed in automatically.
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-full space-y-2">
            <p className="text-[11px] text-[#878884] font-semibold tracking-wide uppercase">Entering dashboard in 3s...</p>
            <div className="w-full h-1.5 bg-[#e8e8e5] rounded-full overflow-hidden">
              <div className="h-full bg-[#0d6e00] rounded-full" style={{ animation: "shrink 3s linear forwards" }} />
            </div>
          </div>
          {/* Skip */}
          <button
            onClick={() => setWelcomePending(false)}
            className="text-[12px] font-semibold text-[#0d6e00] hover:underline cursor-pointer"
          >
            Enter dashboard now →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#faf9f6] text-[#1a1c1a] min-h-screen font-sans antialiased selection:bg-[#bcdeb5]">
      
      {/* Universal Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab === "specs") {
            setActiveQuoteId(null);
            setSpecsFlowState("input"); // Reset specs workflow when clicking fresh
          }
        }}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />

      {/* Main viewport frame */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto overflow-y-auto print:p-0 print:m-0 print:max-w-none">
        
        {/* Render Dashboard View */}
        {currentTab === "dashboard" && (
          <DashboardView
            quotes={quotes}
            onNewQuoteClick={() => {
              setCurrentTab("specs");
              setActiveQuoteId(null);
              setSpecsFlowState("input");
            }}
            onViewQuote={handleViewHistoricalQuote}
            onNavigateToCatalog={() => setCurrentTab("catalog")}
          />
        )}

        {/* Render Specs Generation Process Flows */}
        {currentTab === "specs" && (
          <>
            {specsFlowState === "input" && (
              <SpecsInputView onGenerate={handleGenerateSpecifications} />
            )}

            {specsFlowState === "loading" && (
              <SpecsProcessingView statusMessage={processingStatus} />
            )}

            {specsFlowState === "verify" && (
              <SpecsVerifyView
                projectName={synthProjectName}
                targetBudget={synthTargetBudget}
                initialItems={synthLineItems}
                allCatalogItems={inventory}
                onConfirm={handleConfirmVerification}
                onDiscard={() => setSpecsFlowState("input")}
              />
            )}

            {specsFlowState === "preview" && (
              <SpecsPreviewView
                projectName={synthProjectName}
                items={synthLineItems}
                customerName={activeQuote?.customer || "Neural Nexus Corp"}
                targetBudget={synthTargetBudget}
                settings={settings}
                onFinish={handleFinishSavingQuote}
                quoteStatus={activeQuote?.status}
                onStatusChange={activeQuote ? handleHistoricalQuoteStatusChange : undefined}
              />
            )}
          </>
        )}

        {/* Render Catalog List Page */}
        {currentTab === "catalog" && (
            <CatalogView />
        )}

        {/* Render Settings Page */}
        {currentTab === "settings" && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleUpdateSettings}
          />
        )}

        {/* Render Authentication Gate */}
        {currentTab === "auth" && (
          <AuthView onAuthenticate={handleAuthenticate} />
        )}

      </main>
    </div>
  );
}
