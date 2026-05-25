import React, { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../context/InventoryContext";

interface AuthViewProps {
  onAuthenticate: (company: string, email: string, isNewUser?: boolean) => void;
}

export default function AuthView({ onAuthenticate }: AuthViewProps) {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !email.trim() || !password) {
      setErrorMsg("Please fill in company name, email, and password.");
      return;
    }

    setErrorMsg("");
    setIsLoading(true);

    if (isSignUpMode) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setIsLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        // Pass isNewUser=true so App.tsx shows the welcome overlay
        onAuthenticate(company, email, true);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        onAuthenticate(company, data.user?.email || email, false);
      }
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center relative p-6 bg-[#faf9f6] overflow-hidden select-none">

      {/* Ambient background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 0.92, 1], opacity: [0.35, 0.55, 0.4, 0.35] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="w-[700px] h-[700px] rounded-full blur-[110px] absolute"
          style={{ background: "radial-gradient(circle, rgba(13, 110, 0, 0.08) 0%, rgba(218, 218, 215, 0.3) 50%, rgba(250, 249, 246, 0) 85%)" }}
        />
        <motion.div
          animate={{ scale: [0.9, 1.05, 0.95, 0.9], opacity: [0.2, 0.3, 0.25, 0.2] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="w-[450px] h-[450px] rounded-full blur-[90px] absolute -translate-x-32 -translate-y-20"
          style={{ background: "radial-gradient(circle, rgba(188, 203, 179, 0.2) 0%, rgba(250, 249, 246, 0) 70%)" }}
        />
      </div>

      {/* Auth Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-[#dadad7]/60 bg-white p-7 shadow-[0_32px_64px_rgba(20,21,20,0.03),0_16px_32px_rgba(20,21,20,0.02)] relative z-10 space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#e2f3df] border border-[#bcdeb5] rounded-xl flex items-center justify-center text-[#0d6e00] mx-auto">
            <span className="material-symbols-outlined text-2xl font-bold">shield_person</span>
          </div>
          <div className="space-y-0.5">
            <h3 className="font-bold text-[#141514] tracking-tight text-lg">Sign in to Componentry</h3>
            <p className="text-[11px] text-[#585956] px-4 leading-relaxed">
              Manage your parts catalog and create customer quotes.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-2.5 rounded bg-[#faeae8] border border-[#eba1a1] text-[11px] font-semibold text-[#8a1a1a] flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-xs leading-none">error</span>
              <span>{errorMsg}</span>
            </motion.div>
          )}

          <div className="space-y-3.5 text-xs font-semibold text-[#585956]">
            <div className="space-y-1">
              <label className="uppercase tracking-wider">Company Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-[#878884] text-base leading-none">corporate_fare</span>
                </div>
                <input type="text" required value={company} onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Intel Corp"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none text-xs font-semibold text-[#141514] transition-all" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="uppercase tracking-wider">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-[#878884] text-base leading-none">mail</span>
                </div>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. auth-admin@intel.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none text-xs font-semibold text-[#141514] transition-all" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="uppercase tracking-wider">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-[#878884] text-base leading-none">lock</span>
                </div>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none text-xs font-semibold text-[#141514] transition-all" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={isLoading}
            className="w-full mt-4 py-2.5 font-semibold text-xs text-[#faf9f6] bg-[#141514] hover:bg-black rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-75"
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                <span>{isSignUpMode ? "Creating account..." : "Signing in..."}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm text-[#44d62c] group-hover:scale-110 transition-transform">verified_user</span>
                <span>{isSignUpMode ? "Create Account" : "Log In"}</span>
              </>
            )}
          </button>

          <div className="text-center mt-3">
            <button type="button"
              onClick={() => { setErrorMsg(""); setPassword(""); setIsSignUpMode(!isSignUpMode); }}
              className="text-[11px] font-semibold text-[#0d6e00] hover:underline cursor-pointer"
            >
              {isSignUpMode ? "Already have an account? Log in." : "New here? Create an account."}
            </button>
          </div>
        </form>

        <div className="border-t border-[#dadad7] pt-3 text-center">
          <p className="text-[9px] font-mono text-[#878884] uppercase tracking-wider">
            Your account is protected
          </p>
        </div>
      </motion.div>
    </div>
  );
}
