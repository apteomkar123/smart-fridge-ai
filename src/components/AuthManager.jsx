import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthManager() {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
        alert("PROFILE CREATED SUCCESSFULLY!");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await supabase.auth.resetPasswordForEmail(authEmail);
      alert('Password reset link sent to your email!');
      setIsForgotPasswordView(false);
      setAuthEmail('');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="bg-white border border-blue-100 p-10 rounded-[3rem] w-full max-w-md shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-[#6BAEE0]"></div>
      <h2 className="logo-text text-5xl mb-6 text-[#1F6FB8] text-center">Hungry</h2>
      
      <form onSubmit={isForgotPasswordView ? handleResetPassword : handleAuthSubmit} className="space-y-4 mt-6 font-sans">
        {isForgotPasswordView && <p className="text-xs text-slate-400 mb-4">Enter your email to receive a password reset link.</p>}
        {!isForgotPasswordView && isSignUp && <p className="text-xs text-slate-400 mb-2">Create a new account</p>}
        
        <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Email Address" />
        {!isForgotPasswordView && <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Password" />}
        
        <button type="submit" disabled={authLoading} className="w-full bg-[#6BAEE0] hover:bg-[#5da0cf] text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-100">
          {authLoading ? "Processing..." : isForgotPasswordView ? "Send Reset Link" : isSignUp ? "Create Account" : "Sign In"}
        </button>

        <div className="flex gap-2 pt-2">
          {isForgotPasswordView ? (
            <button type="button" onClick={() => setIsForgotPasswordView(false)} className="w-full bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Back to Sign In</button>
          ) : (
            <>
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="flex-1 bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">
                {isSignUp ? "Sign In Instead" : "Create Account"}
              </button>
              {!isSignUp && <button type="button" onClick={() => setIsForgotPasswordView(true)} className="flex-1 bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Forgot</button>}
            </>
          )}
        </div>
      </form>
    </div>
  );
}