import {
  AuthResponse,
  HealthResponse,
  TodayStats,
  AnalyticsData,
  WorkoutSession,
  User,
} from "./types";

const TOKEN_KEY = "repform_jwt_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore localStorage errors
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({ error: "Failed to parse response." }));

  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }

  return data as T;
}

export const api = {
  // System Health & MongoDB Status
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/api/health");
  },

  // Authentication
  async register(data: {
    email: string;
    password: string;
    displayName?: string;
    bodyWeightKg?: number;
    targetReps?: number;
  }): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setStoredToken(res.token);
    return res;
  },

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setStoredToken(res.token);
    return res;
  },

  async demoLogin(): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/api/auth/demo", {
      method: "POST",
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>("/api/auth/me");
  },

  async updateProfile(data: {
    displayName?: string;
    bodyWeightKg?: number;
    targetReps?: number;
  }): Promise<{ message: string; user: User }> {
    return request<{ message: string; user: User }>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Sessions & Analytics
  async saveSession(data: {
    exercise?: string;
    reps: number;
    targetReps?: number;
    durationSeconds?: number;
    calories?: number;
    avgScore?: number;
    bestScore?: number;
    repScores?: number[];
    flagsSummary?: {
      valgusDetectedCount: number;
      forwardLeanCount: number;
      shallowDepthCount: number;
      optimalDepthCount: number;
    };
    notes?: string;
  }): Promise<{ message: string; session: WorkoutSession }> {
    return request<{ message: string; session: WorkoutSession }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getSessions(limit = 20): Promise<{ sessions: WorkoutSession[]; totalCount: number }> {
    return request<{ sessions: WorkoutSession[]; totalCount: number }>(`/api/sessions?limit=${limit}`);
  },

  async getTodayStats(): Promise<TodayStats> {
    return request<TodayStats>("/api/sessions/today");
  },

  async getAnalytics(): Promise<AnalyticsData> {
    return request<AnalyticsData>("/api/sessions/analytics");
  },

  async deleteSession(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/sessions/${id}`, {
      method: "DELETE",
    });
  },
};
