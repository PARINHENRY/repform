import { Router, Response } from "express";
import { WorkoutSession, IWorkoutSession } from "../db.js";
import { requireAuth, AuthRequest } from "../auth.js";

const router = Router();

// All session routes require authentication
router.use(requireAuth);

// -------------------------------------------------------------
// POST /api/sessions (Create a logged workout session)
// -------------------------------------------------------------
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      exercise = "squat",
      reps,
      targetReps = 15,
      durationSeconds = 0,
      calories = 0,
      avgScore = 0,
      bestScore = 0,
      repScores = [],
      flagsSummary = {
        valgusDetectedCount: 0,
        forwardLeanCount: 0,
        shallowDepthCount: 0,
        optimalDepthCount: 0,
      },
      notes = "",
    } = req.body;

    if (reps === undefined || reps === null || typeof reps !== "number") {
      res.status(400).json({ error: "Field 'reps' is required and must be a number." });
      return;
    }

    const session = await WorkoutSession.create({
      userId: req.userId!,
      exercise: String(exercise || "squat"),
      reps: Math.max(0, Math.round(reps)),
      targetReps: Math.max(1, Math.round(Number(targetReps) || 15)),
      durationSeconds: Math.max(0, Math.round(Number(durationSeconds) || 0)),
      calories: Math.max(0, Math.round(Number(calories) || 0)),
      avgScore: Math.max(0, Math.min(100, Math.round(Number(avgScore) || 0))),
      bestScore: Math.max(0, Math.min(100, Math.round(Number(bestScore) || 0))),
      repScores: Array.isArray(repScores) ? repScores.map((s: any) => Number(s) || 0) : [],
      flagsSummary: {
        valgusDetectedCount: Number(flagsSummary?.valgusDetectedCount) || 0,
        forwardLeanCount: Number(flagsSummary?.forwardLeanCount) || 0,
        shallowDepthCount: Number(flagsSummary?.shallowDepthCount) || 0,
        optimalDepthCount: Number(flagsSummary?.optimalDepthCount) || 0,
      },
      notes: typeof notes === "string" ? notes.slice(0, 500) : "",
    });

    res.status(201).json({
      message: "Workout session saved successfully",
      session,
    });
  } catch (err: any) {
    console.error("[CreateSession] Error:", err);
    res.status(500).json({ error: err.message || "Failed to log workout session." });
  }
});

// -------------------------------------------------------------
// GET /api/sessions (List user workout sessions)
// -------------------------------------------------------------
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const sessions = await (await WorkoutSession.find({ userId: req.userId! })).sort({ createdAt: -1 }).limit(limit);
    const totalCount = await WorkoutSession.countDocuments({ userId: req.userId! });

    res.json({
      sessions,
      totalCount,
      limit,
    });
  } catch (err: any) {
    console.error("[GetSessions] Error:", err);
    res.status(500).json({ error: "Failed to retrieve workout sessions." });
  }
});

// -------------------------------------------------------------
// GET /api/sessions/today (Today's statistics)
// -------------------------------------------------------------
router.get("/today", async (req: AuthRequest, res: Response) => {
  try {
    const all = await (await WorkoutSession.find({ userId: req.userId! })).exec();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySessions = all.filter((s) => new Date(s.createdAt) >= today);

    const repsToday = todaySessions.reduce((sum, s) => sum + s.reps, 0);
    const caloriesToday = todaySessions.reduce((sum, s) => sum + s.calories, 0);
    const scores = todaySessions.flatMap((s) => s.repScores || []);
    const avgScoreToday = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    res.json({
      repsToday,
      caloriesToday,
      avgScoreToday,
      sessionsCountToday: todaySessions.length,
    });
  } catch (err: any) {
    console.error("[TodayStats] Error:", err);
    res.status(500).json({ error: "Failed to compute today's stats." });
  }
});

// -------------------------------------------------------------
// GET /api/sessions/analytics (Last 7 days and overall summary)
// -------------------------------------------------------------
router.get("/analytics", async (req: AuthRequest, res: Response) => {
  try {
    const all = await (await WorkoutSession.find({ userId: req.userId! })).exec();

    // Generate 7-day day buckets
    const now = new Date();
    const last7Days: { date: string; dayLabel: string; reps: number; avgScore: number; count: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });

      const daySessions = all.filter((s) => {
        const sDate = new Date(s.createdAt).toISOString().split("T")[0];
        return sDate === dateStr;
      });

      const dayReps = daySessions.reduce((sum, s) => sum + s.reps, 0);
      const dayScores = daySessions.flatMap((s) => s.repScores || []);
      const dayAvgScore = dayScores.length > 0 ? Math.round(dayScores.reduce((a, b) => a + b, 0) / dayScores.length) : 0;

      last7Days.push({
        date: dateStr,
        dayLabel,
        reps: dayReps,
        avgScore: dayAvgScore,
        count: daySessions.length,
      });
    }

    // Overall metrics
    const totalSessions = all.length;
    const totalReps = all.reduce((sum, s) => sum + s.reps, 0);
    const totalCalories = all.reduce((sum, s) => sum + s.calories, 0);
    const allScores = all.flatMap((s) => s.repScores || []);
    const overallAvgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
    const bestScoreEver = all.reduce((max, s) => Math.max(max, s.bestScore || s.avgScore || 0), 0);

    res.json({
      last7Days,
      totalSessions,
      totalReps,
      totalCalories,
      overallAvgScore,
      bestScoreEver,
    });
  } catch (err: any) {
    console.error("[Analytics] Error:", err);
    res.status(500).json({ error: "Failed to compute analytics." });
  }
});

// -------------------------------------------------------------
// DELETE /api/sessions/:id (Delete a workout session)
// -------------------------------------------------------------
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await WorkoutSession.findByIdAndDelete(req.params.id, req.userId!);
    if (!deleted) {
      res.status(404).json({ error: "Session not found or unauthorized." });
      return;
    }
    res.json({ message: "Session removed successfully." });
  } catch (err: any) {
    console.error("[DeleteSession] Error:", err);
    res.status(500).json({ error: "Failed to delete session." });
  }
});

export default router;
