import React, { useState } from "react";
import { QuoteLineItem, SupplierConfig, QuoteStatus } from "../types";
import { displayName } from "../services/quoteAdapter";

interface SpecsPreviewViewProps {
  projectName: string;
  items: QuoteLineItem[];
  customerName: string;
  targetBudget: number;
  settings: SupplierConfig;
  onFinish: (saveToHistory: boolean) => void;
  quoteStatus?: QuoteStatus;
  onStatusChange?: (nextStatus: QuoteStatus) => Promise<void>;
}

export default function SpecsPreviewView({
  projectName,
  items,
  customerName,
  targetBudget,
  settings,
  onFinish,
  quoteStatus,
  onStatusChange
}: SpecsPreviewViewProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + (item.component.price * item.quantity), 0);
  const grandTotal = subtotal;

  const quoteNumber = `${settings.customQuotePrefix || "TRD"}-${Math.floor(100000 + Math.random() * 900000)}`;
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const handleShare = () => {
    setCopiedLink(true);
    navigator.clipboard?.writeText(window.location.href + `#quote=${quoteNumber}`);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleExport = () => {
    setDownloaded(true);
    window.print();
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleStatusChange = async (nextStatus: QuoteStatus) => {
    if (!onStatusChange || nextStatus === quoteStatus) return;
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(nextStatus);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="font-display font-bold text-xl text-[#141514] tracking-tight">
            Quotation Preview
          </h2>
          <p className="text-xs text-[#585956]">
            Review the quote before saving or sending it to the client.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {onStatusChange && quoteStatus && (
            <div className="flex items-center gap-2 bg-[#fbfbfa] p-1.5 rounded-lg border border-[#dadad7] shadow-sm">
              <span className="text-[11px] font-semibold text-[#878884] uppercase tracking-wider px-2">
                Status:
              </span>
              <div className="flex bg-white rounded-md border border-[#dadad7] overflow-hidden">
                {(["Draft", "Sent", "Approved", "Declined"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={isUpdatingStatus || status === quoteStatus}
                    className={`px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
                      status === quoteStatus
                        ? status === "Approved"
                          ? "bg-[#34a853] text-white"
                          : status === "Declined"
                          ? "bg-[#ea4335] text-white"
                          : status === "Sent"
                          ? "bg-[#1a73e8] text-white"
                          : "bg-[#141514] text-white"
                        : "text-[#585956] hover:bg-[#f5f4ef] cursor-pointer hover:text-black border-r border-[#dadad7] last:border-0"
                    }`}
                  >
                    {status === "Draft" ? "Draft" : 
                     status === "Sent" ? "Mark as Sent" :
                     status === "Approved" ? "Approved" : "Declined"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Share */}
          <button
            onClick={handleShare}
            className={`px-4 py-2 border rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${
              copiedLink
                ? "bg-[#e2f3df] border-[#bcdeb5] text-[#137333]"
                : "bg-white border-[#dadad7] hover:bg-[#faf9f6] text-[#141514]"
            }`}
          >
            <span className="material-symbols-outlined text-sm leading-none">
              {copiedLink ? "done" : "share"}
            </span>
            <span>{copiedLink ? "Link copied" : "Share Quote"}</span>
          </button>

          {/* Export as PDF */}
          <button
            onClick={handleExport}
            className={`px-4 py-2 border rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${
              downloaded
                ? "bg-[#e2f3df] border-[#bcdeb5] text-[#137333]"
                : "bg-white border-[#dadad7] hover:bg-[#faf9f6] text-[#141514]"
            }`}
          >
            <span className="material-symbols-outlined text-sm leading-none">
              {downloaded ? "file_download_done" : "download"}
            </span>
            <span>{downloaded ? "Printing..." : "Download PDF"}</span>
          </button>

          {/* Finish & Save */}
          <button
            onClick={() => onFinish(true)}
            className="px-4 py-2 bg-[#0d6e00] hover:bg-[#0b5c00] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm font-bold">save</span>
            <span>Confirm & Save Quote</span>
          </button>
        </div>
      </div>

      {/* A4 White Paper Container */}
      <div className="max-w-4xl mx-auto bg-white border border-[#dadad7] shadow-xl p-8 sm:p-12 font-sans text-xs text-[#1a1c1a] leading-relaxed relative min-h-[1050px] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none">
        
        {/* Top strip banner overlay */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#0d6e00] print:hidden"></div>

        <div className="space-y-8">
          {/* Doc Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[#0d6e00] text-3xl font-bold">
                  memory
                </span>
                <span className="font-display font-bold text-lg tracking-tight uppercase">
                  {settings.companyName || "TechRigs Distribution Sdn Bhd"}
                </span>
              </div>
              <p className="text-[#585956] leading-relaxed whitespace-pre-line text-[11px]">
                {settings.businessAddress || "Level 3, Plaza Low Yat, Bukit Bintang\n55100 Kuala Lumpur"}
              </p>
              <p className="text-[#585956] text-[11px] mt-1">
                Phone: {settings.contactNumber || "+60 3-2142 0000"} | Email: {settings.supportEmail || "quotes@techrigs.com.my"}
              </p>
            </div>

            <div className="sm:text-right">
              <h1 className="font-display font-bold text-3xl text-[#141514] tracking-tight uppercase leading-none">
                Quotation
              </h1>
              <div className="mt-4 gap-x-6 gap-y-1 grid grid-cols-2 text-left sm:text-right border-t border-[#dadad7] pt-3 text-[11px]">
                <span className="font-semibold text-[#878884] uppercase tracking-wider">Quote Number:</span>
                <span className="font-mono font-bold text-[#141514]">{quoteNumber}</span>
                <span className="font-semibold text-[#878884] uppercase tracking-wider">Date Created:</span>
                <span className="text-[#141514]">{currentDate}</span>
                <span className="font-semibold text-[#878884] uppercase tracking-wider">Valid Till:</span>
                <span className="text-[#141514]">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#dadad7] pt-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#878884] mb-1.5">
                Quotation Prepared For:
              </h3>
              <p className="font-bold text-[#141514] text-sm">{customerName}</p>
              <p className="text-[#585956] mt-0.5">IT Procurement Division</p>
              <p className="text-[#585956] text-[11px] mt-1">Client Contact: Elena Rostova</p>
              <p className="text-[#585956] text-[11px]">Neural Nexus Corp Sdn Bhd</p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#878884] mb-1.5">
                Project Details:
              </h3>
              <p className="font-semibold text-[#0d6e00] text-xs">
                Project Name: <span className="font-bold text-[#141514]">{projectName}</span>
              </p>
              <p className="text-[#585956] mt-0.5 text-[11px]">
                Budget: <span className="font-mono font-bold text-[#141514]">RM {targetBudget.toLocaleString()}</span>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-[#dadad7] rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fbfbfa] border-b border-[#dadad7] text-[10px] font-bold uppercase tracking-wider text-[#585956]">
                  <th className="px-4 py-2.5 w-16 text-center">Qty</th>
                  <th className="px-4 py-2.5">Item / Description</th>
                  <th className="px-4 py-2.5 text-right w-28">Unit Price</th>
                  <th className="px-4 py-2.5 text-right w-28">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadad7] text-[11px]">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-[#faf9f6]/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-center">{it.quantity}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#141514]">{displayName(it.component)}</p>
                      <p className="text-[10px] font-mono text-[#585956] mt-0.5">SKU: {it.component.sku} | Category: {it.component.category}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#585956]">
                      RM {it.component.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#141514]">
                      RM {(it.component.price * it.quantity).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing Totals Grid */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2">
            <div className="flex-1 p-4 rounded-lg bg-[#fbfbfa] border border-[#dadad7] self-start max-w-md">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#585956] mb-1">
                Terms and Conditions
              </h4>
              <p className="text-[10px] text-[#878884] leading-relaxed">
                1. Quote prices are valid for thirty (30) days from the date shown.<br />
                2. Prices shown are inclusive of Sales and Service Tax (SST) where applicable.<br />
                3. Assembly, testing, and delivery performed under standard B2B terms and conditions.
              </p>
            </div>

            <div className="w-72 shrink-0 border border-[#dadad7] rounded-lg overflow-hidden divide-y divide-[#dadad7]">
              <div className="px-4 py-2 flex justify-between items-center bg-[#faf9f6]">
                <span className="text-[#585956] font-semibold text-[10px] uppercase">Hardware Subtotal:</span>
                <span className="font-mono font-bold text-[#141514]">RM {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="px-4 py-3.5 flex flex-col bg-[#fbfbfa] gap-1">
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#141514] font-bold text-xs uppercase">Grand Total (RM):</span>
                  <span className="font-mono font-bold text-base text-[#0d6e00]">RM {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-[#878884] italic block leading-normal">
                    All prices shown are inclusive of applicable SST.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Line */}
        <div className="flex justify-between items-end border-t border-[#dadad7] pt-8 mt-12 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] text-[#585956]">
              Generated by Componentry | Document ID: TRD-518946
            </p>
          </div>

          <div className="w-56 text-center">
            <div className="font-display italic text-sm text-gray-400 select-none pb-1 line-through tracking-wider decoration-gray-300">
              TechRigs Distribution Sdn Bhd
            </div>
            <div className="border-t border-[#878884] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#585956] leading-none">
                Authorized Signature
              </p>
              <p className="text-[9px] text-[#878884] mt-1">TechRigs Distribution Sdn Bhd</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
