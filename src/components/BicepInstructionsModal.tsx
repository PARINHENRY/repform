import React from "react";
import { X, CheckCircle2, AlertTriangle, Sparkles, Laptop, ShieldCheck } from "lucide-react";

interface BicepInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTesting?: () => void;
}

export const BicepInstructionsModal: React.FC<BicepInstructionsModalProps> = ({
  isOpen,
  onClose,
  onStartTesting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0c1a28] border border-[#1f5a68] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#091522] border-b border-[#1a3448] px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#35d0e8]/15 border border-[#35d0e8]/30 flex items-center justify-center text-[#35d0e8]">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-[#eaf3fa]">
                  Examiner Visual Guide: Desk Bicep Curls
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-[#f5a83c]/20 text-[#f5a83c] border border-[#f5a83c]/30 font-bold">
                  Quick Testing
                </span>
              </div>
              <p className="text-xs text-[#9db3c2]">
                How to set up, perform, and evaluate upper-body tracking without standing up.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#9db3c2] hover:text-[#eaf3fa] hover:bg-[#1a3448] p-1.5 rounded-lg transition-colors"
            title="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 text-xs text-[#9db3c2]">
          {/* Quick Notice Banner */}
          <div className="bg-[#0e2434] border border-[#1f5a68] rounded-xl p-3.5 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#35d0e8] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-[#eaf3fa] block text-xs">
                Designed for Viva & Prototype Evaluation:
              </strong>
              Traditional squats require 6–8 feet of distance. In this Seated Desk Mode, the examiner
              can sit naturally at their laptop (1–2 ft away) to evaluate MediaPipe joint triangulation,
              real-time degree calculation, rep state transitions, and audio chimes instantly.
            </div>
          </div>

          {/* 3 Illustrated Visual Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1: Start Position */}
            <div className="bg-[#091522] border border-[#1a3448] rounded-xl overflow-hidden flex flex-col shadow-md">
              <div className="relative aspect-[4/3] bg-[#04090e] border-b border-[#1a3448] overflow-hidden">
                <img
                  src="/src/assets/images/bicep_start_pos_1791649018685.jpg"
                  alt="Seated Bicep Curl Start Position"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm font-mono text-[10px] text-[#35d0e8] font-bold border border-[#35d0e8]/40">
                  STEP 1: SETUP
                </span>
              </div>
              <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#eaf3fa] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#35d0e8]" />
                    Extended Start Position
                  </h4>
                  <p className="text-[11px] leading-relaxed mt-1">
                    Sit 1.5–2.5 ft from your laptop. Rest your arm down with your elbow extended
                    (Elbow Angle: <strong>&gt;100°</strong>). Ensure your shoulder, elbow, and hand
                    are visible in the camera frame.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#1a3448] text-[10px] font-mono text-[#5c7a8e]">
                  State: <span className="text-[#35d0e8]">DOWN (Ready)</span>
                </div>
              </div>
            </div>

            {/* Step 2: Peak Contraction */}
            <div className="bg-[#091522] border border-[#1a3448] rounded-xl overflow-hidden flex flex-col shadow-md">
              <div className="relative aspect-[4/3] bg-[#04090e] border-b border-[#1a3448] overflow-hidden">
                <img
                  src="/src/assets/images/bicep_curl_peak_1791649030400.jpg"
                  alt="Peak Bicep Flexion Contraction"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm font-mono text-[10px] text-[#3ddc97] font-bold border border-[#3ddc97]/40">
                  STEP 2: CURL & SQUEEZE
                </span>
              </div>
              <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#eaf3fa] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3ddc97]" />
                    Peak Flexion (&le;75°–85°)
                  </h4>
                  <p className="text-[11px] leading-relaxed mt-1">
                    Curl your forearm upward toward your shoulder. Keep your elbow pinned as the pivot
                    point. The HUD angle badge turns bright green with 95–100% accuracy score.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#1a3448] text-[10px] font-mono text-[#5c7a8e]">
                  State: <span className="text-[#3ddc97]">UP (Peak Flexion)</span>
                </div>
              </div>
            </div>

            {/* Step 3: Form Comparison & Pinned Elbow */}
            <div className="bg-[#091522] border border-[#1a3448] rounded-xl overflow-hidden flex flex-col shadow-md">
              <div className="relative aspect-[4/3] bg-[#04090e] border-b border-[#1a3448] overflow-hidden">
                <img
                  src="/src/assets/images/bicep_form_correct_1791649040917.jpg"
                  alt="Correct Form vs Swinging Elbow"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm font-mono text-[10px] text-[#f5a83c] font-bold border border-[#f5a83c]/40">
                  STEP 3: FORM VERIFICATION
                </span>
              </div>
              <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#eaf3fa] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f5a83c]" />
                    Stationary Elbow Check
                  </h4>
                  <p className="text-[11px] leading-relaxed mt-1">
                    <strong>Avoid swinging your elbow forward</strong> or arching your back. Lower your
                    arm back down past 100° to trigger the success chime and log the 95–100% score to MongoDB.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#1a3448] text-[10px] font-mono text-[#5c7a8e]">
                  Rep Status: <span className="text-[#eaf3fa]">Chime + 100% Score</span>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Architecture for Evaluator */}
          <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#eaf3fa] font-display">
              <ShieldCheck className="w-4 h-4 text-[#35d0e8]" />
              <span>How the Vision Algorithm Works (SIH 2026 Evaluation)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="bg-[#0c1a28] p-3 rounded-lg border border-[#1a3448] space-y-1">
                <span className="text-[#35d0e8] font-mono font-semibold block">1. 3-Point Vector Angle</span>
                <p className="text-[#9db3c2] leading-relaxed">
                  Computes the cosine angle &theta; between Shoulder (11/12), Elbow (13/14), and
                  Wrist (15/16) at 30 FPS.
                </p>
              </div>

              <div className="bg-[#0c1a28] p-3 rounded-lg border border-[#1a3448] space-y-1">
                <span className="text-[#35d0e8] font-mono font-semibold block">2. Finite State Machine</span>
                <p className="text-[#9db3c2] leading-relaxed">
                  Prevents false counts by requiring full extension (&gt;135°), followed by peak
                  flexion (&le;85°), then returning to extension.
                </p>
              </div>

              <div className="bg-[#0c1a28] p-3 rounded-lg border border-[#1a3448] space-y-1">
                <span className="text-[#35d0e8] font-mono font-semibold block">3. 100% Client-Side Privacy</span>
                <p className="text-[#9db3c2] leading-relaxed">
                  WebAssembly runs locally inside the browser. Zero video frames or personal camera
                  streams are sent to external servers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#091522] border-t border-[#1a3448] px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#5c7a8e] font-mono hidden sm:inline">
            Smart India Hackathon 2026 • Project KAYAGNI
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#9db3c2] hover:text-[#eaf3fa] hover:bg-[#14293a] transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onStartTesting) onStartTesting();
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#35d0e8] hover:bg-[#4fdcef] text-[#03181e] transition-colors shadow-md shadow-[#35d0e8]/20"
            >
              Start Testing Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
