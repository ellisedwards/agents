import { useState, useEffect, useRef, useCallback } from "react";

interface LuckyWheelProps {
  agentName: string;
  teamColor: string;
  onResult: (multiplier: number) => void;
  onClose: () => void;
}

// 20 segments: 8x2x, 5x3x, 4x5x, 2x10x, 1x50x
const SEGMENTS: { multiplier: number; label: string; bg: string; fg: string }[] = [
  { multiplier: 2,  label: "2x",  bg: "#2e2e36", fg: "#888888" },
  { multiplier: 3,  label: "3x",  bg: "#252e42", fg: "#5588bb" },
  { multiplier: 2,  label: "2x",  bg: "#2e2e36", fg: "#888888" },
  { multiplier: 5,  label: "5x",  bg: "#1e3828", fg: "#44bb66" },
  { multiplier: 2,  label: "2x",  bg: "#2e2e36", fg: "#888888" },
  { multiplier: 3,  label: "3x",  bg: "#252e42", fg: "#5588bb" },
  { multiplier: 10, label: "10x", bg: "#3a3018", fg: "#ddaa33" },
  { multiplier: 2,  label: "2x",  bg: "#2e2e36", fg: "#888888" },
  { multiplier: 5,  label: "5x",  bg: "#1e3828", fg: "#44bb66" },
  { multiplier: 3,  label: "3x",  bg: "#252e42", fg: "#5588bb" },
  { multiplier: 2,  label: "2x",  bg: "#2e2e36", fg: "#888888" },
  { multiplier: 2,  label: "2x",  bg: "#2e2e36", fg: "#888888" },
  { multiplier: 5,  label: "5x",  bg: "#1e3828", fg: "#44bb66" },
  { multiplier: 3,  label: "3x",  bg: "#252e42", fg: "#5588bb" },
  { multiplier: 2,  label: "2x",  bg: "#2e2e36", fg: "#888888" },
  { multiplier: 50, label: "50x", bg: "#44380a", fg: "#ffdd44" },
  { multiplier: 5,  label: "5x",  bg: "#1e3828", fg: "#44bb66" },
  { multiplier: 2,  label: "2x",  bg: "#2e2e36", fg: "#888888" },
  { multiplier: 10, label: "10x", bg: "#3a3018", fg: "#ddaa33" },
  { multiplier: 3,  label: "3x",  bg: "#252e42", fg: "#5588bb" },
];

const SEG_H = 36;
const VISIBLE = 7;
const STRIP_H = SEGMENTS.length * SEG_H;
const SPIN_MS = 3500;

