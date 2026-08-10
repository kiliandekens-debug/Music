"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { IconChevronDown, IconClose, IconSearch } from "./icons";

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

// --- Boutons ----------------------------------------------------------------

type ButtonVariant = "primary" | "subtle" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:brightness-110 active:brightness-95 border border-transparent",
  subtle: "bg-surface-3 text-ink hover:bg-surface-3/70 border border-line",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink border border-transparent",
  outline: "bg-transparent text-ink border border-line hover:border-line-strong hover:bg-surface-2",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
};

export function Button({
  variant = "subtle",
  size = "md",
  className,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium transition-[background-color,border-color,filter,opacity] duration-100",
        "disabled:cursor-not-allowed disabled:opacity-45",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "touch-target inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors duration-100",
        "hover:bg-surface-3 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}

// --- Champs de formulaire ---------------------------------------------------

/**
 * Champ de formulaire étiqueté.
 * L'étiquette est reliée automatiquement au champ qu'elle décrit : si l'enfant
 * n'a pas d'identifiant, on lui en attribue un et on le référence dans le
 * `for` du label. Les lecteurs d'écran annoncent alors le bon libellé, et le
 * clic sur l'étiquette place le curseur dans le champ.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const generatedId = useId();
  const describedById = `${generatedId}-aide`;

  let control = children;
  let controlId = htmlFor;

  if (!controlId && isValidElement(children)) {
    const childProps = children.props as { id?: string };
    controlId = childProps.id ?? generatedId;
    if (!childProps.id) {
      control = cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: controlId,
        "aria-describedby": hint || error ? describedById : undefined,
        "aria-invalid": error ? true : undefined,
      });
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={controlId}
          className="text-[12px] font-medium uppercase tracking-wide text-muted"
        >
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      {control}
      {error ? (
        <p id={describedById} className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={describedById} className="text-[12px] text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const FIELD_BASE =
  "w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-faint " +
  "transition-colors duration-100 hover:border-line-strong focus:border-accent focus:outline-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(FIELD_BASE, "h-9", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(FIELD_BASE, "min-h-20 py-2 leading-relaxed", className)} />;
}

/**
 * Liste déroulante native, habillée.
 * `wrapperClassName` cible l'enveloppe : utile dans une rangée flex où il faut
 * empêcher le champ de se comprimer (`shrink-0`).
 */
export function Select({
  className,
  wrapperClassName,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        {...props}
        className={cn(FIELD_BASE, "h-9 appearance-none pr-8", className)}
      >
        {children}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2 text-sm",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-100",
          checked ? "border-accent bg-accent text-white" : "border-line-strong bg-surface-2",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
        )}
      >
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        ) : null}
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(FIELD_BASE, "h-9 pl-9 pr-8")}
      />
      {value ? (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
        >
          <IconClose size={14} />
        </button>
      ) : null}
    </div>
  );
}

// --- Affichage --------------------------------------------------------------

export type Tone = "neutre" | "info" | "ok" | "warn" | "danger" | "accent";

const TONE_CLASSES: Record<Tone, string> = {
  neutre: "bg-surface-3 text-ink-soft border-line",
  info: "bg-info/10 text-info border-info/25",
  ok: "bg-ok/10 text-ok border-ok/25",
  warn: "bg-warn/10 text-warn border-warn/25",
  danger: "bg-danger/10 text-danger border-danger/25",
  accent: "bg-accent-soft text-accent-ink border-accent/30",
};

