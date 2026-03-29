import { useState, useEffect, useRef, useCallback } from "react";

interface SlotMachineProps {
  agentName: string;
  teamColor: string;
  onResult: (wins: Win[]) => void;
  onClose: () => void;
}

export interface Win {
  label: string;
  multiplier: number;
  uses: number;
}

const SYMBOLS = [
  { id: "poke",    name: "Pokeball",    top: "#ee3333", band: "#222222", tier: 1 },
  { id: "great",   name: "Great Ball",  top: "#3388ee", band: "#222222", tier: 2 },
  { id: "ultra",   name: "Ultra Ball",  top: "#222222", band: "#ddaa22", tier: 3 },
  { id: "premier", name: "Premier",     top: "#ffffff", band: "#ee3333", tier: 4 },
  { id: "master",  name: "Master Ball", top: "#9944cc", band: "#dd44aa", tier: 5 },
] as const;

type SymbolId = typeof SYMBOLS[number]["id"];
const SYM = Object.fromEntries(SYMBOLS.map(s => [s.id, s])) as Record<SymbolId, typeof SYMBOLS[number]>;

// Pixel pokeball component
function Pokeball({ sym, size = 24 }: { sym: typeof SYMBOLS[number]; size?: number }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Top half */}
      <path d={`M ${r},${r} m -${r},0 a ${r},${r} 0 0,1 ${size},0 Z`} fill={sym.top} />
      {/* Bottom half */}
      <path d={`M ${r},${r} m -${r},0 a ${r},${r} 0 0,0 ${size},0 Z`} fill="#f0f0f0" />
      {/* Outline */}
      <circle cx={r} cy={r} r={r - 0.5} fill="none" stroke="#111" strokeWidth={1} />
      {/* Center band */}
      <rect x={0} y={r - 1.5} width={size} height={3} fill={sym.band} />
      {/* Center button */}
      <circle cx={r} cy={r} r={3.5} fill="#f0f0f0" stroke={sym.band} strokeWidth={1.5} />
      <circle cx={r} cy={r} r={1.5} fill={sym.band} />
    </svg>
  );
}

const CELL = 48;
const VISIBLE = 3;
const MAX_PULLS = 5;

const BASE_REEL: SymbolId[] = [
  "poke", "poke", "poke", "poke", "poke",
  "great", "great", "great", "great",
  "ultra", "ultra", "ultra",
  "premier", "premier",
  "master",
];

function shuffle<T>(arr: T[]): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function generateOutcome(pullNum: number, winsCount: number): {
  symbols: [SymbolId, SymbolId, SymbolId];
  nearMiss: boolean;
} {
  const rand = Math.random();
  const needsWin = pullNum >= 4 && winsCount === 0;

  if (needsWin || rand < 0.40) {
    const r = Math.random();
    const sym: SymbolId = r < 0.03 ? "master" : r < 0.10 ? "premier" : r < 0.25 ? "ultra" : r < 0.50 ? "great" : "poke";
    if (Math.random() < 0.40 || needsWin) {
      return { symbols: [sym, sym, sym], nearMiss: false };
    }
    const others = SYMBOLS.filter(s => s.id !== sym).map(s => s.id);
    const other = others[Math.floor(Math.random() * others.length)];
    const pos = [[sym, sym, other], [sym, other, sym], [other, sym, sym]] as [SymbolId, SymbolId, SymbolId][];
    return { symbols: pos[Math.floor(Math.random() * 3)], nearMiss: false };
  }

  if (rand < 0.65) {
    const r = Math.random();
    const sym: SymbolId = r < 0.15 ? "master" : r < 0.35 ? "premier" : r < 0.60 ? "ultra" : r < 0.80 ? "great" : "poke";
    const others = SYMBOLS.filter(s => s.id !== sym).map(s => s.id);
    const other = others[Math.floor(Math.random() * others.length)];
    return { symbols: [sym, sym, other], nearMiss: true };
  }

  const pick = (): SymbolId => {
    const r = Math.random();
    return r < 0.33 ? "poke" : r < 0.55 ? "great" : r < 0.75 ? "ultra" : r < 0.90 ? "premier" : "master";
  };
  let a = pick(), b = pick(), c = pick();
  while (a === b && b === c) c = pick();
  while (a === b || b === c || a === c) {
    if (a === b) b = pick(); else if (b === c) c = pick(); else c = pick();
    if (!(a === b || b === c || a === c)) break;
  }
  return { symbols: [a, b, c], nearMiss: false };
}

