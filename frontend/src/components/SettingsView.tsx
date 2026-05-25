import React, { useState } from "react";
import { SupplierConfig } from "../types";

interface SettingsViewProps {
  settings: SupplierConfig;
  onSaveSettings: (settings: SupplierConfig) => void;
}

export default function SettingsView({ settings, onSaveSettings }: SettingsViewProps) {
  const [companyName, setCompanyName] = useState(settings.companyName || "TechRigs Distribution Sdn Bhd");
  const [contactNumber, setContactNumber] = useState(settings.contactNumber || "+60 3-2142 0000");
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail || "sales@techrigs.com.my");
  const [businessAddress, setBusinessAddress] = useState(settings.businessAddress || "Level 3, Plaza Low Yat, Bukit Bintang, 55100 Kuala Lumpur");
  const [customQuotePrefix, setCustomQuotePrefix] = useState(settings.customQuotePrefix || "TRD");

  const [savingState, setSavingState] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingState(true);
    setTimeout(() => {
      onSaveSettings({
        companyName,
        contactNumber,
        supportEmail,
        businessAddress,
        customQuotePrefix
      });
      setSavingState(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Title */}
      <div className="text-center md:text-left">
        <h2 className="font-display font-bold text-xl text-[#141514] tracking-tight">
          Settings
        </h2>
        <p className="text-xs text-[#585956]">
          Set the business details shown on your quotes.
        </p>
      </div>

      {/* Main Single-Column Form Card */}
      <div className="rounded-xl border border-[#dadad7] bg-white shadow-md overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-[#dadad7]">
            <span className="material-symbols-outlined text-[20px] text-[#0d6e00]">business_center</span>
            <h3 className="font-display font-semibold text-sm text-[#141514]">
              Business Profile
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold text-[#585956]">
            {/* Legal Name */}
            <div className="space-y-1">
              <label className="uppercase tracking-wider">Company Name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-sans text-xs font-semibold text-[#141514]"
                placeholder="TechRigs Distribution Sdn Bhd"
              />
            </div>

            {/* Quote Prefix */}
            <div className="space-y-1">
              <label className="uppercase tracking-wider">Quote Prefix</label>
              <input
                type="text"
                required
                maxLength={5}
                value={customQuotePrefix}
                onChange={(e) => setCustomQuotePrefix(e.target.value.toUpperCase())}
                className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-mono text-xs font-bold text-[#141514]"
                placeholder="TRD-"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="uppercase tracking-wider">Email</label>
              <input
                type="email"
                required
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-sans text-xs font-semibold text-[#141514]"
                placeholder="sales@techrigs.com.my"
              />
            </div>

            {/* Phone number */}
            <div className="space-y-1">
              <label className="uppercase tracking-wider">Phone Number</label>
              <input
                type="text"
                required
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-sans text-xs font-semibold text-[#141514]"
                placeholder="+60 3-2142 0000"
              />
            </div>
          </div>

          {/* Physical Address */}
          <div className="space-y-1 text-xs font-semibold text-[#585956]">
            <label className="uppercase tracking-wider">Business Address</label>
            <textarea
              required
              rows={3}
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-sans text-xs font-semibold text-[#141514] resize-none leading-relaxed"
              placeholder="Level 3, Plaza Low Yat, Bukit Bintang, 55100 Kuala Lumpur"
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-5 border-t border-[#dadad7] flex items-center justify-end gap-4">
            <div className="flex items-center gap-3">
              {savedSuccess && (
                <span className="text-xs font-semibold text-[#137333] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm leading-none font-bold">check_circle</span>
                  <span>Settings saved</span>
                </span>
              )}
              <button
                type="submit"
                disabled={savingState}
                className="px-5 py-2.5 bg-[#0d6e00] hover:bg-[#0b5c00] text-white rounded-lg font-sans text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {savingState ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm font-bold">save</span>
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
