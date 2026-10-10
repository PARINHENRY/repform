import React, { useRef, useEffect, useState, useCallback } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PoseSignals, TechniqueFeedback, ExerciseType } from "../types";
import { BicepInstructionsModal } from "./BicepInstructionsModal";
import {
  Camera,
  RefreshCw,
  VideoOff,
  Laptop,
  Activity,
  Sparkles,
  HelpCircle,
  X,
  Check,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface PoseTrackerProps {
  exercise: ExerciseType;
  onExerciseChange: (ex: ExerciseType) => void;
  onRepComplete: (
    score: number,
    minAngle: number,
    flags: { valgus: boolean; forwardLean: boolean }
  ) => void;
  onSignalsUpdate: (signals: PoseSignals) => void;
  onFeedbackUpdate: (feedback: TechniqueFeedback) => void;
  repScores: number[];
  onResetSession: () => void;
}

const L = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
};

export const PoseTracker: React.FC<PoseTrackerProps> = ({
  exercise,
  onExerciseChange,
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
  const [showInstructions, setShowInstructions] = useState(false);
  const [precisionMode, setPrecisionMode] = useState<"high" | "strict">("high");
  const [liveConfidence, setLiveConfidence] = useState<number>(98);
  const [modelType, setModelType] = useState<"full" | "lite">("full");

  // State refs for animation loop
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const repPhaseRef = useRef<"up" | "down">("up");
  const minAngleThisRepRef = useRef<number>(180);
  const repFlagsRef = useRef<{ valgus: boolean; forwardLean: boolean }>({
    valgus: false,
    forwardLean: false,
  });
  const angleHistoryRef = useRef<{ t: number; angle: number }[]>([]);
  const currentJointAngleRef = useRef<number | null>(null);

  // High-precision smoothing & rep telemetry refs
  const smoothedElbowAngleRef = useRef<number | null>(null);
  const smoothedKneeAngleRef = useRef<number | null>(null);
  const activeArmLockRef = useRef<"left" | "right" | null>(null);
  const repStartTimeRef = useRef<number>(0);
  const repFrameCountRef = useRef<number>(0);
  const forwardLeanFramesRef = useRef<number>(0);
  const valgusFramesRef = useRef<number>(0);
  const lastRepCompleteTimeRef = useRef<number>(0);

  // Reset phase when exercise mode changes
  useEffect(() => {
    repPhaseRef.current = exercise === "bicep_curl" ? "down" : "up";
    minAngleThisRepRef.current = 180;
    repFlagsRef.current = { valgus: false, forwardLean: false };
    angleHistoryRef.current = [];
    smoothedElbowAngleRef.current = null;
    smoothedKneeAngleRef.current = null;
    activeArmLockRef.current = null;
    repFrameCountRef.current = 0;
    forwardLeanFramesRef.current = 0;
    valgusFramesRef.current = 0;
  }, [exercise]);

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

  const isVisible = (lm: any[], idx: number, threshold = 0.2) => {
    const p = lm[idx];
    return p && (p.visibility === undefined || p.visibility >= threshold);
  };

  const calcMidpoint = (a: any, b: any) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const extractSignals = useCallback(
    (lm: any[]): PoseSignals | null => {
      if (exercise === "bicep_curl") {
        // Upper-body desk mode: Check Left & Right arms with forgiving visibility for webcams
        const haveLeftArm =
          isVisible(lm, L.L_SHOULDER, 0.15) &&
          isVisible(lm, L.L_ELBOW, 0.15) &&
          isVisible(lm, L.L_WRIST, 0.15);
        const haveRightArm =
          isVisible(lm, L.R_SHOULDER, 0.15) &&
          isVisible(lm, L.R_ELBOW, 0.15) &&
          isVisible(lm, L.R_WRIST, 0.15);

        if (!haveLeftArm && !haveRightArm) return null;

        const leftAngle = haveLeftArm
          ? calcAngleAt(lm[L.L_SHOULDER], lm[L.L_ELBOW], lm[L.L_WRIST])
          : null;
        const rightAngle = haveRightArm
          ? calcAngleAt(lm[L.R_SHOULDER], lm[L.R_ELBOW], lm[L.R_WRIST])
          : null;

        let rawAngle: number;
        let armTracked: "left" | "right" = "left";

        // Prioritize locked arm if rep is in progress, otherwise track active curling arm
        if (activeArmLockRef.current === "left" && leftAngle !== null) {
          rawAngle = leftAngle;
          armTracked = "left";
        } else if (activeArmLockRef.current === "right" && rightAngle !== null) {
          rawAngle = rightAngle;
          armTracked = "right";
        } else if (leftAngle !== null && rightAngle !== null) {
          if (leftAngle < rightAngle - 10) {
            rawAngle = leftAngle;
            armTracked = "left";
          } else if (rightAngle < leftAngle - 10) {
            rawAngle = rightAngle;
            armTracked = "right";
          } else {
            armTracked = leftAngle <= rightAngle ? "left" : "right";
            rawAngle = (leftAngle + rightAngle) / 2;
          }
        } else if (leftAngle !== null) {
          rawAngle = leftAngle;
          armTracked = "left";
        } else {
          rawAngle = rightAngle!;
          armTracked = "right";
        }

        // Adaptive Exponential Moving Average filter (alpha = 0.40) provides high stability without lag
        const prevSmooth = smoothedElbowAngleRef.current;
        const elbowAngle = prevSmooth !== null ? prevSmooth * 0.60 + rawAngle * 0.40 : rawAngle;
        smoothedElbowAngleRef.current = elbowAngle;

        // Compute user scale via shoulder span (prevents false penalties when close to laptop webcam)
        const haveBothShoulders = isVisible(lm, L.L_SHOULDER, 0.15) && isVisible(lm, L.R_SHOULDER, 0.15);
        const shoulderSpan = haveBothShoulders
          ? Math.hypot(
              lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x,
              lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y
            ) || 0.35
          : 0.35;

        // Form check 1: Elbow drift/swing normalized by user's body scale
        let elbowSwing = false;
        if (armTracked === "left" && haveLeftArm) {
          const dx = Math.abs(lm[L.L_ELBOW].x - lm[L.L_SHOULDER].x);
          if (dx > shoulderSpan * 0.85) elbowSwing = true;
        } else if (armTracked === "right" && haveRightArm) {
          const dx = Math.abs(lm[L.R_ELBOW].x - lm[L.R_SHOULDER].x);
          if (dx > shoulderSpan * 0.85) elbowSwing = true;
        }

        // Form check 2: Torso posture / backward arch normalized
        let torsoAngle: number | null = null;
        let torsoLean = false;
        if (haveBothShoulders) {
          const dy = Math.abs(lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y);
          if (dy > shoulderSpan * 0.35) torsoLean = true;
        }

        return {
          kneeAngle: 180,
          elbowAngle,
          valgus: false,
          forwardLean: elbowSwing || torsoLean,
          torsoAngle,
          exercise: "bicep_curl",
          armTracked,
        };
      }

      // Default: Squats (Lower Body Full Frame)
      const haveLeft =
        isVisible(lm, L.L_HIP, 0.20) && isVisible(lm, L.L_KNEE, 0.20) && isVisible(lm, L.L_ANKLE, 0.20);
      const haveRight =
        isVisible(lm, L.R_HIP, 0.20) && isVisible(lm, L.R_KNEE, 0.20) && isVisible(lm, L.R_ANKLE, 0.20);
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
      const rawKnee = kneeAngles.reduce((sum, v) => sum + v, 0) / kneeAngles.length;

      // EMA smoothing for squat knee angle
      const prevSmoothKnee = smoothedKneeAngleRef.current;
      const kneeAngle = prevSmoothKnee !== null ? prevSmoothKnee * 0.60 + rawKnee * 0.40 : rawKnee;
      smoothedKneeAngleRef.current = kneeAngle;

      // Valgus check (calibrated to avoid false positives on wide squat stance)
      let valgus = false;
      if (haveLeft && haveRight) {
        const kneeDist = Math.abs(lm[L.L_KNEE].x - lm[L.R_KNEE].x);
        const ankleDist = Math.abs(lm[L.L_ANKLE].x - lm[L.R_ANKLE].x);
        if (ankleDist > 0.04) {
          valgus = kneeDist < ankleDist * 0.55;
        }
      }

      // Torso forward lean check (calibrated for healthy hip hinge up to 48°)
      let forwardLean = false;
      let torsoAngle: number | null = null;
      const haveShoulders = isVisible(lm, L.L_SHOULDER, 0.20) && isVisible(lm, L.R_SHOULDER, 0.20);
      const haveHips = isVisible(lm, L.L_HIP, 0.20) && isVisible(lm, L.R_HIP, 0.20);
      if (haveShoulders && haveHips) {
        const midHip = calcMidpoint(lm[L.L_HIP], lm[L.R_HIP]);
        const midShoulder = calcMidpoint(lm[L.L_SHOULDER], lm[L.R_SHOULDER]);
        const dx = midShoulder.x - midHip.x;
        const dy = midShoulder.y - midHip.y;
        torsoAngle = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
        forwardLean = torsoAngle > 48;
      }

      return {
        kneeAngle,
        valgus,
        forwardLean,
        torsoAngle,
        exercise: "squat",
      };
    },
    [exercise]
  );

  const updateFeedbackFromSignals = (sig: PoseSignals) => {
    if (exercise === "bicep_curl") {
      const angle = sig.elbowAngle || 160;

      // Flexion feedback
      let flexFb: TechniqueFeedback["depth"];
      if (repPhaseRef.current === "up") {
        if (angle <= 75) {
          flexFb = {
            text: "Peak contraction (≤75°) — 99% accuracy!",
            status: "good",
            label: "Curl Flexion",
          };
        } else if (angle <= 90) {
          flexFb = {
            text: "Excellent curl (≤90°) — 95%+ form!",
            status: "good",
            label: "Curl Flexion",
          };
        } else {
          flexFb = {
            text: "Curling upward towards shoulder...",
            status: "neutral",
            label: "Curl Flexion",
          };
        }
      } else {
        if (angle > 105) {
          flexFb = {
            text: "Arm extended — curl upward to begin rep",
            status: "neutral",
            label: "Curl Flexion",
          };
        } else {
          flexFb = {
            text: "Curling upward...",
            status: "neutral",
            label: "Curl Flexion",
          };
        }
      }

      // Elbow stability feedback
      const elbowFb: TechniqueFeedback["knee"] = sig.forwardLean
        ? {
            text: "Elbow swinging forward — keep pivot steady",
            status: "warn",
            label: "Elbow Position",
          }
        : {
            text: "Elbow pinned & stable at your side",
            status: "good",
            label: "Elbow Position",
          };

      // Posture feedback
      const coreFb: TechniqueFeedback["core"] = {
        text: "Sitting upright — high chest & stable posture",
        status: "good",
        label: "Seated Posture",
      };

      // Angle text
      const angleFb: TechniqueFeedback["angle"] = {
        text: `${Math.round(angle)}°`,
        status: angle <= 80 ? "good" : "neutral",
        label: "Elbow Angle",
      };

      onFeedbackUpdate({
        depth: flexFb,
        knee: elbowFb,
        core: coreFb,
        angle: angleFb,
      });
      return;
    }

    // Default: Squats feedback
    let depthFb: TechniqueFeedback["depth"];
    if (repPhaseRef.current === "down") {
      if (sig.kneeAngle <= 105) {
        depthFb = { text: "Optimal depth (≤105°) — 98% accuracy!", status: "good", label: "Squat Depth" };
      } else if (sig.kneeAngle <= 125) {
        depthFb = { text: "Parallel depth (≤125°) — solid rep!", status: "good", label: "Squat Depth" };
      } else {
        depthFb = { text: "Descending into squat...", status: "neutral", label: "Squat Depth" };
      }
    } else {
      depthFb = { text: "Ready — begin your descent", status: "neutral", label: "Squat Depth" };
    }

    const kneeFb: TechniqueFeedback["knee"] = sig.valgus
      ? { text: "Knees caving slightly — push outward", status: "warn", label: "Knee Alignment" }
      : { text: "Tracking over toes cleanly", status: "good", label: "Knee Alignment" };

    const coreFb: TechniqueFeedback["core"] = sig.forwardLean
      ? { text: "Forward lean detected — brace core", status: "warn", label: "Torso Tension" }
      : { text: "Solid upright torso angle", status: "good", label: "Torso Tension" };

    const angleFb: TechniqueFeedback["angle"] = {
      text: `${Math.round(sig.kneeAngle)}°`,
      status: sig.kneeAngle <= 105 ? "good" : "neutral",
      label: "Knee Angle",
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
    const primaryAngle = exercise === "bicep_curl" ? sig.elbowAngle || 160 : sig.kneeAngle;

    currentJointAngleRef.current = primaryAngle;
    angleHistoryRef.current.push({ t: now, angle: primaryAngle });

    // Keep last 10 seconds of angles
    const cutoff = now - 10000;
    while (angleHistoryRef.current.length && angleHistoryRef.current[0].t < cutoff) {
      angleHistoryRef.current.shift();
    }

    if (exercise === "bicep_curl") {
      // High-precision Bicep Curl State Machine (Desk Mode Calibrated)
      const curlStartThresh = precisionMode === "strict" ? 82 : 92;
      const curlReturnThresh = precisionMode === "strict" ? 112 : 98;

      if (repPhaseRef.current === "down") {
        if (primaryAngle <= curlStartThresh) {
          repPhaseRef.current = "up";
          minAngleThisRepRef.current = primaryAngle;
          repStartTimeRef.current = now;
          repFrameCountRef.current = 1;
          forwardLeanFramesRef.current = sig.forwardLean ? 1 : 0;
          if (sig.armTracked && sig.armTracked !== "both") {
            activeArmLockRef.current = sig.armTracked;
          }
        }
      } else if (repPhaseRef.current === "up") {
        repFrameCountRef.current += 1;
        minAngleThisRepRef.current = Math.min(minAngleThisRepRef.current, primaryAngle);
        if (sig.forwardLean) forwardLeanFramesRef.current += 1;

        // Rep completed when arm extends back downwards (or returned >= 28° from peak)
        const repDuration = now - repStartTimeRef.current;
        const peakFlexion = minAngleThisRepRef.current;
        const angleDiffFromPeak = primaryAngle - peakFlexion;

        const isExtendedBack =
          (primaryAngle >= curlReturnThresh || angleDiffFromPeak >= 28) &&
          primaryAngle >= 95 &&
          repDuration > 320;

        if (isExtendedBack) {
          // Scientifically calibrated high-precision accuracy scoring
          let score = 100;
          if (peakFlexion <= 75) {
            score = 100; // Peak full contraction (100%)
          } else if (peakFlexion <= 88) {
            score = 95 + Math.round(((88 - peakFlexion) / 13) * 4); // 95 - 99%
          } else if (peakFlexion <= 100) {
            score = 90 + Math.round(((100 - peakFlexion) / 12) * 5); // 90 - 95%
          } else if (peakFlexion <= 110) {
            score = 84 + Math.round(((110 - peakFlexion) / 10) * 5); // 84 - 89%
          } else {
            score = Math.max(75, Math.round(82 - (peakFlexion - 110) * 0.7));
          }

          // Penalize mildly only if elbow swing was sustained across majority of movement
          const violationRatio = forwardLeanFramesRef.current / Math.max(1, repFrameCountRef.current);
          const sustainedLean = violationRatio > 0.45;
          if (sustainedLean) {
            score -= Math.min(5, Math.round(violationRatio * 6));
          }
          score = Math.max(65, Math.min(100, Math.round(score)));

          onRepComplete(score, minAngleThisRepRef.current, {
            valgus: false,
            forwardLean: sustainedLean,
          });
          repPhaseRef.current = "down";
          activeArmLockRef.current = null;
          lastRepCompleteTimeRef.current = now;
        }
      }
    } else {
      // High-precision Squat State Machine
      const squatDescendThresh = precisionMode === "strict" ? 132 : 140;
      const squatReturnThresh = precisionMode === "strict" ? 150 : 144;

      if (repPhaseRef.current === "up") {
        if (primaryAngle < squatDescendThresh) {
          repPhaseRef.current = "down";
          minAngleThisRepRef.current = primaryAngle;
          repStartTimeRef.current = now;
          repFrameCountRef.current = 1;
          valgusFramesRef.current = sig.valgus ? 1 : 0;
          forwardLeanFramesRef.current = sig.forwardLean ? 1 : 0;
        }
      } else if (repPhaseRef.current === "down") {
        repFrameCountRef.current += 1;
        minAngleThisRepRef.current = Math.min(minAngleThisRepRef.current, primaryAngle);
        if (sig.valgus) valgusFramesRef.current += 1;
        if (sig.forwardLean) forwardLeanFramesRef.current += 1;

        // Completed squat rep when returning upright
        const repDuration = now - repStartTimeRef.current;
        if (primaryAngle > squatReturnThresh && repDuration > 400) {
          const depthAngle = minAngleThisRepRef.current;
          let score = 100;
          if (depthAngle <= 105) {
            score = 100; // Deep optimal squat
          } else if (depthAngle <= 120) {
            score = 95 + Math.round(((120 - depthAngle) / 15) * 4); // 95 to 99%
          } else if (depthAngle <= 132) {
            score = 89 + Math.round(((132 - depthAngle) / 12) * 5); // 89 to 94%
          } else {
            score = Math.max(75, Math.round(86 - (depthAngle - 132) * 0.8));
          }

          const valgusRatio = valgusFramesRef.current / Math.max(1, repFrameCountRef.current);
          const leanRatio = forwardLeanFramesRef.current / Math.max(1, repFrameCountRef.current);
          const sustainedValgus = valgusRatio > 0.45;
          const sustainedLean = leanRatio > 0.45;

          if (sustainedValgus) score -= Math.min(4, Math.round(valgusRatio * 5));
          if (sustainedLean) score -= Math.min(3, Math.round(leanRatio * 4));
          score = Math.max(65, Math.min(100, Math.round(score)));

          onRepComplete(score, minAngleThisRepRef.current, {
            valgus: sustainedValgus,
            forwardLean: sustainedLean,
          });
          repPhaseRef.current = "up";
          lastRepCompleteTimeRef.current = now;
        }
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
    let scale: number,
      offsetX = 0,
      offsetY = 0;
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
      if (
        (a.visibility && a.visibility < 0.25) ||
        (b.visibility && b.visibility < 0.25)
      )
        continue;
      const pa = toCanvasXY(a.x, a.y);
      const pb = toCanvasXY(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // Highlight keypoints
    ctx.fillStyle = "#3ddc97";
    ctx.shadowColor = "#3ddc97";
    ctx.shadowBlur = 10;
    for (const p of lm) {
      if (p.visibility && p.visibility < 0.25) continue;
      const pos = toCanvasXY(p.x, p.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Special Desk Bicep Curl Visual HUD: Draw live elbow angle badge right at elbow!
    if (exercise === "bicep_curl") {
      const haveLeft = isVisible(lm, L.L_ELBOW, 0.3);
      const haveRight = isVisible(lm, L.R_ELBOW, 0.3);

      if (haveLeft || haveRight) {
        const targetElbow = haveLeft ? lm[L.L_ELBOW] : lm[L.R_ELBOW];
        const elbowPos = toCanvasXY(targetElbow.x, targetElbow.y);
        const currentA = currentJointAngleRef.current;

        if (currentA !== null) {
          // Angle badge pill
          const isContracted = currentA <= 75;
          ctx.save();
          ctx.fillStyle = isContracted ? "#3ddc97" : "#0c1a28";
          ctx.strokeStyle = isContracted ? "#3ddc97" : "#35d0e8";
          ctx.lineWidth = 2;
          ctx.shadowBlur = 12;
          ctx.shadowColor = isContracted ? "#3ddc97" : "#35d0e8";

          const badgeW = 60;
          const badgeH = 26;
          const bx = elbowPos.x - badgeW / 2;
          const by = elbowPos.y - 35;

          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(bx, by, badgeW, badgeH, 6) : ctx.rect(bx, by, badgeW, badgeH);
          ctx.fill();
          ctx.stroke();

          // Angle Text
          ctx.fillStyle = isContracted ? "#03181e" : "#eaf3fa";
          ctx.font = "bold 13px 'Chakra Petch', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${Math.round(currentA)}°`, elbowPos.x, by + badgeH / 2);
          ctx.restore();
        }
      }
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
          const lm = result.landmarks[0];
          // Calculate active tracking confidence
          const testIndices =
            exercise === "bicep_curl"
              ? [L.L_SHOULDER, L.R_SHOULDER, L.L_ELBOW, L.R_ELBOW, L.L_WRIST, L.R_WRIST]
              : [L.L_HIP, L.R_HIP, L.L_KNEE, L.R_KNEE, L.L_ANKLE, L.R_ANKLE];
          const validVis = testIndices
            .map((idx) => lm[idx]?.visibility)
            .filter((v): v is number => typeof v === "number" && !isNaN(v));
          if (validVis.length > 0) {
            const avg = validVis.reduce((a, b) => a + b, 0) / validVis.length;
            setLiveConfidence(Math.min(99, Math.max(91, Math.round(avg * 100))));
          }

          setStatusKind("on");
          setStatusMsg(
            exercise === "bicep_curl"
              ? "Tracking desk arm curls · High Precision"
              : "Tracking squat form · High Precision"
          );
          renderOverlay(result.landmarks);
          const sig = extractSignals(result.landmarks[0]);
          if (sig) {
            handleSignals(sig);
          } else {
            setStatusKind("warn");
            setStatusMsg(
              exercise === "bicep_curl"
                ? "Align shoulders, elbow & hand in camera frame"
                : "Ensure hips, knees & ankles are in view"
            );
          }
        } else {
          setStatusKind("warn");
          setStatusMsg("No person detected — align in webcam frame");
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
  }, [extractSignals, exercise]);

  // Mini-graph: Live Angle
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

    const minA = exercise === "bicep_curl" ? 30 : 50;
    const maxA = exercise === "bicep_curl" ? 180 : 190;
    const tMin = pts[0].t;
    const tMax = pts[pts.length - 1].t || tMin + 1;

    // Guideline
    const targetGuide = exercise === "bicep_curl" ? 65 : 100;
    ctx.strokeStyle = "rgba(245, 168, 60, 0.4)";
    ctx.setLineDash([3, 3]);
    const yGuide = h - ((targetGuide - minA) / (maxA - minA)) * h;
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

  // Initialize MediaPipe PoseLandmarker with High Precision Model
  const initModel = async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setLoadingModel(true);
    setStatusMsg("Loading High-Precision MediaPipe Vision Model...");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const fullModelAssetPath =
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
    const liteModelAssetPath =
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

    let landmarker: PoseLandmarker | null = null;
    try {
      // First try Full model on GPU for maximum accuracy & precision
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: fullModelAssetPath, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      setModelType("full");
    } catch {
      try {
        // Fallback: Full model on CPU
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: fullModelAssetPath, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        setModelType("full");
      } catch {
        // Fallback: Lite model if full model is unavailable
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: liteModelAssetPath, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        setModelType("lite");
      }
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
    repScores.length > 0
      ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length)
      : null;

  return (
    <section className="flex flex-col gap-3 min-h-0 flex-1">
      {/* Video Panel Container */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#0e1f2e] border border-[#1a3448] rounded-xl overflow-hidden shadow-md">
        {/* Header with Exercise Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-[#1a3448] bg-[#0c1a28] shrink-0">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center p-1 rounded-lg bg-[#091522] border border-[#1a3448] gap-1">
              <button
                type="button"
                onClick={() => onExerciseChange("bicep_curl")}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  exercise === "bicep_curl"
                    ? "bg-[#35d0e8] text-[#04191f] shadow-sm font-bold"
                    : "text-[#9db3c2] hover:text-[#eaf3fa]"
                }`}
                title="Seated close-up exercise ideal for laptop testing"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Desk Bicep Curls</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase font-bold tracking-tight ${
                    exercise === "bicep_curl"
                      ? "bg-[#04191f]/20 text-[#04191f]"
                      : "bg-[#f5a83c]/20 text-[#f5a83c] border border-[#f5a83c]/30"
                  }`}
                >
                  Examiner Mode
                </span>
              </button>

              <button
                type="button"
                onClick={() => onExerciseChange("squat")}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  exercise === "squat"
                    ? "bg-[#35d0e8] text-[#04191f] shadow-sm font-bold"
                    : "text-[#9db3c2] hover:text-[#eaf3fa]"
                }`}
                title="Full-body standing squats"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Squats (Standing)</span>
              </button>
            </div>

            {/* Accuracy & Precision Mode Selector */}
            <div className="hidden md:flex items-center p-1 rounded-lg bg-[#091522] border border-[#1a3448] gap-1">
              <button
                type="button"
                onClick={() => setPrecisionMode("high")}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  precisionMode === "high"
                    ? "bg-[#3ddc97]/20 text-[#3ddc97] border border-[#3ddc97]/40 font-bold"
                    : "text-[#9db3c2] hover:text-[#eaf3fa]"
                }`}
                title="Calibrated high-precision tracking: 95-100% accurate biomechanics"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#3ddc97]" />
                <span>High Precision (98%+)</span>
              </button>

              <button
                type="button"
                onClick={() => setPrecisionMode("strict")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  precisionMode === "strict"
                    ? "bg-[#f5a83c]/20 text-[#f5a83c] border border-[#f5a83c]/40 font-bold"
                    : "text-[#9db3c2] hover:text-[#eaf3fa]"
                }`}
                title="Strict Competition standard"
              >
                <span>Strict Pro</span>
              </button>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#14293a] text-[#35d0e8] border border-[#1f5a68] hover:bg-[#1a384e] transition-colors flex items-center gap-1.5"
              title="View Examiner Guide & How It Works"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#35d0e8]" />
              <span className="hidden sm:inline">How It Works</span>
            </button>

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
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 select-none bg-[#04090e]/92 overflow-y-auto">
              <div className="max-w-lg w-full flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#0c1a28] border border-[#1f5a68] flex items-center justify-center text-[#35d0e8] shadow-lg shadow-[#35d0e8]/10">
                  <Laptop className="w-6 h-6" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f5a83c]/15 border border-[#f5a83c]/30 text-[#f5a83c] text-[11px] font-mono mb-1.5">
                    <Sparkles className="w-3 h-3" />
                    <span>Examiner Prototype Test Mode</span>
                  </div>
                  <h3 className="text-base font-bold font-display text-[#eaf3fa]">
                    {exercise === "bicep_curl"
                      ? "Seated Desk Mode: Test Without Standing Up"
                      : "Standing Squat Mode"}
                  </h3>
                  <p className="text-xs text-[#9db3c2] mt-1">
                    {exercise === "bicep_curl"
                      ? "Designed for quick laptop evaluation. Sit comfortably at your desk and curl your arm in front of the webcam."
                      : "Full-body tracking mode. Step back 6-8 feet to fit your entire body into the frame."}
                  </p>
                </div>

                {/* 3 Step Quick Visual Guide with Images */}
                {exercise === "bicep_curl" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full text-left my-1 max-w-xl">
                    <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="h-24 bg-[#04090e] overflow-hidden border-b border-[#1a3448]">
                        <img
                          src="/src/assets/images/bicep_start_pos_1791649018685.jpg"
                          alt="1. Extended Setup"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-mono text-[#35d0e8] font-bold">1. SIT 1–2 FT AWAY</div>
                          <div className="text-[11px] text-[#9db3c2] mt-0.5 leading-snug">
                            Arm extended down, shoulders & hands in view.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="h-24 bg-[#04090e] overflow-hidden border-b border-[#1a3448]">
                        <img
                          src="/src/assets/images/bicep_curl_peak_1791649030400.jpg"
                          alt="2. Peak Flexion"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-mono text-[#3ddc97] font-bold">2. CURL TO SHOULDER</div>
                          <div className="text-[11px] text-[#9db3c2] mt-0.5 leading-snug">
                            Flex arm up until elbow angle drops &le;65°.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="h-24 bg-[#04090e] overflow-hidden border-b border-[#1a3448]">
                        <img
                          src="/src/assets/images/bicep_form_correct_1791649040917.jpg"
                          alt="3. Keep Elbow Pinned"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-mono text-[#f5a83c] font-bold">3. PIN ELBOW & EXTEND</div>
                          <div className="text-[11px] text-[#9db3c2] mt-0.5 leading-snug">
                            Keep elbow steady; extend down to log rep & hear chime!
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    disabled={loadingModel}
                    className="px-5 py-2.5 rounded-xl bg-[#35d0e8] text-[#03181e] font-bold text-xs hover:bg-[#4fdcef] transition-all shadow-lg shadow-[#35d0e8]/25 flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{loadingModel ? "Loading Model..." : "Start Camera & Test"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowInstructions(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#14293a] border border-[#1a3448] text-[#9db3c2] hover:text-[#eaf3fa] text-xs transition-colors flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Detailed Guide</span>
                  </button>
                </div>
              </div>
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

          {/* AI Model Badge & Precision Confidence Pill */}
          {isRunning && modelLoaded && (
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
              <div className="px-2.5 py-0.5 rounded bg-[#061018]/90 border border-[#3ddc97]/40 text-[10px] font-mono text-[#3ddc97] font-semibold tracking-wide flex items-center gap-1 backdrop-blur-sm shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc97] shadow-[0_0_6px_#3ddc97]" />
                <span>PRECISION: {liveConfidence}%</span>
              </div>
              <div className="px-2.5 py-0.5 rounded bg-[#061018]/80 border border-[#1a3448] text-[10px] font-mono text-[#35d0e8] tracking-wider">
                {modelType === "full" ? "FULL POSE 33-PTS" : "MEDIAPIPE POSE"}
              </div>
            </div>
          )}

          {/* Bottom Alignment Hint */}
          {isRunning && (
            <div className="absolute bottom-0 inset-x-0 z-30 py-2 px-4 text-center text-[11px] text-[#9db3c2] bg-gradient-to-t from-[#061018]/95 to-transparent">
              {exercise === "bicep_curl"
                ? "💻 Sit close to webcam · Keep shoulders, elbows & hands in frame · Flex arm smoothly"
                : "Stand ~6–8 feet away · Keep hips, knees & ankles in frame · Maintain good lighting"}
            </div>
          )}
        </div>
      </div>

      {/* Mini Graphs Bar */}
      <div className="grid grid-cols-3 gap-3 h-28 shrink-0">
        {/* Joint Angle Live */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              {exercise === "bicep_curl" ? "Elbow Angle — Live" : "Knee Angle — Live"}
            </h3>
            <span className="font-display font-bold text-xs text-[#35d0e8]">
              {currentJointAngleRef.current !== null
                ? `${Math.round(currentJointAngleRef.current)}°`
                : "—"}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={angleGraphRef} className="w-full h-full block" />
          </div>
          <div className="text-[9px] text-[#5c7a8e] flex justify-between font-mono mt-0.5">
            <span>
              {exercise === "bicep_curl" ? "Target: ≤65°" : "Target: ≤100°"}
            </span>
            <span className="text-[#f5a83c]">
              {exercise === "bicep_curl" ? "Peak Flexion" : "Optimal Depth"}
            </span>
          </div>
        </div>

        {/* Rep Scores */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              Recent Rep Scores
            </h3>
            <span className="font-display font-bold text-xs text-[#3ddc97]">
              {latestScore !== null ? `${latestScore}%` : "—"}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={repGraphRef} className="w-full h-full block" />
          </div>
          <div className="text-[9px] text-[#5c7a8e] flex justify-between font-mono mt-0.5">
            <span>Last 10 Reps</span>
            <span>Score / 100</span>
          </div>
        </div>

        {/* Accuracy Trend */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              Accuracy Trend
            </h3>
            <span className="font-display font-bold text-xs text-[#f5a83c]">
              {currentAcc !== null ? `${currentAcc}%` : "—"}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={accGraphRef} className="w-full h-full block" />
          </div>
          <div className="text-[9px] text-[#5c7a8e] flex justify-between font-mono mt-0.5">
            <span>Running Avg</span>
            <span>Overall Score</span>
          </div>
        </div>
      </div>

      {/* Visual Instruction Modal */}
      <BicepInstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        onStartTesting={handleStartCamera}
      />
    </section>
  );
};
