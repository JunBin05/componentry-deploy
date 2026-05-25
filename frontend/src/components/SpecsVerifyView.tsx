import React, { useState } from "react";
import { QuoteLineItem, ComponentItem, ComponentCategory } from "../types";
import { checkCompatibility } from "../services/pythonApi";
import { ICON_MAP, displayName, hasSpecs, normalizeCategory } from "../services/quoteAdapter";

interface SpecsVerifyViewProps {
  projectName: string;
  targetBudget: number;
  initialItems: QuoteLineItem[];
  allCatalogItems: ComponentItem[];
  onConfirm: (finalItems: QuoteLineItem[], finalProjectName: string) => void;
  onDiscard: () => void;
}

const CATEGORY_KEYWORDS: Array<[ComponentCategory, string[]]> = [
  ["CPU", ["cpu", "processor", "ryzen", "core i"]],
  ["GPU", ["gpu", "graphics", "geforce", "radeon", "rtx", "rx "]],
  ["Motherboard", ["motherboard", "mainboard", "b650", "x670", "z790", "b760"]],
  ["RAM", ["ram", "memory", "ddr4", "ddr5"]],
  ["Storage", ["storage", "ssd", "hdd", "nvme"]],
  ["PSU", ["psu", "power supply", "watt", "850w", "1000w"]],
  ["Cooling", ["cooler", "cooling", "aio", "air cooler"]],
  ["Hardware", ["case", "chassis"]],
];

function inferSwapCategory(component: ComponentItem): ComponentCategory {
  const normalized = normalizeCategory(component.category);
  if (normalized !== "Hardware") return normalized;

  const searchable = [
    component.id,
    component.sku,
    component.part_name,
    component.name,
    component.icon,
  ].join(" ").toLowerCase();

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => searchable.includes(keyword))) {
      return category;
    }
  }

  return normalized;
}

