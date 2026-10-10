import React, { useState, useEffect, useRef, useCallback } from "react";
import { api, getStoredToken, clearStoredToken } from "./api";
import {
  User,
  DbStatus,
  TechniqueFeedback,
  PoseSignals,
  AnalyticsData,
  TodayStats,
} from "./types";
import { Topbar } from "./components/Topbar";
import { LeftSidebar } from "./components/LeftSidebar";
import { RightSidebar } from "./components/RightSidebar";
import { PoseTracker } from "./components/PoseTracker";
import { AuthModal } from "./components/AuthModal";
import { AnalyticsModal } from "./components/AnalyticsModal";
import { SettingsModal } from "./components/SettingsModal";
import { SurveyModal } from "./components/SurveyModal";
import { CheckCircle2 } from "lucide-react";

export default function App() {
  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<"live" | "analytics" | "settings">("live");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(true);

  // User & DB Status
  const [user, setUser] = useState<User | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  // Live Workout State
  const [reps, setReps] = useState(0);
  const [targetReps, setTargetReps] = useState(15);
  const [bodyWeightKg, setBodyWeightKg] = useState(70);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionTimeText, setSessionTimeText] = useState("00:00");
  const [repScores, setRepScores] = useState<number[]>([]);
  const [calories, setCalories] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Cumulative Form Flags for the Session
  const sessionFlagsRef = useRef({
    valgusDetectedCount: 0,
    forwardLeanCount: 0,
    shallowDepthCount: 0,
    optimalDepthCount: 0,
  });

  // History & Analytics
  const [todayStats, setTodayStats] = useState<TodayStats>({
    repsToday: 0,
    caloriesToday: 0,
    avgScoreToday: null,
    sessionsCountToday: 0,
  });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Toast Notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Live Technique Feedback
  const [feedback, setFeedback] = useState<TechniqueFeedback>({
    depth: { text: "Waiting for camera...", status: "neutral" },
    knee: { text: "—", status: "neutral" },
    core: { text: "—", status: "neutral" },
    angle: { text: "—", status: "neutral" },
  });

  // Sound generator using Web Audio API
  const playChime = useCallback((freq = 587.33, duration = 0.15) => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  }, [soundEnabled]);

  // Toast helper
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Initial Load: Check DB Health & User Session
  useEffect(() => {
    const initApp = async () => {
      // Health Check
      try {
        const health = await api.getHealth();
        setDbStatus(health.database);
      } catch (err) {
        console.warn("[App] Health check failed:", err);
      }

      // Check current JWT session
      const token = getStoredToken();
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          setTargetReps(res.user.targetReps || 15);
          setBodyWeightKg(res.user.bodyWeightKg || 70);
        } catch {
          clearStoredToken();
          setUser(null);
        }
      }

      // Refresh Stats from backend
      loadBackendStats();
    };

    initApp();
  }, []);

  // Fetch today's stats and 7-day analytics from MongoDB
  const loadBackendStats = async () => {
    try {
      const [today, anal] = await Promise.all([
        api.getTodayStats(),
        api.getAnalytics(),
      ]);
      setTodayStats(today);
      setAnalytics(anal);
    } catch (err) {
      // If user is guest or endpoint returns 401, stats stay local
    }
  };

  // Timer & Calorie tick
  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
      const m = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
      const s = String(elapsedSec % 60).padStart(2, "0");
      setSessionTimeText(`${m}:${s}`);

      // Calorie estimation: MET 5.0 for bodyweight squats
      const minutes = elapsedSec / 60;
      const kcal = (5.0 * 3.5 * bodyWeightKg) / 200 * minutes;
      setCalories(Math.max(0, Math.round(kcal)));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime, bodyWeightKg]);

  // Handle Rep Completed
  const handleRepComplete = useCallback(
    (score: number, minKneeAngle: number, flags: { valgus: boolean; forwardLean: boolean }) => {
      // Start session timer on first rep if not started
      if (!sessionStartTime) {
        setSessionStartTime(Date.now());
      }

      setReps((prev) => {
        const next = prev + 1;
        // Sound feedback
        if (score >= 80) playChime(880, 0.18); // High chime
        else playChime(440, 0.15); // Standard chime

        return next;
      });

      setRepScores((prev) => [...prev, score]);

      // Record flags
      if (flags.valgus) sessionFlagsRef.current.valgusDetectedCount += 1;
      if (flags.forwardLean) sessionFlagsRef.current.forwardLeanCount += 1;
      if (minKneeAngle <= 100) sessionFlagsRef.current.optimalDepthCount += 1;
      else if (minKneeAngle > 125) sessionFlagsRef.current.shallowDepthCount += 1;
    },
    [sessionStartTime, playChime]
  );

  // Save completed session to MongoDB
  const saveWorkoutToMongoDB = useCallback(async () => {
    if (repScores.length === 0 && reps === 0) return;

    const durationSeconds = sessionStartTime
      ? Math.floor((Date.now() - sessionStartTime) / 1000)
      : 0;

    const avg =
      repScores.length > 0
        ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length)
        : 0;
    const best = repScores.reduce((m, s) => Math.max(m, s), 0);

    try {
      // If user is guest, auto-log in as demo or prompt to save
      if (!user) {
        await api.demoLogin();
        const me = await api.getMe();
        setUser(me.user);
      }

      await api.saveSession({
        exercise: "squat",
        reps,
        targetReps,
        durationSeconds,
        calories,
        avgScore: avg,
        bestScore: best,
        repScores,
        flagsSummary: { ...sessionFlagsRef.current },
      });

      showToast(`Workout saved: ${reps} reps logged to MongoDB!`);
      loadBackendStats();
    } catch (err: any) {
      console.warn("[App] Save session error:", err);
    }
  }, [repScores, reps, sessionStartTime, calories, targetReps, user]);

  // Reset Session
  const handleResetSession = () => {
    if (reps > 0) {
      saveWorkoutToMongoDB();
    }
    setReps(0);
    setRepScores([]);
    setSessionStartTime(null);
    setSessionTimeText("00:00");
    setCalories(0);
    sessionFlagsRef.current = {
      valgusDetectedCount: 0,
      forwardLeanCount: 0,
      shallowDepthCount: 0,
      optimalDepthCount: 0,
    };
  };

  // Calculate overall average correctness for current session
  const currentAvgScore =
    repScores.length > 0
      ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length)
      : null;

  // Best score ever: combination of MongoDB analytics & current session
  const bestScoreEver = Math.max(
    analytics?.bestScoreEver || 0,
    currentAvgScore || 0
  );

  // Total reps today
  const totalRepsToday = (todayStats?.repsToday || 0) + reps;

  // Sessions logged count
  const sessionsLoggedCount = (analytics?.totalSessions || 0) + (reps > 0 ? 1 : 0);

  // Handlers for auth
  const handleAuthSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setTargetReps(authenticatedUser.targetReps || 15);
    setBodyWeightKg(authenticatedUser.bodyWeightKg || 70);
    loadBackendStats();
    showToast(`Welcome back, ${authenticatedUser.displayName}!`);
  };

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    showToast("Signed out successfully.");
  };

  const handleQuickDemo = async () => {
    try {
      const res = await api.demoLogin();
      handleAuthSuccess(res.user);
    } catch (err: any) {
      alert(err.message || "Failed to log in as demo athlete.");
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a141f] text-[#eaf3fa] font-body select-none">
      {/* Topbar */}
      <Topbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === "analytics") setShowAnalyticsModal(true);
          if (tab === "settings") setShowSettingsModal(true);
        }}
        user={user}
        dbStatus={dbStatus}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onQuickDemo={handleQuickDemo}
        onOpenSurvey={() => setShowSurveyModal(true)}
      />

      {/* Main Grid Layout */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[270px_1fr_300px] gap-3.5 p-3.5">
        {/* Left Sidebar */}
        <LeftSidebar
          reps={reps}
          targetReps={targetReps}
          sessionTimeText={sessionTimeText}
          avgScore={currentAvgScore}
          calories={calories}
          bodyWeightKg={bodyWeightKg}
          sessionsLoggedCount={sessionsLoggedCount}
          bestScoreEver={bestScoreEver > 0 ? bestScoreEver : null}
          user={user}
          onTargetRepsChange={(newTarget) => setTargetReps(newTarget)}
          onBodyWeightChange={(newWeight) => setBodyWeightKg(newWeight)}
          onDisplayNameChange={(newName) => {
            if (user) {
              setUser({ ...user, displayName: newName });
            }
          }}
          onOpenAuth={() => setShowAuthModal(true)}
        />

        {/* Center: Live Pose Tracker Stage & Mini Graphs */}
        <PoseTracker
          onRepComplete={handleRepComplete}
          onSignalsUpdate={() => {}}
          onFeedbackUpdate={setFeedback}
          repScores={repScores}
          onResetSession={handleResetSession}
        />

        {/* Right Sidebar */}
        <RightSidebar
          feedback={feedback}
          todayReps={totalRepsToday}
          analytics={analytics}
        />
      </main>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0e2434] border border-[#35d0e8]/50 text-[#eaf3fa] text-xs shadow-xl shadow-black/60 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#3ddc97]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Modals */}
      <SurveyModal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <AnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => {
          setShowAnalyticsModal(false);
          setActiveTab("live");
        }}
        onSessionDeleted={loadBackendStats}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          setActiveTab("live");
        }}
        user={user}
        dbStatus={dbStatus}
        onProfileUpdated={(updatedUser) => {
          setUser(updatedUser);
          setTargetReps(updatedUser.targetReps || 15);
          setBodyWeightKg(updatedUser.bodyWeightKg || 70);
        }}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
      />
    </div>
  );
}
