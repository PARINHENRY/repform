import React from "react";
import { User } from "../types";
import { UserCheck, Target, Flame, Timer, Award } from "lucide-react";

interface LeftSidebarProps {
  reps: number;
  targetReps: number;
  sessionTimeText: string;
  avgScore: number | null;
  calories: number;
  bodyWeightKg: number;
  sessionsLoggedCount: number;
  bestScoreEver: number | null;
  user: User | null;
  onTargetRepsChange: (newTarget: number) => void;
  onBodyWeightChange: (newWeight: number) => void;
  onDisplayNameChange: (newName: string) => void;
  onOpenAuth: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  reps,
  targetReps,
  sessionTimeText,
  avgScore,
  calories,
  bodyWeightKg,
  sessionsLoggedCount,
  bestScoreEver,
  user,
  onTargetRepsChange,
  onBodyWeightChange,
  onDisplayNameChange,
  onOpenAuth,
}) => {
  const displayName = user?.displayName || "You";
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="flex flex-col gap-3.5 min-h-0 overflow-y-auto pr-1">
      {/* Session Metrics Panel */}
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
          Session Metrics
        </h2>

        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between py-1.5 border-b border-[#1a3448]">
            <span className="text-xs text-[#9db3c2]">Exercise</span>
            <span className="font-display font-semibold text-base text-[#eaf3fa]">Barbell / Bodyweight Squat</span>
          </div>

          <div className="flex items-baseline justify-between py-1.5 border-b border-[#1a3448]">
            <span className="text-xs text-[#9db3c2] flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#35d0e8]" />
              Reps
            </span>
            <span className="font-display font-bold text-2xl text-[#eaf3fa]">
              {reps} <span className="text-sm font-normal text-[#5c7a8e]">/ {targetReps}</span>
            </span>
          </div>

          <div className="flex items-baseline justify-between py-1.5 border-b border-[#1a3448]">
            <span className="text-xs text-[#9db3c2] flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-[#9db3c2]" />
              Session Time
            </span>
            <span className="font-display font-semibold text-lg text-[#eaf3fa] font-mono">
              {sessionTimeText}
            </span>
          </div>

          <div className="flex items-baseline justify-between py-1.5 border-b border-[#1a3448]">
            <span className="text-xs text-[#9db3c2] flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#f5a83c]" />
              Correctness
            </span>
            <span
              className={`font-display font-bold text-lg ${
                avgScore === null
                  ? "text-[#5c7a8e]"
                  : avgScore >= 80
                  ? "text-[#3ddc97]"
                  : avgScore >= 60
                  ? "text-[#f5a83c]"
                  : "text-[#ef6461]"
              }`}
            >
              {avgScore !== null ? `${avgScore}%` : "—"}
            </span>
          </div>

          <div className="flex items-baseline justify-between py-1.5 border-b border-[#1a3448]">
            <span className="text-xs text-[#9db3c2] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#ef6461]" />
              Est. Calories
            </span>
            <span className="font-display font-semibold text-lg text-[#eaf3fa]">
              {calories} <span className="text-xs font-normal text-[#5c7a8e]">kcal</span>
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-[#9db3c2]">
            <span>Target reps</span>
            <input
              type="number"
              min="1"
              max="99"
              value={targetReps}
              onChange={(e) => onTargetRepsChange(parseInt(e.target.value, 10) || 15)}
              className="w-14 bg-[#0e2434] border border-[#1a3448] text-[#eaf3fa] rounded-md px-2 py-1 text-center font-display font-semibold text-xs outline-none focus:border-[#35d0e8]"
            />
          </div>
        </div>
      </div>

      {/* User Profile Panel */}
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
          Athlete Profile
        </h2>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2b5468] to-[#16283a] border border-[#1a3448] flex items-center justify-center font-display text-lg font-bold text-[#35d0e8] shrink-0">
            {avatarInitial}
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-[#1a3448] focus:border-[#35d0e8] text-[#eaf3fa] font-semibold text-sm w-full outline-none transition-colors"
              placeholder="Your Name"
            />
            <div className="text-[11px] text-[#5c7a8e] mt-0.5">
              Sessions logged: {sessionsLoggedCount}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-baseline justify-between py-1.5 border-b border-[#1a3448]">
            <span className="text-xs text-[#9db3c2]">Best session score</span>
            <span className="font-display font-bold text-base text-[#3ddc97]">
              {bestScoreEver !== null && bestScoreEver > 0 ? `${bestScoreEver}%` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 text-xs text-[#9db3c2]">
            <span>Body weight (kg)</span>
            <input
              type="number"
              min="30"
              max="200"
              value={bodyWeightKg}
              onChange={(e) => onBodyWeightChange(parseInt(e.target.value, 10) || 70)}
              className="w-14 bg-[#0e2434] border border-[#1a3448] text-[#eaf3fa] rounded-md px-2 py-1 text-center font-display font-semibold text-xs outline-none focus:border-[#35d0e8]"
            />
          </div>

          {!user && (
            <div className="mt-3 pt-2 border-t border-[#1a3448]">
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full py-1.5 px-3 rounded-lg bg-[#0e2434] hover:bg-[#14293a] border border-[#1a3448] hover:border-[#35d0e8] text-[#35d0e8] text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Sign in to sync to MongoDB
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
