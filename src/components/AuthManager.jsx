import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthManager() {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'apple' | null
  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);

  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      alert(err.message);
      setOauthLoading(null);
    }
  };

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
      
      {!isForgotPasswordView && (
        <div className="mt-6 space-y-3 font-sans">
          {/* Google */}
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={!!oauthLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-slate-300 py-3.5 rounded-xl text-sm font-bold text-slate-700 shadow-sm transition-all disabled:opacity-60"
          >
            {oauthLoading === 'google' ? (
              <span className="text-xs text-slate-400">Connecting…</span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Apple */}
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            disabled={!!oauthLoading}
            className="w-full flex items-center justify-center gap-3 bg-black hover:bg-slate-900 py-3.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all disabled:opacity-60"
          >
            {oauthLoading === 'apple' ? (
              <span className="text-xs text-white/60">Connecting…</span>
            ) : (
              <>
                <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                </svg>
                Continue with Apple
              </>
            )}
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
        </div>
      )}

      <form onSubmit={isForgotPasswordView ? handleResetPassword : handleAuthSubmit} className="space-y-4 font-sans">
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
              {!isSignUp && <button type="button" onClick={() => setIsForgotPasswordView(true)} className="flex-1 bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Forgot Password</button>}
            </>
          )}
        </div>
      </form>
    </div>
  );
}