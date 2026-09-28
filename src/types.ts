export interface User {
  _id: string;
  email: string;
  displayName: string;
  bodyWeightKg: number;
  targetReps: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface WorkoutSession {
  _id: string;
  userId: string;
  exercise: string;
  reps: number;
  targetReps: number;
  durationSeconds: number;
  calories: number;
  avgScore: number;
  bestScore: number;
  repScores: number[];
  flagsSummary: {
    valgusDetectedCount: number;
    forwardLeanCount: number;
    shallowDepthCount: number;
    optimalDepthCount: number;
  };
  notes?: string;
  createdAt: string;
}

export interface AnalyticsData {
  last7Days: {
    date: string;
    dayLabel: string;
    reps: number;
    avgScore: number;
    count: number;
  }[];
  totalSessions: number;
  totalReps: number;
  totalCalories: number;
  overallAvgScore: number;
  bestScoreEver: number;
}

export interface TodayStats {
  repsToday: number;
  caloriesToday: number;
  avgScoreToday: number | null;
  sessionsCountToday: number;
}

export interface DbStatus {
  mode: "mongodb_atlas" | "embedded_store";
  connected: boolean;
  uriConfigured: boolean;
  message: string;
  databaseName?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  database: DbStatus;
}

export interface PoseSignals {
  kneeAngle: number;
  valgus: boolean;
  forwardLean: boolean;
  torsoAngle: number | null;
}

export interface TechniqueFeedback {
  depth: { text: string; status: "neutral" | "good" | "warn" | "bad" };
  knee: { text: string; status: "neutral" | "good" | "warn" | "bad" };
  core: { text: string; status: "neutral" | "good" | "warn" | "bad" };
  angle: { text: string; status: "neutral" | "good" | "warn" | "bad" };
}