export function Badge({
  tone = "neutre",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "accent",
  label,
  showValue = true,
  className,
  size = "md",
}: {
  value: number;
  tone?: "accent" | "ok" | "warn" | "info";
  label?: string;
  showValue?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const colors: Record<string, string> = {
    accent: "var(--accent)",
    ok: "var(--color-ok)",
    warn: "var(--color-warn)",
    info: "var(--color-info)",
  };
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label || showValue ? (
        <div className="flex items-baseline justify-between gap-2">
          {label ? <span className="text-[11px] text-muted">{label}</span> : <span />}
          {showValue ? (
            <span className="tabular text-[11px] font-medium text-ink-soft">{clamped} %</span>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn("w-full overflow-hidden rounded-full bg-surface-3", size === "sm" ? "h-1" : "h-1.5")}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progression"}
      >
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${clamped}%`, backgroundColor: colors[tone] }}
        />
      </div>
    </div>
  );
}

export function Card({
  className,
  children,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div {...props} className={cn("card", interactive && "card-hover cursor-pointer", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  count,
  action,
  className,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
        {title}
        {count !== undefined ? <span className="tabular text-faint">{count}</span> : null}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="text-faint">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink-soft">{title}</p>
        {description ? <p className="max-w-sm text-[13px] text-faint">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

// --- Onglets ----------------------------------------------------------------

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "no-scrollbar flex gap-1 overflow-x-auto border-b border-line",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-100",
              isActive ? "text-ink" : "text-muted hover:text-ink-soft",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 ? (
              <span className="tabular ml-1.5 text-faint">{tab.count}</span>
            ) : null}
            {isActive ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md font-medium transition-colors duration-100",
            size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-3 text-[13px]",
            value === option.value
              ? "bg-surface-3 text-ink"
              : "text-muted hover:text-ink-soft",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// --- Fenêtres modales et panneaux -------------------------------------------

function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
}

/**
 * Fenêtre modale. Sur mobile elle remonte depuis le bas (feuille), sur
 * ordinateur elle est centrée.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  useDismiss(open, onClose);
  if (!open) return null;

  const widths = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fermer"
        className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "animate-sheet sm:animate-rise relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl shadow-black/50",
          "sm:rounded-2xl",
          widths[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[13px] text-muted">{description}</p>
            ) : null}
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <IconClose size={18} />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-safe">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/** Panneau latéral droit : édition rapide sans quitter le contexte. */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
}) {
  const titleId = useId();
  useDismiss(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fermer"
        className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "animate-panel relative flex h-full w-full flex-col border-l border-line bg-surface shadow-2xl shadow-black/50",
          width === "lg" ? "sm:w-[min(880px,92vw)]" : "sm:w-[min(560px,92vw)]",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 pt-safe">
          <div className="min-w-0">
            <div id={titleId} className="truncate text-[15px] font-semibold text-ink">
              {title}
            </div>
            {subtitle ? <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div> : null}
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <IconClose size={18} />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 pb-safe">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

/** Confirmation : réservée aux actions destructrices ou irréversibles. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmer",
  destructive,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-soft">{message}</div>
    </Modal>
  );
}

// --- Menu contextuel --------------------------------------------------------

interface MenuContextValue {
  close: () => void;
}
const MenuContext = createContext<MenuContextValue>({ close: () => {} });

export function Menu({
  trigger,
  children,
  align = "right",
  className,
}: {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger({ onClick: () => setOpen((v) => !v), "aria-expanded": open })}
      {open ? (
        <MenuContext.Provider value={{ close: () => setOpen(false) }}>
          <div
            role="menu"
            className={cn(
              "animate-rise absolute z-40 mt-1 min-w-48 overflow-hidden rounded-xl border border-line bg-surface-2 p-1 shadow-xl shadow-black/50",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {children}
          </div>
        </MenuContext.Provider>
      ) : null}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  destructive,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const { close } = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onClick?.();
        close();
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-100",
        destructive ? "text-danger hover:bg-danger/10" : "text-ink-soft hover:bg-surface-3 hover:text-ink",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      {icon ? <span className="shrink-0 text-faint">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}

// --- Divers -----------------------------------------------------------------

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-faint">{label}</dt>
      <dd className="text-sm text-ink-soft">{children}</dd>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="card px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-xl font-semibold",
          tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[12px] text-faint">{hint}</p> : null}
    </div>
  );
}

/** Bouton de copie avec retour visuel — pas de fausse action. */
export function CopyButton({
  value,
  label = "Copier",
  className,
  size = "sm",
}: {
  value: string;
  label?: string;
  className?: string;
  size?: ButtonSize;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size={size}
      variant="outline"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copié" : label}
    </Button>
  );
}
