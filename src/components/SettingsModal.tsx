import React, { useState } from "react";
import { api } from "../api";
import { User, DbStatus } from "../types";
import { X, Database, ShieldCheck, Save, Sliders, CheckCircle, Volume2 } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  dbStatus: DbStatus | null;
  onProfileUpdated: (updatedUser: User) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  dbStatus,
  onProfileUpdated,
  soundEnabled,
  onToggleSound,
}) => {
  const [displayName, setDisplayName] = useState(user?.displayName || "Athlete");
  const [bodyWeightKg, setBodyWeightKg] = useState(String(user?.bodyWeightKg || 70));
  const [targetReps, setTargetReps] = useState(String(user?.targetReps || 15));
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in or use Demo Login to save profile settings to the database.");
      return;
    }

    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await api.updateProfile({
        displayName,
        bodyWeightKg: Number(bodyWeightKg) || 70,
        targetReps: Number(targetReps) || 15,
      });
      onProfileUpdated(res.user);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0e1f2e] border border-[#1a3448] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a3448] bg-[#0c1a28] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#14293a] border border-[#1f5a68] flex items-center justify-center text-[#35d0e8]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-[#eaf3fa] tracking-wide">
                System & Profile Settings
              </h2>
              <p className="text-xs text-[#9db3c2]">Configure database connectivity and workout preferences</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9db3c2] hover:text-[#eaf3fa] hover:bg-[#0e2434] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Database Diagnostics */}
          <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#eaf3fa] flex items-center gap-2">
                <Database className="w-4 h-4 text-[#35d0e8]" />
                Backend & MongoDB Status
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                  dbStatus?.connected
                    ? "bg-[#3ddc97]/20 text-[#3ddc97] border border-[#3ddc97]/30"
                    : "bg-[#f5a83c]/20 text-[#f5a83c] border border-[#f5a83c]/30"
                }`}
              >
                {dbStatus?.mode === "mongodb_atlas" ? "MongoDB Atlas Active" : "Embedded MongoDB Mode"}
              </span>
            </div>

            <div className="text-xs text-[#9db3c2] leading-relaxed bg-[#0c1a28] p-3 rounded-lg border border-[#1a3448]">
              {dbStatus?.message}
            </div>

            <div className="text-[11px] text-[#5c7a8e] leading-normal">
              To connect to your own cloud MongoDB cluster, set <code className="text-[#35d0e8]">MONGODB_URI</code> in
              environment variables (e.g. <code className="text-[#9db3c2]">mongodb+srv://user:pass@cluster.mongodb.net/kayagni</code>).
            </div>
          </div>

          {/* Audio Cues Toggle */}
          <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0e2434] border border-[#1a3448] flex items-center justify-center text-[#35d0e8]">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#eaf3fa]">Audio Feedback Cues</div>
                <div className="text-[11px] text-[#9db3c2]">Plays subtle tone when optimal squat depth is reached</div>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleSound}
              className={`w-11 h-6 rounded-full transition-colors relative border ${
                soundEnabled ? "bg-[#35d0e8] border-[#35d0e8]" : "bg-[#16283a] border-[#1a3448]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                  soundEnabled ? "left-6 bg-[#03181e]" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Athlete Profile Preferences */}
          <form onSubmit={handleSave} className="space-y-4">
            <h3 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase">
              Athlete Profile Preferences
            </h3>

            <div>
              <label className="block text-[11px] font-semibold text-[#9db3c2] mb-1 uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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

            {savedSuccess && (
              <div className="p-2.5 rounded-lg bg-[#3ddc97]/15 border border-[#3ddc97]/30 text-[#3ddc97] text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Profile updated and synced to database!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 rounded-lg bg-[#35d0e8] hover:bg-[#4fdcef] text-[#04191f] font-semibold text-xs tracking-wide transition-all shadow-md shadow-[#35d0e8]/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving to Database..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