function getPrize(a: SymbolId, b: SymbolId, c: SymbolId): Win | null {
  if (a === b && b === c) {
    switch (a) {
      case "poke":    return { label: "TRIPLE POKEBALL", multiplier: 2, uses: 10 };
      case "great":   return { label: "TRIPLE GREAT BALL", multiplier: 3, uses: 10 };
      case "ultra":   return { label: "TRIPLE ULTRA BALL", multiplier: 5, uses: 10 };
      case "premier": return { label: "TRIPLE PREMIER", multiplier: 10, uses: 10 };
      case "master":  return { label: "M A S T E R  B A L L", multiplier: 50, uses: 10 };
    }
  }
  if (a === b || b === c || a === c) {
    const match = a === b ? a : (b === c ? b : a);
    const tier = SYM[match].tier;
    if (tier >= 4) return { label: `DOUBLE ${SYM[match].name.toUpperCase()}`, multiplier: 3, uses: 5 };
    if (tier >= 2) return { label: `DOUBLE ${SYM[match].name.toUpperCase()}`, multiplier: 2, uses: 5 };
  }
  return null;
}

export default function SlotMachine({ agentName, teamColor, onResult, onClose }: SlotMachineProps) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<"ready" | "spinning" | "result" | "summary" | "fadeout">("ready");
  const [strips] = useState(() => [
    [...shuffle(BASE_REEL), ...shuffle(BASE_REEL), ...shuffle(BASE_REEL)],
    [...shuffle(BASE_REEL), ...shuffle(BASE_REEL), ...shuffle(BASE_REEL)],
    [...shuffle(BASE_REEL), ...shuffle(BASE_REEL), ...shuffle(BASE_REEL)],
  ]);
  const [offsets, setOffsets] = useState([0, 0, 0]);
  const [reelStopped, setReelStopped] = useState([true, true, true]);
  const [reelBounce, setReelBounce] = useState([0, 0, 0]); // bounce offset per reel
  const [currentWin, setCurrentWin] = useState<Win | null>(null);
  const [nearMiss, setNearMiss] = useState(false);
  const [allWins, setAllWins] = useState<Win[]>([]);
  const [pullResults, setPullResults] = useState<(Win | null)[]>([]);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const [winLineGlow, setWinLineGlow] = useState(false);

  const rafRef = useRef(0);
  const stoppedRef = useRef([true, true, true]);
  const targetsRef = useRef([0, 0, 0]); // target offsets per reel
  const outcomeRef = useRef<ReturnType<typeof generateOutcome>>({ symbols: ["poke", "poke", "poke"], nearMiss: false });
  const allWinsRef = useRef(allWins);
  allWinsRef.current = allWins;
  const pullRef = useRef(0);
  const onResultRef = useRef(onResult);
  const onCloseRef = useRef(onClose);
  onResultRef.current = onResult;
  onCloseRef.current = onClose;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const findSymInStrip = useCallback((reelIdx: number, sym: SymbolId, afterIdx: number): number => {
    const strip = strips[reelIdx];
    for (let i = afterIdx; i < afterIdx + strip.length; i++) {
      if (strip[i % strip.length] === sym) return i;
    }
    return afterIdx;
  }, [strips]);

  const spin = useCallback(() => {
    if (phaseRef.current === "spinning") return;
    const p = pullRef.current + 1;
    pullRef.current = p;
    setPull(p);
    setPhase("spinning");
    phaseRef.current = "spinning";
    setCurrentWin(null);
    setNearMiss(false);
    setWinLineGlow(false);
    stoppedRef.current = [false, false, false];
    setReelStopped([false, false, false]);
    setReelBounce([0, 0, 0]);

    const outcome = generateOutcome(p, allWinsRef.current.length);
    outcomeRef.current = outcome;

    // Calculate target positions for each reel
    const currentOffsets = [offsets[0], offsets[1], offsets[2]];
    const stripLen = strips[0].length * CELL;
    const newTargets = [0, 1, 2].map((i) => {
      const sym = outcome.symbols[i];
      const currentIdx = Math.ceil(currentOffsets[i] / CELL);
      // At least 2 full rotations ahead + find symbol
      const minIdx = currentIdx + BASE_REEL.length * 2;
      const targetIdx = findSymInStrip(i, sym, minIdx);
      return targetIdx * CELL + CELL / 2 - (VISIBLE * CELL) / 2;
    });
    targetsRef.current = newTargets;

    // Staggered stop times: reel 1 fastest, reel 3 slowest
    // Extra delay on reel 3 if first two match (tension!)
    const twoMatch = outcome.symbols[0] === outcome.symbols[1];
    const stopTimes = [
      1200 + Math.random() * 300,
      2000 + Math.random() * 400,
      (twoMatch || outcome.nearMiss ? 3200 : 2800) + Math.random() * 400,
    ];

    const startTime = performance.now();
    const startOffsets = [...currentOffsets];
    // Speeds: pixels per ms
    const speeds = [0.6, 0.7, 0.8];

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const newOffsets = [0, 1, 2].map((i) => {
        if (stoppedRef.current[i]) return targetsRef.current[i];

        if (elapsed >= stopTimes[i]) {
          // Deceleration phase
          const decelElapsed = elapsed - stopTimes[i];
          const decelDuration = 600; // ms to fully stop
          const t = Math.min(decelElapsed / decelDuration, 1);
          // Ease-out with slight overshoot
          const eased = t < 1
            ? 1 - Math.pow(1 - t, 3)
            : 1;

          const preStopOffset = startOffsets[i] + speeds[i] * stopTimes[i];
          const remaining = targetsRef.current[i] - preStopOffset;
          const current = preStopOffset + remaining * eased;

          if (t >= 1) {
            stoppedRef.current[i] = true;
            setReelStopped(prev => { const n = [...prev]; n[i] = true; return n; });
            // Bounce effect
            setReelBounce(prev => { const n = [...prev]; n[i] = -6; return n; });
            setTimeout(() => setReelBounce(prev => { const n = [...prev]; n[i] = 3; return n; }), 80);
            setTimeout(() => setReelBounce(prev => { const n = [...prev]; n[i] = -1; return n; }), 140);
            setTimeout(() => setReelBounce(prev => { const n = [...prev]; n[i] = 0; return n; }), 200);
          }

          return current;
        }

        // Full speed spinning
        return startOffsets[i] + speeds[i] * elapsed;
      });

      setOffsets(newOffsets);

      if (stoppedRef.current.every(Boolean)) {
        // All stopped — show result
        const win = getPrize(...outcomeRef.current.symbols);
        setCurrentWin(win);
        setNearMiss(outcomeRef.current.nearMiss);
        setPullResults(prev => [...prev, win]);

        if (win) {
          setAllWins(prev => [...prev, win]);
          setWinLineGlow(true);
          const intensity = win.multiplier >= 50 ? 4 : win.multiplier >= 10 ? 3 : win.multiplier >= 5 ? 2 : 1.5;
          setShake(intensity);
          setFlash(win.multiplier >= 50 ? 3 : win.multiplier >= 5 ? 2 : 1);
          setTimeout(() => setShake(0), win.multiplier >= 50 ? 1000 : 500);
          setTimeout(() => setFlash(0), win.multiplier >= 50 ? 1500 : 700);
        }

        setTimeout(() => {
          setPhase("result");
          phaseRef.current = "result";
        }, 300);

        // Auto-advance after showing result
        setTimeout(() => {
          if (pullRef.current >= MAX_PULLS) {
            setPhase("summary");
            phaseRef.current = "summary";
          } else {
            setPhase("ready");
            phaseRef.current = "ready";
            setWinLineGlow(false);
          }
        }, win ? 2200 : 1400);

        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [offsets, strips, findSymInStrip]);

  // Auto-start first spin
  useEffect(() => {
    const t = setTimeout(() => spin(), 700);
    return () => { clearTimeout(t); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(() => {
    if (phaseRef.current === "ready") {
      spin();
    } else if (phaseRef.current === "summary") {
      setPhase("fadeout");
      phaseRef.current = "fadeout";
      onResultRef.current(allWinsRef.current);
      setTimeout(() => onCloseRef.current(), 400);
    }
    // During spinning/result, clicking does nothing — just watch
  }, [spin]);

  // Render reel
  const renderReel = (ri: number) => {
    const strip = strips[ri];
    const offset = offsets[ri];
    const stopped = reelStopped[ri];
    const bounce = reelBounce[ri];
    const stripH = strip.length * CELL;
    const wrapped = ((offset % stripH) + stripH) % stripH;
    const display = [...strip, ...strip, ...strip];
    const speed = stopped ? 0 : Math.abs(offsets[ri] - (targetsRef.current[ri] || 0));

    return (
      <div
        key={ri}
        className="relative overflow-hidden"
        style={{
          width: 56,
          height: VISIBLE * CELL,
          borderRadius: 6,
          background: "rgba(0,0,0,0.35)",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
          borderRight: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {/* Top/bottom vignette */}
        <div className="absolute inset-x-0 top-0 z-10 pointer-events-none" style={{
          height: CELL,
          background: "linear-gradient(to bottom, rgba(16,16,20,0.95) 0%, transparent 100%)",
        }} />
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{
          height: CELL,
          background: "linear-gradient(to top, rgba(16,16,20,0.95) 0%, transparent 100%)",
        }} />

        {/* Win line */}
        <div className="absolute inset-x-0 z-20 pointer-events-none" style={{
          top: "50%",
          transform: "translateY(-50%)",
          height: CELL,
          borderTop: `1px solid ${winLineGlow ? teamColor + "88" : "rgba(255,255,255,0.06)"}`,
          borderBottom: `1px solid ${winLineGlow ? teamColor + "88" : "rgba(255,255,255,0.06)"}`,
          background: winLineGlow ? `${teamColor}11` : undefined,
          transition: "all 0.3s",
        }} />

        <div style={{
          transform: `translateY(${-wrapped + bounce}px)`,
        }}>
          {display.map((sym, i) => (
            <div
              key={i}
              className="flex items-center justify-center select-none"
              style={{
                height: CELL,
                filter: stopped ? "none" : speed > 200 ? "blur(2px)" : "blur(0.8px)",
              }}
            >
              <Pokeball sym={SYM[sym]} size={28} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const isJackpot = currentWin?.multiplier === 50;
  const bestMult = allWins.reduce((m, w) => Math.max(m, w.multiplier), 0);
  const totalUses = allWins.reduce((s, w) => s + w.uses, 0);
  const canSpin = phase === "ready" && pull < MAX_PULLS;

  // Shake animation
  const sx = shake > 0 ? Math.sin(Date.now() * 0.05) * shake * 2 : 0;
  const sy = shake > 0 ? Math.cos(Date.now() * 0.07) * shake * 1.5 : 0;
  useEffect(() => {
    if (shake <= 0) return;
    let go = true;
    const tick = () => { if (go) { setShake(s => s); rafRef.current = requestAnimationFrame(tick); } };
    rafRef.current = requestAnimationFrame(tick);
    return () => { go = false; };
  }, [shake > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: flash > 0
          ? `rgba(${flash >= 3 ? "255,200,50" : "200,220,255"},${flash >= 3 ? 0.12 : 0.06})`
          : "rgba(0,0,0,0.55)",
        opacity: phase === "fadeout" ? 0 : 1,
        transition: flash > 0 ? "background-color 0.1s" : "opacity 0.4s ease-out, background-color 0.3s",
      }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          backgroundColor: "rgba(16, 16, 20, 0.97)",
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: 14,
          padding: "18px 24px 16px",
          minWidth: 240,
          boxShadow: flash >= 3
            ? `0 0 80px ${teamColor}55, 0 0 120px #ffcc4444, inset 0 0 30px ${teamColor}11`
            : flash > 0
            ? `0 0 40px ${teamColor}22`
            : `0 12px 40px rgba(0,0,0,0.6)`,
          animation: "slotSlideIn 0.35s ease-out",
          transform: `translate(${sx}px, ${sy}px)`,
        }}
      >
        {/* Header + close */}
        <div className="relative w-full text-center mb-3">
          <button
            onClick={() => {
              setPhase("fadeout");
              phaseRef.current = "fadeout";
              onResultRef.current(allWinsRef.current);
              setTimeout(() => onCloseRef.current(), 300);
            }}
            className="absolute -top-1 -right-1 font-mono text-[12px] text-white/20 hover:text-white/50 transition-colors w-5 h-5 flex items-center justify-center"
          >
            x
          </button>
          <div
            className="font-mono text-[11px] font-bold tracking-[0.25em] uppercase"
            style={{ color: teamColor + "bb" }}
          >
            Lucky Pokeball
          </div>
          <div className="font-mono text-[9px] text-white/30 mt-0.5">
            {agentName}
          </div>
        </div>

        {/* Reel housing */}
        <div
          className="rounded-lg p-[3px] mb-3"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* Pointer triangles on left and right */}
          <div className="relative">
            <div className="absolute z-30 pointer-events-none" style={{
              left: -7, top: "50%", transform: "translateY(-50%)",
              width: 0, height: 0,
              borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent",
              borderLeft: `6px solid ${teamColor}aa`,
            }} />
            <div className="absolute z-30 pointer-events-none" style={{
              right: -7, top: "50%", transform: "translateY(-50%)",
              width: 0, height: 0,
              borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent",
              borderRight: `6px solid ${teamColor}aa`,
            }} />
            <div className="flex gap-[2px]">
              {[0, 1, 2].map(i => renderReel(i))}
            </div>
          </div>
        </div>

        {/* Win display */}
        <div style={{ minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {phase === "result" && currentWin && (
            <div className="text-center" style={{ animation: "slotWinPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
              <div
                className="font-mono font-bold tracking-wider"
                style={{
                  fontSize: isJackpot ? 18 : 14,
                  color: isJackpot ? "#ffdd44" : currentWin.multiplier >= 10 ? "#ff8844" : teamColor,
                  textShadow: isJackpot
                    ? "0 0 20px #ffdd44, 0 0 40px #ffdd4466"
                    : `0 0 10px ${teamColor}66`,
                }}
              >
                {currentWin.label}
              </div>
              <div className="font-mono text-[10px] mt-0.5" style={{
                color: isJackpot ? "#ffdd44aa" : teamColor + "88",
              }}>
                {currentWin.multiplier}x for {currentWin.uses} uses
              </div>
            </div>
          )}

          {phase === "result" && !currentWin && (
            <div className="font-mono text-[11px]" style={{
              color: nearMiss ? "#ff666699" : "rgba(255,255,255,0.2)",
              animation: nearMiss ? "slotWinPop 0.3s ease-out" : undefined,
            }}>
              {nearMiss ? "SO CLOSE" : "—"}
            </div>
          )}

          {(phase === "spinning") && (
            <div className="font-mono text-[10px] text-white/15">
              &nbsp;
            </div>
          )}
        </div>

        {/* Bottom bar: pulls left + spin button */}
        <div className="flex items-center gap-3 mt-1">
          {/* Pulls remaining */}
          <div className="flex gap-1">
            {Array.from({ length: MAX_PULLS }).map((_, i) => {
              const result = pullResults[i];
              const used = i < pull;
              const won = used && result != null;
              return (
                <div
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: 5,
                    height: 5,
                    backgroundColor: won ? teamColor : used ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    boxShadow: won ? `0 0 4px ${teamColor}` : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* Spin button */}
          <button
            onClick={handleClick}
            disabled={phase === "spinning" || phase === "result" || phase === "fadeout"}
            className="font-mono text-[11px] font-bold px-5 py-1.5 rounded-md transition-all active:scale-95 disabled:opacity-30 disabled:cursor-default"
            style={{
              backgroundColor: canSpin ? `${teamColor}20` : phase === "summary" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
              color: canSpin ? teamColor : phase === "summary" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
              border: `1px solid ${canSpin ? teamColor + "44" : "rgba(255,255,255,0.06)"}`,
              letterSpacing: "0.12em",
              boxShadow: canSpin ? `0 0 16px ${teamColor}15` : undefined,
            }}
          >
            {phase === "summary" ? "DONE" : `SPIN`}
          </button>

          {/* Wins counter */}
          <div className="font-mono text-[9px] text-white/20 min-w-[32px] text-right">
            {allWins.length > 0 ? `${allWins.length}W` : ""}
          </div>
        </div>

        {/* Summary overlay */}
        {phase === "summary" && (
          <div
            className="mt-3 pt-3 border-t border-white/5 text-center w-full"
            style={{ animation: "slotWinPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            {allWins.length > 0 ? (
              <>
                {allWins.map((w, i) => (
                  <div key={i} className="font-mono text-[9px]" style={{ color: teamColor + "aa" }}>
                    {w.label} — {w.multiplier}x ({w.uses})
                  </div>
                ))}
                <div
                  className="font-mono font-bold mt-2"
                  style={{
                    fontSize: bestMult >= 50 ? 22 : 18,
                    color: bestMult >= 50 ? "#ffdd44" : bestMult >= 10 ? "#ff8844" : teamColor,
                    textShadow: bestMult >= 50 ? "0 0 20px #ffdd44, 0 0 40px #ffdd4466" : `0 0 10px ${teamColor}66`,
                  }}
                >
                  {bestMult}x
                </div>
                <div className="font-mono text-[8px] text-white/25 mt-0.5">
                  {totalUses} tool uses
                </div>
              </>
            ) : (
              <div className="font-mono text-[11px] text-white/30 py-1">
                Better luck next time
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slotSlideIn {
          0% { opacity: 0; transform: translateY(16px) scale(0.93); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slotWinPop {
          0% { opacity: 0; transform: scale(0.4); }
          60% { transform: scale(1.12); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
