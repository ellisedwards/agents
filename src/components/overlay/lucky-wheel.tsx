import { useState, useEffect, useRef, useCallback } from "react";

interface LuckyWheelProps {
  agentName: string;
  teamColor: string;
  onResult: (multiplier: number) => void;
  onClose: () => void;
}

// 20 segments: 8x2x, 5x3x, 4x5x, 2x10x, 1x50x
const SEGMENTS: { multiplier: number; label: string; color: string; textColor: string }[] = [
  { multiplier: 2, label: "2x", color: "#3a3a42", textColor: "#aaaaaa" },
  { multiplier: 3, label: "3x", color: "#2a3a5a", textColor: "#6699cc" },
  { multiplier: 2, label: "2x", color: "#3a3a42", textColor: "#aaaaaa" },
  { multiplier: 5, label: "5x", color: "#2a4a3a", textColor: "#55cc77" },
  { multiplier: 2, label: "2x", color: "#3a3a42", textColor: "#aaaaaa" },
  { multiplier: 3, label: "3x", color: "#2a3a5a", textColor: "#6699cc" },
  { multiplier: 10, label: "10x", color: "#4a3a1a", textColor: "#ffcc44" },
  { multiplier: 2, label: "2x", color: "#3a3a42", textColor: "#aaaaaa" },
  { multiplier: 5, label: "5x", color: "#2a4a3a", textColor: "#55cc77" },
  { multiplier: 3, label: "3x", color: "#2a3a5a", textColor: "#6699cc" },
  { multiplier: 2, label: "2x", color: "#3a3a42", textColor: "#aaaaaa" },
  { multiplier: 2, label: "2x", color: "#3a3a42", textColor: "#aaaaaa" },
  { multiplier: 5, label: "5x", color: "#2a4a3a", textColor: "#55cc77" },
  { multiplier: 3, label: "3x", color: "#2a3a5a", textColor: "#6699cc" },
  { multiplier: 2, label: "2x", color: "#3a3a42", textColor: "#aaaaaa" },
  { multiplier: 50, label: "JACKPOT 50x", color: "#5a4a0a", textColor: "#ffdd55" },
  { multiplier: 5, label: "5x", color: "#2a4a3a", textColor: "#55cc77" },
  { multiplier: 2, label: "2x", color: "#3a3a42", textColor: "#aaaaaa" },
  { multiplier: 10, label: "10x", color: "#4a3a1a", textColor: "#ffcc44" },
  { multiplier: 3, label: "3x", color: "#2a3a5a", textColor: "#6699cc" },
];

const SEGMENT_HEIGHT = 40;
const VISIBLE_SEGMENTS = 7; // show 7 segments at a time
const STRIP_HEIGHT = SEGMENTS.length * SEGMENT_HEIGHT;

