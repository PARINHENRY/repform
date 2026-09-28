import React, { useRef, useEffect, useState, useCallback } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PoseSignals, TechniqueFeedback } from "../types";
import { Camera, RefreshCw, AlertTriangle, Eye, VideoOff, CheckCircle2 } from "lucide-react";

interface PoseTrackerProps {
  onRepComplete: (score: number, minKneeAngle: number, flags: { valgus: boolean; forwardLean: boolean }) => void;
  onSignalsUpdate: (signals: PoseSignals) => void;
  onFeedbackUpdate: (feedback: TechniqueFeedback) => void;
  repScores: number[];
  onResetSession: () => void;
}

const L = {
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
};

export const PoseTracker: React.FC<PoseTrackerProps> = ({
  onRepComplete,
  onSignalsUpdate,
  onFeedbackUpdate,
  repScores,
  onResetSession,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);

  // Mini graphs canvas refs
  const angleGraphRef = useRef<HTMLCanvasElement>(null);
  const repGraphRef = useRef<HTMLCanvasElement>(null);
  const accGraphRef = useRef<HTMLCanvasElement>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [statusKind, setStatusKind] = useState<"on" | "warn" | "loading">("warn");
  const [statusMsg, setStatusMsg] = useState("Camera is off");
  const [modelLoaded, setModelLoaded] = useState(false);

  // State refs for animation loop
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const repPhaseRef = useRef<"up" | "down">("up");
  const minAngleThisRepRef = useRef<number>(180);
  const repFlagsRef = useRef<{ valgus: boolean; forwardLean: boolean }>({ valgus: false, forwardLean: false });
  const angleHistoryRef = useRef<{ t: number; angle: number }[]>([]);
  const currentKneeAngleRef = useRef<number | null>(null);

  // Geometry calculations
  const calcAngleAt = (a: any, b: any, c: any) => {
    const abx = a.x - b.x;
    const aby = a.y - b.y;
    const cbx = c.x - b.x;
    const cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const magA = Math.hypot(abx, aby);
    const magC = Math.hypot(cbx, cby);
    if (magA === 0 || magC === 0) return null;
    let cos = dot / (magA * magC);
    cos = Math.min(1, Math.max(-1, cos));
    return Math.acos(cos) * (180 / Math.PI);
  };

  const isVisible = (lm: any[], idx: number, threshold = 0.35) => {
    const p = lm[idx];
    return p && (p.visibility === undefined || p.visibility >= threshold);
  };

  const calcMidpoint = (a: any, b: any) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const extractSignals = useCallback((lm: any[]): PoseSignals | null => {
    const haveLeft = isVisible(lm, L.L_HIP) && isVisible(lm, L.L_KNEE) && isVisible(lm, L.L_ANKLE);
    const haveRight = isVisible(lm, L.R_HIP) && isVisible(lm, L.R_KNEE) && isVisible(lm, L.R_ANKLE);
    if (!haveLeft && !haveRight) return null;

    const kneeAngles: number[] = [];
    if (haveLeft) {
      const a = calcAngleAt(lm[L.L_HIP], lm[L.L_KNEE], lm[L.L_ANKLE]);
      if (a !== null) kneeAngles.push(a);
    }
    if (haveRight) {
      const a = calcAngleAt(lm[L.R_HIP], lm[L.R_KNEE], lm[L.R_ANKLE]);
      if (a !== null) kneeAngles.push(a);
    }
    if (kneeAngles.length === 0) return null;
    const kneeAngle = kneeAngles.reduce((sum, v) => sum + v, 0) / kneeAngles.length;

    // Valgus check
    let valgus = false;
    if (haveLeft && haveRight) {
      const kneeDist = Math.abs(lm[L.L_KNEE].x - lm[L.R_KNEE].x);
      const ankleDist = Math.abs(lm[L.L_ANKLE].x - lm[L.R_ANKLE].x);
      if (ankleDist > 0.02) {
        valgus = kneeDist < ankleDist * 0.72;
      }
    }

    // Torso forward lean check
    let forwardLean = false;
    let torsoAngle: number | null = null;
    const haveShoulders = isVisible(lm, L.L_SHOULDER) && isVisible(lm, L.R_SHOULDER);
    const haveHips = isVisible(lm, L.L_HIP) && isVisible(lm, L.R_HIP);
    if (haveShoulders && haveHips) {
      const midHip = calcMidpoint(lm[L.L_HIP], lm[L.R_HIP]);
      const midShoulder = calcMidpoint(lm[L.L_SHOULDER], lm[L.R_SHOULDER]);
      const dx = midShoulder.x - midHip.x;
      const dy = midShoulder.y - midHip.y;
      torsoAngle = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
      forwardLean = torsoAngle > 38;
    }

    return { kneeAngle, valgus, forwardLean, torsoAngle };
  }, []);

  const updateFeedbackFromSignals = (sig: PoseSignals) => {
    // Depth feedback
    let depthFb: TechniqueFeedback["depth"];
    if (repPhaseRef.current === "down") {
      if (sig.kneeAngle <= 100) {
        depthFb = { text: "Optimal depth (≤100°)", status: "good" };
      } else if (sig.kneeAngle <= 125) {
        depthFb = { text: "Getting close — go slightly deeper", status: "warn" };
      } else {
        depthFb = { text: "Too shallow — descend lower", status: "warn" };
      }
    } else {
      depthFb = { text: "Ready — begin your descent", status: "neutral" };
    }

    // Knee valgus feedback
    const kneeFb: TechniqueFeedback["knee"] = sig.valgus
      ? { text: "Knees caving in — push outward", status: "bad" }
      : { text: "Tracking over toes cleanly", status: "good" };

    // Core feedback
    const coreFb: TechniqueFeedback["core"] = sig.forwardLean
      ? { text: "Excessive forward lean — brace core", status: "warn" }
      : { text: "Maintaining solid torso tension", status: "good" };

    // Angle text
    const angleFb: TechniqueFeedback["angle"] = {
      text: `${Math.round(sig.kneeAngle)}°`,
      status: sig.kneeAngle <= 100 ? "good" : "neutral",
    };

    onFeedbackUpdate({
      depth: depthFb,
      knee: kneeFb,
      core: coreFb,
      angle: angleFb,
    });
  };

  // Process signals inside animation frame
  const handleSignals = (sig: PoseSignals) => {
    const now = performance.now();
    currentKneeAngleRef.current = sig.kneeAngle;
    angleHistoryRef.current.push({ t: now, angle: sig.kneeAngle });

    // Keep last 10 seconds of angles
    const cutoff = now - 10000;
    while (angleHistoryRef.current.length && angleHistoryRef.current[0].t < cutoff) {
      angleHistoryRef.current.shift();
    }

    // Squat State Machine
    if (repPhaseRef.current === "up") {
      if (sig.kneeAngle < 140) {
        repPhaseRef.current = "down";
        minAngleThisRepRef.current = sig.kneeAngle;
        repFlagsRef.current = { valgus: false, forwardLean: false };
      }
    } else if (repPhaseRef.current === "down") {
      minAngleThisRepRef.current = Math.min(minAngleThisRepRef.current, sig.kneeAngle);
      if (sig.valgus) repFlagsRef.current.valgus = true;
      if (sig.forwardLean) repFlagsRef.current.forwardLean = true;

      // Completed rep
      if (sig.kneeAngle > 160) {
        const depthAngle = minAngleThisRepRef.current;
        let score = 100;
        if (depthAngle > 125) {
          score -= Math.min(45, (depthAngle - 125) * 1.1 + 15);
        } else if (depthAngle > 100) {
          score -= (depthAngle - 100) * 0.9;
        }
        if (repFlagsRef.current.valgus) score -= 25;
        if (repFlagsRef.current.forwardLean) score -= 18;
        score = Math.max(0, Math.round(score));

        onRepComplete(score, minAngleThisRepRef.current, { ...repFlagsRef.current });
        repPhaseRef.current = "up";
      }
    }

    onSignalsUpdate(sig);
    updateFeedbackFromSignals(sig);
    drawAngleGraph();
  };

  // Drawing overlay
  const renderOverlay = (landmarks: any[]) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks || landmarks.length === 0) return;

    const lm = landmarks[0];
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const cw = canvas.width;
    const ch = canvas.height;

    // Cover transform math
    const videoAspect = vw / vh;
    const boxAspect = cw / ch;
    let scale: number, offsetX = 0, offsetY = 0;
    if (videoAspect > boxAspect) {
      scale = ch / vh;
      offsetX = (vw * scale - cw) / 2;
    } else {
      scale = cw / vw;
      offsetY = (vh * scale - ch) / 2;
    }

    const toCanvasXY = (nx: number, ny: number) => ({
      x: nx * vw * scale - offsetX,
      y: ny * vh * scale - offsetY,
    });

    // Draw skeleton connections
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#35d0e8";
    ctx.shadowColor = "#35d0e8";
    ctx.shadowBlur = 8;

    for (const conn of PoseLandmarker.POSE_CONNECTIONS) {
      const a = lm[conn.start];
      const b = lm[conn.end];
      if (!a || !b) continue;
      if ((a.visibility && a.visibility < 0.3) || (b.visibility && b.visibility < 0.3)) continue;
      const pa = toCanvasXY(a.x, a.y);
      const pb = toCanvasXY(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // Draw joint keypoints
    ctx.fillStyle = "#3ddc97";
    ctx.shadowColor = "#3ddc97";
    ctx.shadowBlur = 10;
    for (const p of lm) {
      if (p.visibility && p.visibility < 0.3) continue;
      const pos = toCanvasXY(p.x, p.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // Main detection loop
  const detectFrame = useCallback(() => {
    if (!videoRef.current || !landmarkerRef.current) return;
    const video = videoRef.current;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const result = landmarkerRef.current.detectForVideo(video, performance.now());
        if (result.landmarks && result.landmarks.length > 0) {
          setStatusKind("on");
          setStatusMsg("Tracking form");
          renderOverlay(result.landmarks);
          const sig = extractSignals(result.landmarks[0]);
          if (sig) {
            handleSignals(sig);
          } else {
            setStatusKind("warn");
            setStatusMsg("Ensure hips, knees & ankles are in view");
          }
        } else {
          setStatusKind("warn");
          setStatusMsg("No person detected — step back to fit frame");
          const canvas = overlayRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      } catch (err) {
        console.warn("[MediaPipe] Frame error:", err);
      }
    }

    rafIdRef.current = requestAnimationFrame(detectFrame);
  }, [extractSignals]);

  // Mini-graph: Live Knee Angle
  const drawAngleGraph = () => {
    const canvas = angleGraphRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pts = angleHistoryRef.current;
    if (pts.length < 2) return;

    const minA = 50;
    const maxA = 190;
    const tMin = pts[0].t;
    const tMax = pts[pts.length - 1].t || tMin + 1;

    // Guideline at 100° (Optimal squat depth)
    ctx.strokeStyle = "rgba(245, 168, 60, 0.4)";
    ctx.setLineDash([3, 3]);
    const yGuide = h - ((100 - minA) / (maxA - minA)) * h;
    ctx.beginPath();
    ctx.moveTo(0, yGuide);
    ctx.lineTo(w, yGuide);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve
    ctx.strokeStyle = "#35d0e8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = ((p.t - tMin) / (tMax - tMin || 1)) * w;
      const y = h - ((p.angle - minA) / (maxA - minA)) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  // Mini-graph: Rep Scores
  const drawRepScoresGraph = useCallback(() => {
    const canvas = repGraphRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const recent = repScores.slice(-10);
    if (recent.length === 0) return;

    const barW = w / recent.length;
    recent.forEach((s, i) => {
      const bh = Math.max(2, (s / 100) * (h - 4));
      ctx.fillStyle = s >= 80 ? "#3ddc97" : s >= 60 ? "#f5a83c" : "#ef6461";
      ctx.fillRect(i * barW + 2, h - bh, barW - 4, bh);
    });
  }, [repScores]);

  // Mini-graph: Accuracy Trend
  const drawAccTrendGraph = useCallback(() => {
    const canvas = accGraphRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (repScores.length === 0) return;

    const runningAvg: number[] = [];
    let sum = 0;
    repScores.forEach((s, i) => {
      sum += s;
      runningAvg.push(sum / (i + 1));
    });

    ctx.strokeStyle = "#f5a83c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    runningAvg.forEach((v, i) => {
      const x = runningAvg.length === 1 ? 0 : (i / (runningAvg.length - 1)) * w;
      const y = h - (v / 100) * (h - 6) - 3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [repScores]);

  // Synchronize mini-graphs on prop changes
  useEffect(() => {
    drawRepScoresGraph();
    drawAccTrendGraph();
  }, [repScores, drawRepScoresGraph, drawAccTrendGraph]);

  // Handle overlay resizing
  const syncCanvasDimensions = () => {
    if (videoWrapRef.current && overlayRef.current) {
      const rect = videoWrapRef.current.getBoundingClientRect();
      overlayRef.current.width = Math.max(1, Math.round(rect.width));
      overlayRef.current.height = Math.max(1, Math.round(rect.height));
    }
    // Mini graphs sizing
    [angleGraphRef, repGraphRef, accGraphRef].forEach((ref) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        if (rect.width && rect.height) {
          ref.current.width = Math.round(rect.width);
          ref.current.height = Math.round(rect.height);
        }
      }
    });
  };

  useEffect(() => {
    syncCanvasDimensions();
    window.addEventListener("resize", syncCanvasDimensions);
    return () => window.removeEventListener("resize", syncCanvasDimensions);
  }, []);

  // Initialize MediaPipe PoseLandmarker
  const initModel = async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setLoadingModel(true);
    setStatusMsg("Loading MediaPipe vision model...");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const modelAssetPath =
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

    let landmarker: PoseLandmarker;
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    } catch {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    }

    landmarkerRef.current = landmarker;
    setModelLoaded(true);
    setLoadingModel(false);
    return landmarker;
  };

  const handleStartCamera = async () => {
    try {
      await initModel();
      setStatusMsg("Requesting camera access...");
      setStatusKind("loading");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsRunning(true);
      setStatusKind("warn");
      setStatusMsg("Looking for person in frame...");
      syncCanvasDimensions();
      rafIdRef.current = requestAnimationFrame(detectFrame);
    } catch (err: any) {
      console.error("[Camera] Error:", err);
      setIsRunning(false);
      setStatusKind("warn");
      setStatusMsg("Camera access denied or unavailable. Click Start Camera to retry.");
    }
  };

  const handleStopCamera = () => {
    setIsRunning(false);
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    const canvas = overlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setStatusKind("warn");
    setStatusMsg("Camera stopped");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const latestScore = repScores.length > 0 ? repScores[repScores.length - 1] : null;
  const currentAcc =
    repScores.length > 0 ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length) : null;

  return (
    <section className="flex flex-col gap-3 min-h-0 flex-1">
      {/* Video Panel Container */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#0e1f2e] border border-[#1a3448] rounded-xl overflow-hidden shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a3448] bg-[#0c1a28] shrink-0">
          <div className="flex items-center gap-2 font-display font-semibold text-sm text-[#eaf3fa]">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? "bg-[#ef6461] animate-pulse shadow-[0_0_6px_#ef6461]" : "bg-[#5c7a8e]"
              }`}
            />
            Squats — Live Form Tracker
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isRunning ? handleStopCamera : handleStartCamera}
              disabled={loadingModel}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center gap-1.5 ${
                isRunning
                  ? "bg-[#16283a] text-[#ef6461] border border-[#ef6461]/40 hover:bg-[#ef6461]/10"
                  : "bg-[#35d0e8] text-[#04191f] hover:bg-[#4fdcef] shadow-[#35d0e8]/20"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              {loadingModel ? "Loading Model..." : isRunning ? "Stop Camera" : "Start Camera"}
            </button>

            <button
              type="button"
              onClick={onResetSession}
              disabled={!isRunning && repScores.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide bg-[#0e2434] hover:bg-[#14293a] text-[#9db3c2] hover:text-[#eaf3fa] border border-[#1a3448] transition-colors flex items-center gap-1.5 disabled:opacity-40"
              title="Reset current session counter"
            >
              <RefreshCw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Video Stage Wrap */}
        <div ref={videoWrapRef} className="relative flex-1 min-h-0 bg-[#04090e] overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="absolute inset-0 w-full h-full object-cover -scale-x-100 block"
          />
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none z-10"
          />

          {/* Empty State */}
          {!isRunning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#5c7a8e] p-6 text-center z-20 select-none bg-[#04090e]/90">
              <div className="w-14 h-14 rounded-full bg-[#0c1a28] border border-[#1a3448] flex items-center justify-center text-[#35d0e8]/70">
                <VideoOff className="w-6 h-6" />
              </div>
              <p className="text-xs text-[#9db3c2] max-w-sm leading-relaxed">
                Camera is standby. Click <strong className="text-[#35d0e8]">Start Camera</strong> and allow camera
                permissions to begin real-time posture tracking. Step back so your full body is visible.
              </p>
            </div>
          )}

          {/* Live Status Overlay Pill */}
          {isRunning && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-[#061018]/85 border border-[#1a3448] backdrop-blur-sm text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  statusKind === "on"
                    ? "bg-[#3ddc97] shadow-[0_0_6px_#3ddc97]"
                    : statusKind === "loading"
                    ? "bg-[#35d0e8] animate-ping"
                    : "bg-[#f5a83c] shadow-[0_0_6px_#f5a83c]"
                }`}
              />
              <span className="text-[#eaf3fa] font-medium text-[11px]">{statusMsg}</span>
            </div>
          )}

          {/* AI Model Badge */}
          {isRunning && modelLoaded && (
            <div className="absolute top-3 right-3 z-30 px-2.5 py-0.5 rounded bg-[#061018]/80 border border-[#1a3448] text-[10px] font-mono text-[#35d0e8] tracking-wider">
              MEDIAPIPE POSE
            </div>
          )}

          {/* Bottom Alignment Hint */}
          {isRunning && (
            <div className="absolute bottom-0 inset-x-0 z-30 py-2 px-4 text-center text-[11px] text-[#9db3c2] bg-gradient-to-t from-[#061018]/95 to-transparent">
              Stand ~6-8 feet away · Keep hips, knees & ankles in frame · Maintain good lighting
            </div>
          )}
        </div>
      </div>

      {/* Mini Graphs Bar */}
      <div className="grid grid-cols-3 gap-3 h-28 shrink-0">
        {/* Knee Angle Live */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              Knee Angle — Live
            </h3>
            <span className="font-display font-bold text-xs text-[#35d0e8]">
              {currentKneeAngleRef.current ? `${Math.round(currentKneeAngleRef.current)}°` : "--°"}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={angleGraphRef} className="w-full h-full block" />
          </div>
        </div>

        {/* Rep Scores */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              Rep Scores
            </h3>
            <span
              className={`font-display font-bold text-xs ${
                latestScore !== null
                  ? latestScore >= 80
                    ? "text-[#3ddc97]"
                    : latestScore >= 60
                    ? "text-[#f5a83c]"
                    : "text-[#ef6461]"
                  : "text-[#5c7a8e]"
              }`}
            >
              {latestScore !== null ? `${latestScore}` : "--"}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={repGraphRef} className="w-full h-full block" />
          </div>
        </div>

        {/* Accuracy Trend */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              Accuracy Trend
            </h3>
            <span className="font-display font-bold text-xs text-[#f5a83c]">
              {currentAcc !== null ? `${currentAcc}%` : "--%"}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={accGraphRef} className="w-full h-full block" />
          </div>
        </div>
      </div>
    </section>
  );
};
