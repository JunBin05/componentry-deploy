import React, { useState } from "react";

interface SpecsInputViewProps {
  onGenerate: (prompt: string, budget: number) => void;
}

export default function SpecsInputView({ onGenerate }: SpecsInputViewProps) {
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState<number | "">("");

  const promptExamples = [
    {
      title: "Gaming Build",
      icon: "sports_esports",
      text: "Customer needs a gaming PC for 4K games, with quiet fans and an RM 12,000 budget.",
      budget: 12000
    },
    {
      title: "Video Editing",
      icon: "movie_filter",
      text: "Customer edits 8K video in Adobe Premiere Pro and DaVinci Resolve. Budget is RM 20,000.",
      budget: 20000
    },
    {
      title: "3D Rendering",
      icon: "view_in_ar",
      text: "Customer needs a workstation for Blender and Maya rendering. They want strong CPU and GPU performance, quiet fans, and an RM 35,000 budget.",
      budget: 35000
    },
    {
      title: "Office Productivity",
      icon: "work",
      text: "Customer needs an office PC for large Excel files, many browser tabs, and Zoom calls. Budget is RM 2,500.",
      budget: 2500
    },
    {
      title: "Data Science",
      icon: "science",
      text: "Customer needs a machine learning PC with a strong GPU, plenty of memory, good cooling, and an RM 45,000 budget.",
      budget: 45000
    }
  ];

  const handleExampleClick = (example: typeof promptExamples[0]) => {
    setPrompt((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return example.text;
      return `${trimmed}\n\n${example.text}`;
    });
    setBudget(example.budget);
  };

  const handleStartGeneration = () => {
    if (!prompt.trim() || budget === "") return;
    onGenerate(prompt, budget);
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div>
        <h2 className="font-display font-bold text-2xl text-[#141514] tracking-tight">
          Create New Quote
        </h2>
        <p className="text-sm text-[#585956] leading-relaxed mt-1">
          Describe what your customer needs. We will match it with suitable parts from your catalog.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Customer Intent Profile Panel (Left - column span 7) */}
        <div className="lg:col-span-7 rounded-xl border border-[#dadad7] bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#dadad7]">
            <span className="material-symbols-outlined text-[20px] text-[#0d6e00]">chat_bubble_outline</span>
            <h3 className="font-display font-semibold text-sm text-[#141514]">
              Customer Needs
            </h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#585956] uppercase tracking-wider">
              Customer Request
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the customer's needs, for example: 'They need a workstation for 3D rendering in Blender.'"
              className="w-full h-52 p-4 rounded-lg border border-[#dadad7] focus:border-[#0d6e00] focus:ring-1 focus:ring-[#0d6e00]/20 bg-[#faf9f6] text-sm leading-relaxed text-[#141514] placeholder-[#878884] resize-none outline-none transition-all"
            />
            <div className="flex justify-between items-center text-[11px] text-[#878884]">
              <span>Type custom briefs or click examples to begin</span>
              <span>{prompt.length} characters</span>
            </div>
          </div>

          {/* Prompt Trigger Button */}
          <button
            onClick={handleStartGeneration}
            disabled={!prompt.trim() || budget === ""}
            className="w-full py-3.5 px-4 rounded-lg bg-[#0d6e00] hover:bg-[#0b5c00] text-white font-sans font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:shadow"
          >
            <span>Generate Quote</span>
          </button>
        </div>

        {/* Target Budget & Examples Row (Right - column span 5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Target Budget Card */}
          <div className="rounded-xl border border-[#dadad7] bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#dadad7]">
              <span className="material-symbols-outlined text-[18px] text-[#585956]">payments</span>
              <h3 className="font-display font-semibold text-sm text-[#141514]">
                Budget
              </h3>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#585956] uppercase tracking-wider block">
                Target Budget (RM)
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <span className="text-xs font-semibold text-[#585956]">RM</span>
                </div>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 15000"
                  className="w-full py-2.5 pl-11 pr-4 bg-[#faf9f6] rounded-lg border border-[#dadad7] focus:border-[#0d6e00] text-sm font-semibold text-[#141514] outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Quick Examples Selection */}
          <div className="rounded-xl border border-[#dadad7] bg-[#fbfbfa] p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-[#dadad7]">
              <span className="material-symbols-outlined text-[18px] text-[#585956]">lightbulb</span>
              <h3 className="font-display font-semibold text-xs text-[#585956] uppercase tracking-wider">
                Examples
              </h3>
            </div>

            <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
              {promptExamples.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(ex)}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg border border-[#dadad7] bg-white hover:border-[#0d6e00]/60 hover:bg-[#faf9f6] transition-all text-left group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded bg-[#faf9f6] border border-[#dadad7] group-hover:bg-[#e6f4ea] group-hover:border-[#bccbb3] flex items-center justify-center text-[#585956] group-hover:text-[#0d6e00] shrink-0 transition-colors">
                    <span className="material-symbols-outlined text-base leading-none">{ex.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#141514] truncate group-hover:text-[#0d6e00] transition-colors leading-none">
                      {ex.title}
                    </p>
                    <p className="text-[10px] text-[#878884] truncate mt-1">
                      {ex.text}
                    </p>
                  </div>
                  <div className="flex items-center justify-center h-7 shrink-0 ml-1.5">
                    <span className="material-symbols-outlined text-sm font-bold text-[#878884] group-hover:text-[#0d6e00] group-hover:scale-110 transition-transform">add</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#878884] bg-white border border-[#dadad7] px-3 py-2 rounded-md">
              <span className="material-symbols-outlined text-xs text-[#0d6e00]">info</span>
              <span>Click an example to add it to the request.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
