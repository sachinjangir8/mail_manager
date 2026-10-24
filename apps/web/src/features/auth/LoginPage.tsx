import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { API_BASE, ApiError } from "../../lib/api";

export const LoginPage: React.FC = () => {
  const { login, signup, devLogin, isLoggingIn, isSigningUp, isDevLoggingIn } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSubmitting = isLoggingIn || isSigningUp || isDevLoggingIn;

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!emailInput.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!passwordInput || passwordInput.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    try {
      if (isSignUp) {
        await signup({
          email: emailInput.trim(),
          password: passwordInput,
          name: nameInput.trim() || undefined,
        });
      } else {
        await login({
          email: emailInput.trim(),
          password: passwordInput,
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Authentication failed. Please check your credentials.");
      }
    }
  };

  const handleFillDemo = () => {
    setErrorMsg(null);
    devLogin({ email: "oliver.brown@domain.io", name: "Oliver Brown" });
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

      {/* Auth Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-center text-gray-900 mb-6">
          {isSignUp ? "Create an Account" : "Login"}
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
          {isSignUp ? "Sign up with Google" : "Login with Google"}
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-gray-100 w-full" />
          <span className="bg-white px-3 text-[11px] text-gray-400 uppercase tracking-wider shrink-0">
            {isSignUp ? "Or sign up with email" : "Or sign in with email"}
          </span>
          <div className="border-t border-gray-100 w-full" />
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
            <span className="shrink-0 font-bold">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Full Name
              </label>
              <input
                id="input-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Sachin Jangir"
                className="w-full text-xs py-2.5 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Email ID
            </label>
            <input
              id="input-email"
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@domain.com"
              className="w-full text-xs py-2.5 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Password {isSignUp && <span className="text-gray-400 font-normal">(min. 6 characters)</span>}
            </label>
            <input
              id="input-password"
              type="password"
              required
              minLength={6}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs py-2.5 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {/* Primary Submit Button */}
          <button
            id="btn-auth-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition"
          >
            {isSubmitting
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
              ? "Sign Up"
              : "Login"}
          </button>
        </form>

        {/* Toggle between Sign Up and Login */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
            }}
            className="text-xs text-gray-600 hover:text-brand-600 font-medium transition"
          >
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <span className="font-semibold text-brand-600 hover:underline">Log in</span>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <span className="font-semibold text-brand-600 hover:underline">Sign up</span>
              </>
            )}
          </button>
        </div>

        {/* Demo Login Link */}
        <div className="mt-5 pt-4 border-t border-gray-50 text-center">
          <span className="text-[11px] text-gray-400 block">
            Reviewer Demo Access
          </span>
          <button
            type="button"
            onClick={handleFillDemo}
            className="mt-1 text-xs text-brand-600 hover:underline font-semibold"
          >
            → Instant Demo Login as Oliver Brown (Figma)
          </button>
        </div>
      </div>
    </div>
  );
};
