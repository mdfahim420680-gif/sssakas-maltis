import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { RootState } from '../../store';
import { dismissToast } from '../../store/uiSlice';

export function ToastContainer() {
  const toasts = useSelector((s: RootState) => s.ui.toasts);
  const dispatch = useDispatch();

  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => dispatch(dismissToast(latest.id)), 4500);
    return () => clearTimeout(timer);
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : t.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
          );

        const border =
          t.type === 'success'
            ? 'border-emerald-200 bg-white'
            : t.type === 'error'
              ? 'border-red-200 bg-white'
              : t.type === 'warning'
                ? 'border-amber-200 bg-white'
                : 'border-blue-200 bg-white';

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg ${border}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.message && <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{t.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dispatch(dismissToast(t.id))}
              aria-label="Dismiss notification"
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
