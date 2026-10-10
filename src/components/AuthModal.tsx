import React, { useState } from "react";
import { api } from "../api";
import { User } from "../types";
import { X, LogIn, UserPlus, Sparkles, AlertCircle, CheckCircle } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bodyWeightKg, setBodyWeightKg] = useState("70");
  const [targetReps, setTargetReps] = useState("15");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await api.login({ email, password });
        setSuccessMsg("Logged in successfully!");
        setTimeout(() => {
          onAuthSuccess(res.user);
          onClose();
        }, 500);
      } else {
        const res = await api.register({
          email,
          password,
          displayName: displayName || undefined,
          bodyWeightKg: Number(bodyWeightKg) || 70,
          targetReps: Number(targetReps) || 15,
        });
        setSuccessMsg("Account created and logged in!");
        setTimeout(() => {
          onAuthSuccess(res.user);
          onClose();
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.demoLogin();
      setSuccessMsg("Logged in as Demo Athlete!");
      setTimeout(() => {
        onAuthSuccess(res.user);
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Failed to log in with demo account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#0e1f2e] border border-[#1a3448] w-full max-w-md rounded-xl shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9db3c2] hover:text-[#eaf3fa] p-1 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-[#35d0e8] to-[#1a8fa3] flex items-center justify-center font-display font-bold text-[#03181e] text-xs">
            K
          </div>
          <h2 className="font-display text-lg font-bold text-[#eaf3fa] tracking-wide">
            {mode === "login" ? "Athlete Sign In" : "Create Athlete Account"}
          </h2>
        </div>
        <p className="text-xs text-[#9db3c2] mb-5">
          {mode === "login"
            ? "Sign in to sync your squat reps, form analysis, and progress to MongoDB."
            : "Register your profile for personalized rep targets and secure history tracking."}
        </p>

        {/* Demo Quick Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[#14293a] border border-[#1f5a68] text-[#35d0e8] hover:bg-[#1a3952] transition-colors font-medium text-xs shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[#f5a83c]" />
            Instant Demo Account (1-Click Login)
          </button>
        </div>

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-[1px] bg-[#1a3448]" />
          <span className="text-[11px] text-[#5c7a8e] uppercase font-mono">or email sign in</span>
          <div className="flex-1 h-[1px] bg-[#1a3448]" />
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#ef6461]/15 border border-[#ef6461]/30 text-[#ef6461] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-[#3ddc97]/15 border border-[#3ddc97]/30 text-[#3ddc97] text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-[#9db3c2] mb-1 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="athlete@domain.com"
              className="w-full bg-[#0c1a28] border border-[#1a3448] focus:border-[#35d0e8] text-[#eaf3fa] text-xs rounded-lg px-3 py-2 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#9db3c2] mb-1 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full bg-[#0c1a28] border border-[#1a3448] focus:border-[#35d0e8] text-[#eaf3fa] text-xs rounded-lg px-3 py-2 outline-none transition-colors"
            />
          </div>

          {mode === "register" && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-[#9db3c2] mb-1 uppercase tracking-wider">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full bg-[#0c1a28] border border-[#1a3448] focus:border-[#35d0e8] text-[#eaf3fa] text-xs rounded-lg px-3 py-2 outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9db3c2] mb-1 uppercase tracking-wider">
                    Body Weight (kg)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="250"
                    value={bodyWeightKg}
                    onChange={(e) => setBodyWeightKg(e.target.value)}
                    className="w-full bg-[#0c1a28] border border-[#1a3448] focus:border-[#35d0e8] text-[#eaf3fa] text-xs rounded-lg px-3 py-2 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#9db3c2] mb-1 uppercase tracking-wider">
                    Target Reps
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={targetReps}
                    onChange={(e) => setTargetReps(e.target.value)}
                    className="w-full bg-[#0c1a28] border border-[#1a3448] focus:border-[#35d0e8] text-[#eaf3fa] text-xs rounded-lg px-3 py-2 outline-none transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#35d0e8] hover:bg-[#4fdcef] text-[#04191f] font-semibold text-xs tracking-wide transition-all shadow-md shadow-[#35d0e8]/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse">Processing...</span>
            ) : mode === "login" ? (
              <>
                <LogIn className="w-4 h-4" />
                Sign In to Account
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Create Account
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-4 pt-3 border-t border-[#1a3448] text-center text-xs text-[#9db3c2]">
          {mode === "login" ? (
            <span>
              Don't have an account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className="text-[#35d0e8] font-semibold hover:underline"
              >
                Register here
              </button>
            </span>
          ) : (
            <span>
              Already registered?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="text-[#35d0e8] font-semibold hover:underline"
              >
                Sign in here
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