export default function LuckyWheel({ agentName, teamColor, onResult, onClose }: LuckyWheelProps) {
  const [phase, setPhase] = useState<"spinning" | "result" | "fadeout">("spinning");
  const [offset, setOffset] = useState(0);
  const [resultMultiplier, setResultMultiplier] = useState(0);
  const [resultLabel, setResultLabel] = useState("");
  const [resultColor, setResultColor] = useState("");
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const targetOffsetRef = useRef(0);
  const startOffsetRef = useRef(0);

  const spinDuration = 4000; // 4 seconds

  const startSpin = useCallback(() => {
    // Pick a random winning segment
    const winIdx = Math.floor(Math.random() * SEGMENTS.length);
    const winner = SEGMENTS[winIdx];

    // Calculate target: spin several full rotations + land on winning segment
    // Center the winning segment in the viewport
    const fullRotations = 3 + Math.floor(Math.random() * 3); // 3-5 full rotations
    const targetSegmentCenter = winIdx * SEGMENT_HEIGHT + SEGMENT_HEIGHT / 2;
    const viewportCenter = (VISIBLE_SEGMENTS * SEGMENT_HEIGHT) / 2;
    const target = fullRotations * STRIP_HEIGHT + targetSegmentCenter - viewportCenter;

    startOffsetRef.current = 0;
    targetOffsetRef.current = target;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / spinDuration, 1);
      // Deceleration curve: cubic ease-out for exciting near-misses
      const eased = 1 - Math.pow(1 - t, 3);
      const currentOffset = startOffsetRef.current + (targetOffsetRef.current - startOffsetRef.current) * eased;
      setOffset(currentOffset);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Done spinning
        setResultMultiplier(winner.multiplier);
        setResultLabel(winner.label);
        setResultColor(winner.textColor);
        setPhase("result");
        // Flash result for 2 seconds then fade
        setTimeout(() => {
          setPhase("fadeout");
          onResult(winner.multiplier);
          setTimeout(() => onClose(), 600);
        }, 2000);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [onResult, onClose]);

  useEffect(() => {
    startSpin();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startSpin]);

  // Build a repeated strip for seamless wrapping
  const repeatedSegments = [...SEGMENTS, ...SEGMENTS, ...SEGMENTS, ...SEGMENTS, ...SEGMENTS];
  const wrappedOffset = offset % STRIP_HEIGHT;

  const isJackpot = resultMultiplier === 50;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        opacity: phase === "fadeout" ? 0 : 1,
        transition: "opacity 0.5s ease-out",
      }}
    >
      <div
        className="rounded-[7px] p-4 flex flex-col items-center gap-3"
        style={{
          backgroundColor: "rgba(31, 31, 36, 0.94)",
          border: `2px solid ${teamColor}44`,
          minWidth: 200,
        }}
      >
        {/* Title */}
        <div className="font-mono text-[13px] text-white/80 font-bold tracking-wide">
          Lucky Pokeball!
        </div>
        <div className="font-mono text-[10px] text-white/40">
          {agentName}
        </div>

        {/* Wheel viewport */}
        <div className="relative" style={{ width: 160, height: VISIBLE_SEGMENTS * SEGMENT_HEIGHT, overflow: "hidden" }}>
          {/* Pointer arrow on the left */}
          <div
            className="absolute z-10"
            style={{
              left: -2,
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
              borderLeft: "10px solid #ffcc44",
              filter: "drop-shadow(0 0 4px #ffcc44)",
            }}
          />
          {/* Center line indicator */}
          <div
            className="absolute z-10 w-full"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: SEGMENT_HEIGHT,
              border: "2px solid #ffcc4466",
              borderRadius: 4,
              pointerEvents: "none",
            }}
          />

          {/* Scrolling strip */}
          <div
            style={{
              transform: `translateY(${-wrappedOffset}px)`,
              position: "absolute",
              left: 12,
              right: 0,
              top: 0,
            }}
          >
            {repeatedSegments.map((seg, i) => (
              <div
                key={i}
                className="flex items-center justify-center font-mono font-bold"
                style={{
                  height: SEGMENT_HEIGHT,
                  backgroundColor: seg.color,
                  color: seg.textColor,
                  fontSize: seg.multiplier >= 50 ? 14 : seg.multiplier >= 10 ? 16 : 18,
                  borderBottom: "2px solid #1a1a22",
                  textShadow: seg.multiplier >= 10 ? `0 0 8px ${seg.textColor}66` : "none",
                  letterSpacing: "0.05em",
                }}
              >
                {seg.label}
              </div>
            ))}
          </div>
        </div>

        {/* Result display */}
        {phase === "result" && (
          <div
            className="font-mono text-center"
            style={{ animation: "luckyResultFlash 0.3s ease-out" }}
          >
            <div
              className="text-[24px] font-bold"
              style={{
                color: resultColor,
                textShadow: `0 0 12px ${resultColor}, 0 0 24px ${resultColor}80`,
              }}
            >
              {resultLabel}
            </div>
            <div className="text-[10px] text-white/50 mt-1">
              {isJackpot ? "JACKPOT! Next 10 uses!" : `Next 10 tool uses!`}
            </div>
          </div>
        )}

        <style>{`
          @keyframes luckyResultFlash {
            0% { opacity: 0; transform: scale(0.5); }
            50% { transform: scale(1.3); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}
