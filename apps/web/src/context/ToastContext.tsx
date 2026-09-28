import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface Toast {
  id: number;
  title: string;
  subtitle?: string;
  tone: "reward" | "levelup" | "boss" | "error";
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// !border-* forces these over .panel's default black border (same CSS specificity,
// declared earlier in the stylesheet - without !important the tone color would lose).
const TONE_STYLES: Record<Toast["tone"], string> = {
  reward: "!border-gold-500 bg-ink-900",
  levelup: "!border-ember-500 bg-gradient-to-br from-ink-900 to-ink-800",
  boss: "!border-red-500 bg-gradient-to-br from-ink-900 to-red-950",
  error: "!border-red-600 bg-ink-900",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`panel toast-pop-in border px-4 py-3 ${TONE_STYLES[t.tone]}`}>
            <p className="font-display text-sm tracking-wide text-gold-400">{t.title}</p>
            {t.subtitle && <p className="mt-0.5 text-sm text-slate-300">{t.subtitle}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
