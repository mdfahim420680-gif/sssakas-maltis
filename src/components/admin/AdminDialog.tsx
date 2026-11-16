import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Loader2, ShieldAlert, X } from 'lucide-react';

export type AdminDialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'drawer';

export const ADMIN_INPUT_CLASS =
  'w-full h-10 px-3 rounded-xl border border-slate-200/90 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:outline-none focus:border-[#0D63F3] focus:ring-3 focus:ring-[#0D63F3]/12 transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';

export const ADMIN_INPUT_COMPACT_CLASS =
  'w-full h-9 px-3 rounded-xl border border-slate-200/90 bg-white text-xs text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:outline-none focus:border-[#0D63F3] focus:ring-3 focus:ring-[#0D63F3]/12 transition-all disabled:bg-slate-100 disabled:text-slate-500';

export const ADMIN_SELECT_CLASS =
  'w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200/90 bg-white text-[13px] font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:border-[#0D63F3] focus:ring-3 focus:ring-[#0D63F3]/12 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-500';

export const ADMIN_SELECT_COMPACT_CLASS =
  'w-full h-9 pl-2.5 pr-7 rounded-xl border border-slate-200/90 bg-white text-xs font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:border-[#0D63F3] focus:ring-3 focus:ring-[#0D63F3]/12 transition-all cursor-pointer';

export const ADMIN_TEXTAREA_CLASS =
  'w-full p-3 rounded-xl border border-slate-200/90 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:outline-none focus:border-[#0D63F3] focus:ring-3 focus:ring-[#0D63F3]/12 transition-all resize-y';

interface AdminDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  size?: AdminDialogSize;
  isDirty?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<AdminDialogSize, string> = {
  sm: 'max-w-[440px] rounded-2xl',
  md: 'max-w-[540px] rounded-2xl',
  lg: 'max-w-[700px] rounded-2xl',
  xl: 'max-w-[920px] rounded-2xl',
  '2xl': 'max-w-[1160px] rounded-2xl',
  full: 'max-w-[1220px] rounded-2xl',
  drawer: 'max-w-xl h-full rounded-none sm:rounded-l-2xl ml-auto',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AdminDialog({
  open,
  onClose,
  title,
  subtitle,
  badge,
  size = 'lg',
  isDirty = false,
  isSubmitting = false,
  error,
  footer,
  headerActions,
  children,
}: AdminDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const attemptCloseRef = useRef<() => void>(() => {});
  attemptCloseRef.current = () => {
    if (isSubmitting) return;
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setConfirmDiscard(false);
      return;
    }
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => {
      const container = dialogRef.current;
      if (container && !container.contains(document.activeElement)) {
        const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        const preferred = focusables.find((el) => el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') || focusables[0];
        (preferred || container).focus();
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        attemptCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null
        );
        if (focusables.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (!activeEl || activeEl === first || !dialogRef.current.contains(activeEl)) {
            e.preventDefault();
            last.focus();
          }
        } else if (!activeEl || activeEl === last || !dialogRef.current.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const isDrawer = size === 'drawer';

  return (
    <div
      className={`fixed inset-0 z-[85] flex ${
        isDrawer ? 'items-stretch justify-end p-0' : 'items-center justify-center p-3 sm:p-5 lg:p-6'
      } bg-[#071636]/55 backdrop-blur-[2px]`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptCloseRef.current();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full ${SIZE_CLASSES[size]} ${
          isDrawer ? 'max-h-screen' : 'max-h-[90vh]'
        } bg-white shadow-[0_24px_60px_-15px_rgba(7,22,54,0.38)] border border-slate-200/90 flex flex-col overflow-hidden outline-none`}
      >
        {/* Sticky Dialog Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200/80 bg-white shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-[16px] sm:text-[17px] font-extrabold text-[#0B1F4B] tracking-tight leading-snug truncate">
                {title}
              </h2>
              {badge && (
                <span className="px-2 py-0.5 rounded-md bg-blue-50/90 border border-blue-200/70 text-[#0D63F3] text-[10px] font-bold uppercase tracking-wider shrink-0">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={() => attemptCloseRef.current()}
              disabled={isSubmitting}
              aria-label={`Close ${title}`}
              className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 hover:border-slate-300 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D63F3]/40 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unsaved Changes Inline Confirmation Banner */}
        {confirmDiscard && (
          <div className="px-5 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <span className="font-semibold text-amber-950 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              You have unsaved changes. Discard changes and close?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="px-3 h-7 rounded-lg border border-amber-300 bg-white text-amber-900 font-bold hover:bg-amber-100/60 transition-colors"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDiscard(false);
                  onClose();
                }}
                className="px-3 h-7 rounded-lg bg-[#EF3E36] text-white font-bold hover:bg-red-700 transition-colors"
              >
                Discard &amp; Close
              </button>
            </div>
          </div>
        )}

        {/* Inline Error Alert */}
        {error && (
          <div
            role="alert"
            className="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-red-50/90 border border-red-200 flex items-start gap-2.5 text-xs text-red-800 shrink-0"
          >
            <AlertCircle className="w-4 h-4 text-[#EF3E36] shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 bg-[#F4F7FB] [scrollbar-width:thin]">
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200/80 bg-white flex flex-wrap items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';
  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={title}
      badge={isDanger ? 'Confirm Action' : 'Confirmation'}
      size="sm"
      isSubmitting={loading}
      footer={
        <>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void onConfirm();
            }}
            className={`px-4 h-9 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 whitespace-nowrap ${
              isDanger ? 'bg-[#EF3E36] hover:bg-red-700' : 'bg-[#0D63F3] hover:bg-[#0A52CC]'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </>
      }
    >
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex items-start gap-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDanger ? 'bg-red-50 text-[#EF3E36] border border-red-100' : 'bg-blue-50 text-[#0D63F3] border border-blue-100'
          }`}
        >
          {isDanger ? <ShieldAlert className="w-5 h-5" /> : <Info className="w-5 h-5" />}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold text-[#0B1F4B]">Please review before proceeding</p>
          <p className="text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
    </AdminDialog>
  );
}

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  icon,
  action,
  children,
  className = '',
}: FormSectionProps) {
  return (
    <section
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-blue-50/90 border border-blue-100 text-[#0D63F3] flex items-center justify-center shrink-0 mt-0.5">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[13px] font-extrabold text-[#0B1F4B] leading-snug">{title}</h3>
            {description && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  rightSlot?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  optional = false,
  hint,
  error,
  rightSlot,
  className = '',
  children,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700 leading-tight">
          {label}
          {required && <span className="text-[#EF3E36] ml-0.5" aria-hidden="true">*</span>}
          {optional && !required && (
            <span className="text-slate-400 font-normal ml-1">(Optional)</span>
          )}
        </label>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
      {children}
      {error ? (
        <p className="text-[11px] font-semibold text-[#EF3E36] flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-slate-400 leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}

interface ToggleSwitchCardProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleSwitchCard({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className = '',
}: ToggleSwitchCardProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer select-none ${
        checked
          ? 'border-[#0D63F3]/35 bg-blue-50/40'
          : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    >
      <div className="min-w-0">
        <span className="block text-xs font-bold text-slate-800 leading-tight">{label}</span>
        {description && <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{description}</span>}
      </div>
      <span className="relative inline-flex items-center shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span className="w-9 h-5 rounded-full bg-slate-300 peer-checked:bg-[#0D63F3] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#0D63F3]/40" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
