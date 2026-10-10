import React, { useState } from "react";
import { ExternalLink, Copy, Check, X, AlertCircle } from "lucide-react";

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SurveyModal: React.FC<SurveyModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  // Default Google Forms survey link for SIH26196 / Kayagni
  const [surveyLink, setSurveyLink] = useState(
    "https://forms.gle/kayagni-sih2026-surveyhttps://docs.google.com/document/d/1Ev_-UsNTTqAOYSc2nMYPMRRKJLREFG40-YMGBb-azKs/edit?usp=sharing"
  );

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(surveyLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0e1f2e] border border-[#1a3448] w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
        {/* Close icon */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9db3c2] hover:text-[#eaf3fa] p-1.5 rounded-lg hover:bg-[#1a3448] transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#35d0e8]/10 border border-[#35d0e8]/30 flex items-center justify-center text-[#35d0e8] shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-[#eaf3fa]">
              Before You Continue to Prototype
            </h3>
            <span className="text-[11px] text-[#f5a83c] font-mono font-medium">
              SIH 2026 • Kayagni Survey
            </span>
          </div>
        </div>

        {/* Message requested by user */}
        <p className="text-xs text-[#9db3c2] leading-relaxed mb-4">
          Sorry for the inconvenience! Here is the survey report, as the one in the PDF was not
          translated into a hyperlink.
        </p>

        {/* Attached Survey Link Box */}
        <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-3 mb-5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#5c7a8e] font-mono">Survey Link:</span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-[#35d0e8] hover:underline flex items-center gap-1 font-mono text-[11px]"
            >
              {copied ? <Check className="w-3 h-3 text-[#3ddc97]" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy Link"}</span>
            </button>
          </div>

          <a
            href={surveyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs font-mono text-[#35d0e8] hover:underline truncate bg-[#0c1a28] px-2.5 py-2 rounded-lg border border-[#1f5a68]/40"
            title="Click to open survey link"
          >
            {surveyLink}
          </a>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href={surveyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#35d0e8] hover:bg-[#4fdcef] text-[#04191f] font-bold text-xs transition-colors shadow-md shadow-[#35d0e8]/20"
          >
            <span>Open Survey Link</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#14293a] border border-[#1a3448] hover:bg-[#1f3f58] text-[#eaf3fa] font-semibold text-xs transition-colors"
          >
            Continue to Prototype
          </button>
        </div>
      </div>
    </div>
  );
};
