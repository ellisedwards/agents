import { useEffect, useState } from "react";

export function ReloadBanner() {
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let knownServerStart = "";
    let knownBuildId = "";
    let active = true;

    // Poll /api/build-id every 3s to detect server restarts + rebuilds
    async function check() {
      while (active) {
        try {
          const res = await fetch("/api/build-id", { signal: AbortSignal.timeout(2000) });
          if (res.ok) {
            const { buildId, serverStartedAt } = await res.json();
            if (!knownServerStart) {
              knownServerStart = serverStartedAt;
              knownBuildId = buildId;
            } else if (serverStartedAt !== knownServerStart) {
              setReason("Server restarted");
              setShow(true);
            } else if (buildId !== knownBuildId && buildId !== "unknown") {
              setReason("New build available");
              setShow(true);
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    check();

    // Also detect Vite HMR updates
    if (import.meta.hot) {
      import.meta.hot.on("vite:afterUpdate", () => {
        setReason("HMR updated");
        setShow(true);
        // Auto-dismiss HMR after 4s (code already applied)
        setTimeout(() => setShow((s) => s ? false : s), 4000);
      });
    }

    return () => { active = false; };
  }, []);

  if (!show) return null;

  const isHMR = reason === "HMR updated";

  return (
    <div
      onClick={() => {
        if (isHMR) {
          setShow(false);
        } else {
          window.location.reload();
        }
      }}
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-1.5 px-4 font-mono text-[11px] cursor-pointer select-none"
      style={{
        background: isHMR ? "rgba(34, 120, 200, 0.9)" : "rgba(180, 120, 20, 0.9)",
        color: "#fff",
        backdropFilter: "blur(4px)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      {reason} — {isHMR ? "click to dismiss" : "click to reload"}
    </div>
  );
}
