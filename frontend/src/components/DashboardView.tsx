import React, { useState } from "react";
import { QuoteProposal, StockAlert } from "../types";
import { useInventory } from "../context/InventoryContext";

interface DashboardViewProps {
  quotes: QuoteProposal[];
  onNewQuoteClick: () => void;
  onViewQuote: (quote: QuoteProposal) => void;
  onNavigateToCatalog: () => void;
}

export default function DashboardView({ quotes, onNewQuoteClick, onViewQuote, onNavigateToCatalog }: DashboardViewProps) {
  const { inventory } = useInventory();
  
  const lowStockItems = inventory.filter((item) => (item.stock_level ?? 0) < 10);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e2f3df] text-[#137333] border border-[#bcdeb5]/60 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34a853]"></span>
            Approved
          </span>
        );
      case "Declined":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#faeae8] text-[#8a1a1a] border border-[#eba1a1]/60 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ea4335]"></span>
            Declined
          </span>
        );
      case "Sent":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e8f0fe] text-[#174ea6] border border-[#d2e3fc]/60 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8]"></span>
            Sent
          </span>
        );
      default: // Draft
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fef7e0] text-[#b06000] border border-[#fde293]/60 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-[#fbbc04]"></span>
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border border-[#dadad7] bg-[#fbfbfa] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="space-y-1 max-w-xl">
          <h2 className="font-display font-bold text-xl text-[#141514] tracking-tight">
            Ready to generate a new quote?
          </h2>
          <p className="text-sm text-[#585956] leading-relaxed">
            Create detailed, compatibility-checked hardware quotes for your PC store clients in seconds.
          </p>
        </div>
        <button
          onClick={onNewQuoteClick}
          className="px-5 py-2.5 rounded-lg bg-[#0d6e00] hover:bg-[#0b5c00] text-white font-sans font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center gap-2 shrink-0 group"
        >
          <span className="material-symbols-outlined text-base font-bold transition-transform group-hover:scale-110">add_circle</span>
          <span>New Quote</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Avg. Time Per Quote */}
        <div className="rounded-xl border border-[#dadad7] bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#585956] tracking-wider uppercase font-sans">
              Avg. Time Per Quote
            </span>
            <span className="material-symbols-outlined text-sm text-[#0d6e00] bg-[#e6f4ea] p-1.5 rounded-lg font-bold">timer</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="font-display font-medium text-3xl text-[#0d6e00] tracking-tight">42 seconds</span>
          </div>
          <p className="text-[11px] text-[#878884] mt-2 font-semibold">Down from 35 mins (Manual)</p>
        </div>

        {/* Quotes Generated */}
        <div className="rounded-xl border border-[#dadad7] bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#585956] tracking-wider uppercase font-sans">
              Quotes Generated
            </span>
            <span className="material-symbols-outlined text-sm text-[#585956] bg-[#f5f4ef] p-1.5 rounded-lg">description</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="font-display font-bold text-3xl text-[#141514] tracking-tight">184</span>
          </div>
          <p className="text-[11px] text-[#878884] mt-2 font-semibold">Last 30 days</p>
        </div>

        {/* Quote Win Rate */}
        <div className="rounded-xl border border-[#dadad7] bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#585956] tracking-wider uppercase font-sans">
              Quote Win Rate
            </span>
            <span className="material-symbols-outlined text-sm text-[#0d6e00] bg-[#e6f4ea] p-1.5 rounded-lg font-bold">trending_up</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="font-display font-bold text-3xl text-[#141514] tracking-tight">71.4%</span>
          </div>
          <p className="text-[11px] text-[#878884] mt-2 font-semibold">Approved vs. Sent ratio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Quotes (Left 2/3) */}
        <div className="lg:col-span-2 rounded-xl border border-[#dadad7] bg-white overflow-hidden shadow-sm flex flex-col h-[400px]">
          <div className="p-5 border-b border-[#dadad7] bg-[#fbfbfa] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#585956]">receipt_long</span>
              <h3 className="font-display font-bold text-sm text-[#141514]">
                Recent Quotes
              </h3>
            </div>
            <p className="text-xs font-semibold text-[#878884]">Saved</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {quotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <span className="material-symbols-outlined text-3xl text-[#dadad7] mb-2">folder_open</span>
                <p className="text-sm font-semibold text-[#585956]">No quotes yet.</p>
                <p className="text-xs text-[#878884] mt-0.5">Click "New Quote" to start.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#dadad7] text-[10px] font-bold text-[#585956] tracking-wider uppercase bg-[#faf9f6] sticky top-0">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Customer / Brief</th>
                    <th className="px-5 py-3 text-right">Total Price</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dadad7]">
                  {quotes.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => onViewQuote(q)}
                      className="hover:bg-[#faf9f6]/80 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 text-xs font-mono text-[#585956] whitespace-nowrap">
                        {q.date}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-bold text-[#141514]">{q.customer}</div>
                        <div className="text-xs text-[#585956] truncate max-w-xs">{q.brief}</div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-xs font-bold text-[#141514] whitespace-nowrap">
                        RM {q.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {getStatusBadge(q.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Low Stock Alerts + Order Inventory (Right 1/3) */}
        <div className="rounded-xl border border-[#dadad7] bg-white p-5 shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center justify-between pb-3 border-b border-[#dadad7]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#8a1a1a]">warning</span>
              <h3 className="font-display font-bold text-sm text-[#141514]">
                Low Stock Alerts
              </h3>
            </div>
            <span className="w-2 h-2 rounded-full bg-[#ff3b30] animate-pulse"></span>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-3">
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <span className="material-symbols-outlined text-3xl text-[#34a853] mb-2">check_circle</span>
                <p className="text-sm font-semibold text-[#137333]">Stock looks good</p>
              </div>
            ) : (
              lowStockItems.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[#faf9f6] border border-[#dadad7] hover:border-[#bccbb3] transition-colors"
                >
                  <div className="w-8 h-8 rounded-md bg-[#faeae8] border border-[#eba1a1] flex items-center justify-center text-[#8a1a1a] shrink-0">
                    <span className="material-symbols-outlined text-base">inventory_2</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#141514] truncate leading-snug">
                      {alert.part_name}
                    </p>
                    <p className="text-[10px] font-mono text-[#585956] mt-0.5">
                      SKU: {alert.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex px-1.5 py-0.5 bg-[#faeae8] text-[#8a1a1a] border border-[#eba1a1] text-[10px] font-bold rounded">
                      {alert.stock_level} left
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action button leading to Catalog */}
          <div className="pt-4 border-t border-[#dadad7] mt-3">
            <button
              onClick={onNavigateToCatalog}
              className="w-full py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 bg-[#141514] hover:bg-black text-[#faf9f6]/95 cursor-pointer hover:shadow-sm"
            >
              <span className="material-symbols-outlined text-sm text-[#44d62c]">sync</span>
              <span>Update Stock Levels</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