export default function SpecsVerifyView({
  projectName,
  targetBudget,
  initialItems,
  allCatalogItems,
  onConfirm,
  onDiscard
}: SpecsVerifyViewProps) {
  const [items, setItems] = useState<QuoteLineItem[]>(initialItems);
  const [editingProjectName, setEditingProjectName] = useState(projectName);
  const [swappingLineIdx, setSwappingLineIdx] = useState<number | null>(null);

  // Verification & Dirty States
  const [isDirty, setIsDirty] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'compatible' | 'incompatible'>('unverified');
  const [verificationMessages, setVerificationMessages] = useState<string[]>([]);
  const [verificationSummary, setVerificationSummary] = useState("");
  const [verificationChecks, setVerificationChecks] = useState<Array<{ label: string; status: string; message: string }>>([]);
  const [swappedItemIndex, setSwappedItemIndex] = useState<number | null>(null);

  // Calculate stats
  const totalCost = items.reduce((sum, item) => sum + (item.component.price * item.quantity), 0);
  const budgetUtilization = targetBudget > 0 ? (totalCost / targetBudget) * 100 : 0;
  const isOverBudget = totalCost > targetBudget && targetBudget > 0;

  // Handle quantity adjustments
  const handleQtyChange = (idx: number, delta: number) => {
    const updated = [...items];
    const newQty = Math.max(1, updated[idx].quantity + delta);
    updated[idx].quantity = newQty;
    setItems(updated);

    // Set dirty state upon modify
    setIsDirty(true);
    setVerificationStatus('unverified');
    setVerificationSummary("");
    setVerificationChecks([]);
    setSwappedItemIndex(idx);
  };

  // Perform part swap
  const handleSwapComponent = (lineIdx: number, newComponent: ComponentItem) => {
    const updated = [...items];
    updated[lineIdx] = {
      ...updated[lineIdx],
      component: newComponent,
      rationale: `Changed by user to another ${newComponent.category} part.`
    };
    setItems(updated);
    setSwappingLineIdx(null);

    // Set dirty state upon swap
    setIsDirty(true);
    setVerificationStatus('unverified');
    setVerificationSummary("");
    setVerificationChecks([]);
    setSwappedItemIndex(lineIdx);
  };

  // Live Verification Trigger
  const handleVerifyChanges = async () => {
    setIsVerifying(true);
    setVerificationMessages([]);
    setVerificationSummary("");
    setVerificationChecks([]);
    try {
      const result = await checkCompatibility(items);
      setIsVerifying(false);
      setVerificationMessages([...result.errors, ...result.warnings]);
      setVerificationSummary(result.summary || "");
      setVerificationChecks(result.checks || []);
      if (result.compatible) {
        setVerificationStatus('compatible');
      } else {
        setVerificationStatus('incompatible');
      }
    } catch (error) {
      console.error("Compatibility verification failed:", error);
      setIsVerifying(false);
      setVerificationMessages(["Could not reach the Python compatibility checker."]);
      setVerificationSummary("");
      setVerificationChecks([]);
      setVerificationStatus('incompatible');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Project Edit */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#e6f4ea] text-[#0d6e00] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
              Review Quote
            </span>
          </div>
          <input
            type="text"
            value={editingProjectName}
            onChange={(e) => setEditingProjectName(e.target.value)}
            className="font-display font-bold text-2xl text-[#141514] tracking-tight bg-transparent border-b border-transparent hover:border-[#dadad7] focus:border-[#0d6e00] py-0.5 outline-none transition-all w-96 max-w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDiscard}
            className="px-4 py-2 bg-[#f5f4ef] hover:bg-[#e6e5df] border border-[#dadad7] text-xs font-semibold text-[#585956] rounded-lg transition-colors cursor-pointer"
          >
            Discard
          </button>

          {/* Trigger backend compatibility verification if modified, else confirm direkt */}
          {isDirty && verificationStatus !== 'compatible' ? (
            <button
              onClick={handleVerifyChanges}
              disabled={isVerifying}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 border border-amber-600/20 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                  <span>Checking parts...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">offline_bolt</span>
                  <span>Check Parts</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => onConfirm(items, editingProjectName)}
              className="px-5 py-2.5 bg-[#0d6e00] hover:bg-[#0b5c00] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
              <span>Confirm and Create Quote</span>
            </button>
          )}
        </div>
      </div>

      {/* Quote Estimate & Budget Progress Bar */}
      <div className="rounded-xl border border-[#dadad7] bg-white p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-baseline">
          <div>
            <p className="text-[10px] font-bold text-[#585956] uppercase tracking-wider">
              Quote Total
            </p>
            <h3 className="font-display font-bold text-2xl text-[#141514] tracking-tight mt-1">
              RM {totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold text-[#585956] uppercase tracking-wider">
              Budget Used
            </p>
            <p className={`font-mono text-sm font-bold mt-1 ${isOverBudget ? "text-[#8a1a1a]" : "text-[#0d6e00]"}`}>
              {budgetUtilization.toFixed(0)}% <span className="text-[11px] font-sans font-normal text-[#585956]">of RM {targetBudget.toLocaleString()} limit</span>
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 rounded-full bg-[#f5f4ef] overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isOverBudget ? "bg-[#ff3b30]" : "bg-[#0d6e00]"
            }`}
            style={{ width: `${Math.min(100, budgetUtilization)}%` }}
          />
        </div>

        {isOverBudget && (
          <div className="flex items-center gap-2 p-2 px-3 rounded bg-red-50 border border-red-100 text-[11px] font-semibold text-[#8a1a1a]">
            <span className="material-symbols-outlined text-sm leading-none">error</span>
            <span>This quote is over budget. Try swapping one or more parts for lower-priced options.</span>
          </div>
        )}
      </div>

      {/* Main Hardware Package Specifications List */}
      <div className="rounded-xl border border-[#dadad7] bg-white overflow-visible shadow-sm">
        <div className="p-4 bg-[#fbfbfa] border-b border-[#dadad7] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#585956]">settings_suggest</span>
          <h4 className="font-display font-bold text-xs text-[#141514]">
            Selected Parts
          </h4>
        </div>

        <div className="divide-y divide-[#dadad7]">
          {items.map((line, idx) => {
            const swapCategory = inferSwapCategory(line.component);
            const alternatives = allCatalogItems
              .filter((alt) => inferSwapCategory(alt) === swapCategory && alt.id !== line.component.id)
              .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
              .map(alt => ({
                id: alt.id,
                name: alt.part_name,
                part_name: alt.part_name,
                sku: alt.sku,
                price: alt.price,
                category: alt.category as ComponentCategory,
                icon: alt.icon || ICON_MAP[alt.category] || 'hardware',
                stock: alt.stock_level,
                stock_level: alt.stock_level,
                specs: alt.specs || {},
              }));

            return (
              <div
                key={idx}
                className={`p-5 flex flex-col gap-4 hover:bg-[#faf9f6]/40 transition-colors relative ${
                  swappingLineIdx === idx ? "z-30" : "z-10"
                }`}
              >
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  {/* Product Meta */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-[#e2f3df] border border-[#bcdeb5] flex items-center justify-center text-[#0d6e00] shrink-0">
                      <span className="material-symbols-outlined text-[22px]">{line.component.icon || "layers"}</span>
                    </div>
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#0d6e00] bg-[#e6f4ea] px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                          {line.component.category}
                        </span>
                        <span className="text-[10px] font-mono text-[#878884]">SKU: {line.component.sku}</span>
                      </div>
                      <p className="font-sans font-bold text-sm text-[#141514]">{displayName(line.component)}</p>

                      {/* Reason block */}
                      {line.rationale && (
                        <div className="mt-2.5 p-3 rounded-lg bg-[#faf9f6] border border-[#dadad7]/60 flex items-start gap-2.5 max-w-xl">
                          <span className="material-symbols-outlined text-xs text-[#0d6e00] bg-white rounded-full p-0.5 border border-[#dadad7] shrink-0 font-bold leading-none">
                            auto_awesome
                          </span>
                          <p className="text-[11px] text-[#585956] leading-relaxed italic">
                            {line.rationale}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing & Control Block */}
                  <div className="flex flex-col md:items-end justify-between self-stretch shrink-0 gap-3">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-[#878884] tracking-wider leading-none">
                        Price / Unit
                      </p>
                      <p className="font-mono text-sm font-bold text-[#141514] mt-1">
                        RM {line.component.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Quantity adjustment & Swap control */}
                    <div className="flex items-center gap-3 self-end">
                      <div className="flex items-center rounded-lg border border-[#dadad7] bg-[#fbfbfa]" id="quantity-adjust">
                        <button
                          onClick={() => handleQtyChange(idx, -1)}
                          className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[#585956] hover:bg-[#e6e5df] transition-colors rounded-l-lg border-r border-[#dadad7] cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-3 text-xs font-mono font-bold text-[#141514]">{line.quantity}</span>
                        <button
                          onClick={() => handleQtyChange(idx, 1)}
                          className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[#585956] hover:bg-[#e6e5df] transition-colors rounded-r-lg border-l border-[#dadad7] cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div className="relative">
                        <button
                          onClick={() => setSwappingLineIdx(swappingLineIdx === idx ? null : idx)}
                          className="px-3 py-2 border border-[#dadad7] hover:border-[#0d6e00]/60 hover:bg-[#faf9f6] text-xs font-semibold text-[#141514] rounded-lg transition-all flex items-center gap-1 group cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm leading-none transition-transform group-hover:rotate-180">sync</span>
                          <span>Swap</span>
                        </button>

                        {/* Swap Inline Alternatives Drawer with elevated z-index */}
                        {swappingLineIdx === idx && (
                          <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-3rem))] bg-white border border-[#dadad7] rounded-xl shadow-2xl z-50 p-4 space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#585956] pb-2 border-b border-[#dadad7]">
                              Other choices ({alternatives.length})
                            </p>
                            {alternatives.length === 0 ? (
                              <p className="text-xs text-[#878884] italic p-2 text-center">
                                No other matching parts in this catalog.
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                {alternatives.map((alt) => {
                                  const diff = alt.price - line.component.price;
                                  const isPositive = diff > 0;
                                  return (
                                    <button
                                      key={alt.id}
                                      onClick={() => handleSwapComponent(idx, alt)}
                                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[#dadad7] hover:border-[#0d6e00] hover:bg-[#faf9f6] text-left transition-all cursor-pointer"
                                    >
                                      <div className="min-w-0 pr-2">
                                        <p className="text-xs font-bold text-[#141514] truncate">{alt.part_name}</p>
                                        <p className="text-[10px] font-mono text-[#585956] mt-0.5">SKU: {alt.sku}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="text-xs font-mono font-bold text-[#141514]">RM {alt.price.toLocaleString()}</p>
                                        <p className={`text-[10px] font-mono font-bold mt-0.5 ${isPositive ? "text-red-600" : "text-[#0d6e00]"}`}>
                                          {isPositive ? `+RM ${diff.toLocaleString()}` : `-RM ${Math.abs(diff).toLocaleString()}`}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inline Real-time Verification Alert Feedback Block */}
                {swappedItemIndex === idx && isDirty && (
                  <div className="mt-2.5 max-w-xl border-t border-dashed border-[#dadad7] pt-3">
                    {verificationStatus === 'unverified' && (
                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        <span className="material-symbols-outlined text-base animate-pulse text-amber-600">report_problem</span>
                        <p className="font-medium">
                          Part changed. Click <strong className="font-semibold text-amber-950">Check Parts</strong> above to make sure the parts work together.
                        </p>
                      </div>
                    )}

                    {verificationStatus === 'incompatible' && (
                      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs space-y-2.5">
                        <div className="flex items-start gap-2.5 text-red-800">
                          <span className="material-symbols-outlined text-base text-red-600 shrink-0 mt-0.5">cancel</span>
                          <div className="font-semibold leading-relaxed space-y-1">
                            {(verificationMessages.length ? verificationMessages : ["Compatibility check found an issue with the selected parts."]).map((message) => (
                              <p key={message}>{message}</p>
                            ))}
                          </div>
                        </div>
                        <div className="pl-7">
                          <button
                            onClick={() => {
                              const updated = [...items];
                              const psuIdx = updated.findIndex(it => it.component.category === "PSU");
                              const targetPSU = allCatalogItems
                                .filter(it => it.category === "PSU")
                                .sort((a, b) => Number(b.price || 0) - Number(a.price || 0))[0];

                              if (!targetPSU) return;

                              if (psuIdx > -1) {
                                updated[psuIdx] = {
                                  ...updated[psuIdx],
                                  component: targetPSU,
                                  rationale: "Changed to the strongest available PSU in the catalog."
                                };
                              } else {
                                updated.push({
                                  component: targetPSU,
                                  quantity: 1,
                                  rationale: "Added the strongest available PSU in the catalog."
                                });
                              }
                              setItems(updated);
                              setIsDirty(true);
                              setVerificationStatus('unverified');
                              setVerificationMessages([]);
                              setVerificationSummary("");
                              setVerificationChecks([]);
                              setSwappedItemIndex(psuIdx > -1 ? psuIdx : updated.length - 1);
                            }}
                            className="px-3 py-1.5 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
                          >
                            <span className="material-symbols-outlined text-[14px]">tune</span>
                            <span>Use Strongest PSU</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {verificationStatus === 'compatible' && (
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                        <span className="material-symbols-outlined text-base text-green-600 shrink-0 mt-0.5">check_circle</span>
                        <div>
                          <p className="font-semibold leading-relaxed">
                            {hasSpecs(line.component.specs)
                              ? (verificationSummary || "Parts work together.")
                              : "This part needs full specs before we can check it."}
                          </p>
                          {verificationChecks.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {verificationChecks.map((check) => (
                                <p key={`${check.label}-${check.message}`} className="text-[11px] font-medium leading-relaxed">
                                  <span className="font-bold">{check.label}:</span> {check.message}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
