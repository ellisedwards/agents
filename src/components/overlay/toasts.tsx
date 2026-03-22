import { useEffect, useState } from "react";
import { useAgentOfficeStore } from "@/components/store";

interface Toast {
  id: string;
  message: string;
  type: "info" | "warn" | "success";
  ts: number;
}

const TOAST_DURATION = 5000;

const TYPE_STYLES = {
  info: "border-blue-500/30 text-blue-300",
  warn: "border-amber-500/30 text-amber-300",
  success: "border-green-500/30 text-green-300",
};

const TYPE_DOT = {
  info: "bg-blue-400",
  warn: "bg-amber-400",
  success: "bg-green-400",
};

export function Toasts() {
  const toasts = useAgentOfficeStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-3 py-1.5 rounded border bg-black/80 backdrop-blur-sm font-mono text-[11px] flex items-center gap-2 animate-fade-in-up ${TYPE_STYLES[t.type]}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[t.type]}`} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