export default function LuckyWheel({ agentName, teamColor, onResult, onClose }: LuckyWheelProps) {
  const [phase, setPhase] = useState<"spinning" | "result" | "fadeout">("spinning");
  const [offset, setOffset] = useState(0);
  const [winner, setWinner] = useState<typeof SEGMENTS[0] | null>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const targetRef = useRef(0);
  const winnerRef = useRef(SEGMENTS[0]);
  const firedRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onCloseRef = useRef(onClose);
  onResultRef.current = onResult;
  onCloseRef.current = onClose;

  const finalize = useCallback((w: typeof SEGMENTS[0]) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    setWinner(w);
    setPhase("result");
    setTimeout(() => {
      setPhase("fadeout");
      if (!firedRef.current) {
        firedRef.current = true;
        onResultRef.current(w.multiplier);
      }
      setTimeout(() => onCloseRef.current(), 500);
    }, 2200);
  }, []);

  // Start spin on mount — stable deps, runs once
  useEffect(() => {
    const winIdx = Math.floor(Math.random() * SEGMENTS.length);
    const w = SEGMENTS[winIdx];
    winnerRef.current = w;

    const fullRotations = 3 + Math.floor(Math.random() * 3);
    const target = fullRotations * STRIP_H + winIdx * SEG_H + SEG_H / 2 - (VISIBLE * SEG_H) / 2;
    targetRef.current = target;
    startRef.current = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - startRef.current) / SPIN_MS, 1);
      // Quartic ease-out — fast start, dramatic slowdown near the end
      const eased = 1 - Math.pow(1 - t, 4);
      setOffset(target * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        finalize(w);
      }
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [finalize]);

  const handleClick = useCallback(() => {
    if (phase === "spinning") {
      finalize(winnerRef.current);
    } else if (phase === "result") {
      setPhase("fadeout");
      if (!firedRef.current) {
        firedRef.current = true;
        onResultRef.current(winnerRef.current.multiplier);
      }
      setTimeout(() => onCloseRef.current(), 200);
    }
  }, [phase, finalize]);

  const strip = [...SEGMENTS, ...SEGMENTS, ...SEGMENTS, ...SEGMENTS, ...SEGMENTS];
  const wrapped = offset % STRIP_H;
  const isJackpot = winner?.multiplier === 50;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleClick}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        opacity: phase === "fadeout" ? 0 : 1,
        transition: "opacity 0.4s ease-out",
        cursor: "pointer",
      }}
    >
      <div
        onClick={handleClick}
        className="flex flex-col items-center gap-2"
        style={{
          backgroundColor: "rgba(22, 22, 28, 0.95)",
          border: `1px solid ${teamColor}33`,
          borderRadius: 10,
          padding: "16px 20px 14px",
          minWidth: 180,
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 60px ${teamColor}15`,
          animation: phase === "spinning" || phase === "result" ? "wheelSlideIn 0.3s ease-out" : undefined,
        }}
      >
        {/* Header */}
        <div className="text-center mb-1">
          <div className="font-mono text-[12px] text-white/70 font-bold tracking-widest uppercase">
            Lucky Pokeball
          </div>
          <div className="font-mono text-[10px] mt-0.5" style={{ color: teamColor + "99" }}>
            {agentName}
          </div>
        </div>

        {/* Wheel viewport */}
        <div
          className="relative"
          style={{
            width: 150,
            height: VISIBLE * SEG_H,
            overflow: "hidden",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Top/bottom fade masks */}
          <div className="absolute inset-x-0 top-0 z-20 pointer-events-none" style={{
            height: SEG_H * 1.5,
            background: "linear-gradient(to bottom, rgba(22,22,28,0.95) 0%, transparent 100%)",
          }} />
          <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none" style={{
            height: SEG_H * 1.5,
            background: "linear-gradient(to top, rgba(22,22,28,0.95) 0%, transparent 100%)",
          }} />

          {/* Center highlight band */}
          <div
            className="absolute inset-x-0 z-10 pointer-events-none"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: SEG_H + 2,
              border: `2px solid ${teamColor}88`,
              borderRadius: 4,
              boxShadow: `0 0 12px ${teamColor}33, inset 0 0 12px ${teamColor}11`,
            }}
          />

          {/* Pointer triangle */}
          <div
            className="absolute z-30"
            style={{
              left: -1,
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderLeft: `8px solid ${teamColor}`,
              filter: `drop-shadow(0 0 3px ${teamColor})`,
            }}
          />

          {/* Scrolling strip */}
          <div style={{
            transform: `translateY(${-wrapped}px)`,
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
          }}>
            {strip.map((seg, i) => (
              <div
                key={i}
                className="flex items-center justify-center font-mono font-bold"
                style={{
                  height: SEG_H,
                  backgroundColor: seg.bg,
                  color: seg.fg,
                  fontSize: seg.multiplier >= 50 ? 15 : seg.multiplier >= 10 ? 17 : 16,
                  borderBottom: "1px solid rgba(0,0,0,0.3)",
                  textShadow: seg.multiplier >= 10 ? `0 0 8px ${seg.fg}55` : "none",
                  letterSpacing: seg.multiplier >= 50 ? "0.15em" : "0.05em",
                }}
              >
                {seg.label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom area */}
        {phase === "spinning" && (
          <div className="font-mono text-[9px] text-white/25 mt-1 select-none">
            click anywhere to skip
          </div>
        )}

        {phase === "result" && winner && (
          <div
            className="text-center mt-1"
            style={{ animation: "resultPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            <div
              className="font-mono font-bold"
              style={{
                fontSize: isJackpot ? 28 : 26,
                color: winner.fg,
                textShadow: `0 0 16px ${winner.fg}, 0 0 32px ${winner.fg}66`,
                letterSpacing: "0.08em",
              }}
            >
              {winner.label}
            </div>
            <div className="font-mono text-[10px] text-white/40 mt-1">
              {isJackpot ? "JACKPOT! Next 10 tool uses!" : "Next 10 tool uses"}
            </div>
            <div className="font-mono text-[9px] text-white/20 mt-2 select-none">
              click to dismiss
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes wheelSlideIn {
          0% { opacity: 0; transform: translateY(12px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes resultPop {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
