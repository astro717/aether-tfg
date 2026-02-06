import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons = {
    success: <Check size={16} className="text-emerald-500" />,
    error: <X size={16} className="text-red-500" />,
    warning: <AlertCircle size={16} className="text-amber-500" />,
    info: <Info size={16} className="text-blue-500" />,
  };

  const bgColors = {
    success: "bg-emerald-50/90 border-emerald-200/60",
    error: "bg-red-50/90 border-red-200/60",
    warning: "bg-amber-50/90 border-amber-200/60",
    info: "bg-blue-50/90 border-blue-200/60",
  };

  return (
    <div
      className={`
        pointer-events-auto
        flex items-center gap-3
        px-4 py-3
        rounded-2xl
        backdrop-blur-xl
        border
        shadow-lg shadow-black/5
        animate-toast-enter
        ${bgColors[toast.type]}
      `}
      style={{
        boxShadow: "0 10px 40px -10px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5)",
      }}
    >
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/80 shadow-sm">
        {icons[toast.type]}
      </div>
      <span className="text-sm font-medium text-gray-800">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 p-1 rounded-full hover:bg-black/5 transition-colors"
      >
        <X size={14} className="text-gray-400" />
      </button>
    </div>
  );
}
