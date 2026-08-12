"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, tone?: ToastTone, action?: ToastItem["action"]) => void;
  success: (message: string, action?: ToastItem["action"]) => void;
  error: (message: string, action?: ToastItem["action"]) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  info: "border-line-strong",
  success: "border-ok/40",
  error: "border-danger/50",
};

const TONE_DOT: Record<ToastTone, string> = {
  info: "bg-info",
  success: "bg-ok",
  error: "bg-danger",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info", action?: ToastItem["action"]) => {
      counter.current += 1;
      const id = counter.current;
      setItems((prev) => [...prev.slice(-3), { id, tone, message, action }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, action) => show(message, "success", action),
      error: (message, action) => show(message, "error", action),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 pb-24 sm:items-end sm:pb-4"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface-2/95 px-4 py-3 text-sm shadow-lg shadow-black/40 backdrop-blur ${
              TONE_STYLES[item.tone]
            }`}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} />
            <p className="flex-1 text-ink-soft">{item.message}</p>
            {item.action ? (
              <button
                type="button"
                className="shrink-0 font-medium text-accent hover:underline"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Fermer"
              className="shrink-0 text-muted hover:text-ink"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast doit être utilisé à l'intérieur de ToastProvider");
  return context;
}
