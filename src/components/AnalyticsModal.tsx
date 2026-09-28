import React, { useEffect, useState } from "react";
import { api } from "../api";
import { WorkoutSession, AnalyticsData } from "../types";
import { X, Calendar, Award, Flame, Dumbbell, Trash2, RefreshCw, Database } from "lucide-react";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionDeleted?: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  onSessionDeleted,
}) => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessRes, analRes] = await Promise.all([
        api.getSessions(50),
        api.getAnalytics(),
      ]);
      setSessions(sessRes.sessions);
      setAnalytics(analRes);
    } catch (err: any) {
      setError(err.message || "Failed to load workout history from MongoDB.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this workout record?")) return;
    try {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s._id !== id));
      if (onSessionDeleted) onSessionDeleted();
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete session.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0e1f2e] border border-[#1a3448] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a3448] bg-[#0c1a28] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#14293a] border border-[#1f5a68] flex items-center justify-center text-[#35d0e8]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-[#eaf3fa] tracking-wide">
                MongoDB Workout Analytics & History
              </h2>
              <p className="text-xs text-[#9db3c2]">
                Detailed logs, rep biomechanics, and form scores stored in your database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-[#0e2434] hover:bg-[#14293a] text-[#9db3c2] hover:text-[#35d0e8] border border-[#1a3448] transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9db3c2] hover:text-[#eaf3fa] hover:bg-[#0e2434] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Stat Cards */}
          {analytics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-3.5">
                <div className="text-[11px] text-[#5c7a8e] uppercase font-semibold flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-[#35d0e8]" />
                  Total Sessions
                </div>
                <div className="font-display text-2xl font-bold text-[#eaf3fa]">
                  {analytics.totalSessions}
                </div>
              </div>

              <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-3.5">
                <div className="text-[11px] text-[#5c7a8e] uppercase font-semibold flex items-center gap-1.5 mb-1">
                  <Dumbbell className="w-3.5 h-3.5 text-[#35d0e8]" />
                  All-Time Reps
                </div>
                <div className="font-display text-2xl font-bold text-[#eaf3fa]">
                  {analytics.totalReps}
                </div>
              </div>

              <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-3.5">
                <div className="text-[11px] text-[#5c7a8e] uppercase font-semibold flex items-center gap-1.5 mb-1">
                  <Award className="w-3.5 h-3.5 text-[#f5a83c]" />
                  Avg Form Score
                </div>
                <div className="font-display text-2xl font-bold text-[#3ddc97]">
                  {analytics.overallAvgScore}%
                </div>
              </div>

              <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-3.5">
                <div className="text-[11px] text-[#5c7a8e] uppercase font-semibold flex items-center gap-1.5 mb-1">
                  <Flame className="w-3.5 h-3.5 text-[#ef6461]" />
                  Calories Burned
                </div>
                <div className="font-display text-2xl font-bold text-[#eaf3fa]">
                  {analytics.totalCalories} <span className="text-xs font-normal text-[#5c7a8e]">kcal</span>
                </div>
              </div>
            </div>
          )}

          {/* Session History List */}
          <div>
            <h3 className="font-display text-sm font-semibold text-[#eaf3fa] tracking-wider uppercase mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8]" />
              Logged Workout Sessions
            </h3>

            {loading && sessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#9db3c2]">
                Loading records from database...
              </div>
            ) : error ? (
              <div className="py-8 text-center text-xs text-[#ef6461] bg-[#ef6461]/10 rounded-xl border border-[#ef6461]/30">
                {error}
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#5c7a8e] bg-[#091522] rounded-xl border border-[#1a3448]">
                No logged workout sessions found. Complete a squat set and stop the camera to automatically log your first session to MongoDB!
              </div>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((s) => {
                  const dateFormatted = new Date(s.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const durationMin = Math.floor(s.durationSeconds / 60);
                  const durationSec = s.durationSeconds % 60;
                  const durationText = `${String(durationMin).padStart(2, "0")}:${String(durationSec).padStart(2, "0")}`;

                  return (
                    <div
                      key={s._id}
                      className="bg-[#091522] border border-[#1a3448] hover:border-[#2b5468] rounded-xl p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-display font-bold text-sm text-[#eaf3fa]">
                            {s.exercise.toUpperCase()}
                          </span>
                          <span className="text-[11px] font-mono text-[#5c7a8e]">{dateFormatted}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9db3c2]">
                          <span>
                            Reps: <strong className="text-[#eaf3fa]">{s.reps}</strong> / {s.targetReps}
                          </span>
                          <span>•</span>
                          <span>Time: <strong className="text-[#eaf3fa]">{durationText}</strong></span>
                          <span>•</span>
                          <span>Calories: <strong className="text-[#eaf3fa]">{s.calories} kcal</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <div className="text-[10px] text-[#5c7a8e] uppercase font-semibold">
                            Correctness
                          </div>
                          <div
                            className={`font-display font-bold text-base ${
                              s.avgScore >= 80
                                ? "text-[#3ddc97]"
                                : s.avgScore >= 60
                                ? "text-[#f5a83c]"
                                : "text-[#ef6461]"
                            }`}
                          >
                            {s.avgScore}%
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(s._id)}
                          className="p-2 rounded-lg bg-[#0e2434] hover:bg-[#ef6461]/20 text-[#5c7a8e] hover:text-[#ef6461] transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
