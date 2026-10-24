import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export const LoginPage: React.FC = () => {
  const { devLogin, isDevLoggingIn } = useAuth();
  const [emailInput, setEmailInput] = useState("oliver.brown@domain.io");
  const [passwordInput, setPasswordInput] = useState("••••••••");

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:4000/api/auth/google";
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    devLogin({ email: emailInput, name: emailInput.split("@")[0] });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-black tracking-tight text-gray-900 font-sans">
          ONB
        </h1>
        <p className="text-xs text-gray-500 font-medium mt-1">
          ReachInbox Email Scheduler
        </p>
      </div>

      {/* Login Card matching Figma Screen 1 */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-center text-gray-900 mb-6">
          Login
        </h2>

        {/* Real Google OAuth Login Button */}
        <button
          id="btn-google-login"
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 text-sm font-semibold text-gray-700 shadow-sm transition mb-5"
        >
          {/* Official Google G Logo */}
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Login with Google
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-gray-100 w-full" />
          <span className="bg-white px-3 text-[11px] text-gray-400 uppercase tracking-wider shrink-0">
            Or sign up through email
          </span>
          <div className="border-t border-gray-100 w-full" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <input
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email ID"
              className="w-full text-xs py-2.5 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              className="w-full text-xs py-2.5 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {/* Primary Emerald Green Login Button */}
          <button
            id="btn-email-login"
            type="submit"
            disabled={isDevLoggingIn}
            className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition"
          >
            {isDevLoggingIn ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-50 text-center">
          <span className="text-[11px] text-gray-400 block">
            Clicking &quot;Login with Google&quot; uses real Google OAuth 2.0 PKCE.
          </span>
          <button
            type="button"
            onClick={() => devLogin({ email: "oliver.brown@domain.io", name: "Oliver Brown" })}
            className="mt-2 text-xs text-brand-600 hover:underline font-semibold"
          >
            → Instant Demo Login as Oliver Brown (Figma)
          </button>
        </div>
      </div>
    </div>
  );
};
