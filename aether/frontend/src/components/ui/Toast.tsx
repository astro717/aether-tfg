import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, AlertCircle, Info, MessageSquare, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "info" | "warning" | "message";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  onClick?: () => void;
}

interface ToastContextValue {
  showToast: (props: Omit<Toast, "id"> | string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
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

  const showToast = useCallback((props: Omit<Toast, "id"> | string, type: ToastType = "success") => {
    const id = crypto.randomUUID();
    const toastProps = typeof props === "string"
      ? { message: props, type }
      : { ...props, type: props.type || type };

    setToasts((prev) => [...prev, { id, ...toastProps }]);

    // Auto-dismiss
    const duration = toastProps.duration || 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Toast Container - Top Right */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none sm:w-[380px]">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons = {
    success: <CheckCircle size={20} className="text-emerald-500" />,
    error: <AlertCircle size={20} className="text-red-500" />,
    warning: <AlertCircle size={20} className="text-amber-500" />,
    info: <Info size={20} className="text-blue-500" />,
    message: <MessageSquare size={20} className="text-indigo-500" />,
  };

  const bgColors = {
    success: "bg-white dark:bg-zinc-900 border-emerald-100 dark:border-emerald-900/30",
    error: "bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/30",
    warning: "bg-white dark:bg-zinc-900 border-amber-100 dark:border-amber-900/30",
    info: "bg-white dark:bg-zinc-900 border-blue-100 dark:border-blue-900/30",
    message: "bg-white dark:bg-zinc-900 border-indigo-100 dark:border-indigo-900/30",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`
        pointer-events-auto
        w-full
        flex items-start gap-3
        p-4
        rounded-xl
        border
        shadow-lg shadow-black/5 dark:shadow-black/20
        cursor-pointer
        ${bgColors[toast.type]}
      `}
      onClick={() => {
        if (toast.onClick) toast.onClick();
        // optionally dismiss on click?
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
            {toast.title}
          </h4>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {toast.message}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-500 transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
