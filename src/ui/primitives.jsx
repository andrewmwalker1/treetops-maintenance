// The shared UI primitives. See UI-REDESIGN-PLAN.md phase 2.
//
// Everything here styles itself with real CSS classes (src/ui/ui.css), not
// inline style objects -- that is the whole point of the file. An inline
// style cannot express :hover, :focus-visible, :active or :disabled, so the
// app had none of them; these do.
//
// Every component forwards its remaining props to the underlying element,
// so `className`, `style`, `onClick`, `aria-*` and friends all still work
// where a screen needs an escape hatch.

import { forwardRef } from "react";
import { IconClose, IconAlert, IconInfo, IconCheck, IconInbox } from "./icons.jsx";
import "./ui.css";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/* ===================== Button ===================== */

// `as` lets a react-router <Link> (or a plain <a>) wear the button's
// styling -- a lot of what looked like buttons in this app were actually
// links, each re-implementing `textDecoration: "none"` by hand.
export const Button = forwardRef(function Button(
  { as: As = "button", variant = "secondary", size = "md", block = false, loading = false, icon = null, disabled, className, children, ...rest },
  ref
) {
  const isNativeButton = As === "button";
  return (
    <As
      ref={ref}
      className={cx(
        "tt-btn",
        `tt-btn--${variant}`,
        size !== "md" && `tt-btn--${size}`,
        block && "tt-btn--block",
        loading && "tt-btn--loading",
        className
      )}
      // A non-button element cannot be natively disabled; mark it up so it
      // still reads and styles as disabled rather than silently staying live.
      {...(isNativeButton ? { type: rest.type || "button", disabled: disabled || loading } : {})}
      {...(!isNativeButton && (disabled || loading) ? { "aria-disabled": "true", tabIndex: -1 } : {})}
      {...rest}
    >
      {loading && <span className="tt-btn__spinner" />}
      {!loading && icon && <span className="tt-btn__icon">{icon}</span>}
      {children}
    </As>
  );
});

export const IconButton = forwardRef(function IconButton({ label, size = "md", className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx("tt-iconbtn", size === "sm" && "tt-iconbtn--sm", className)}
      {...rest}
    >
      {children}
    </button>
  );
});

/* ===================== Inputs ===================== */

export const Input = forwardRef(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={cx("tt-input", className)} aria-invalid={invalid ? "true" : undefined} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ invalid, rows = 3, className, ...rest }, ref) {
  return (
    <textarea ref={ref} rows={rows} className={cx("tt-input", className)} aria-invalid={invalid ? "true" : undefined} {...rest} />
  );
});

export const Select = forwardRef(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx("tt-input", className)} aria-invalid={invalid ? "true" : undefined} {...rest}>
      {children}
    </select>
  );
});

// Wraps a label, its control, and any hint or error into one unit, and
// wires up htmlFor / aria-describedby so the association is real rather
// than just visual. Replaces the `<label style={labelStyle}>` + input
// pattern that was hand-written ~150 times, with `fieldStyle` redeclared
// in 28 separate files.
let fieldSeq = 0;
export function Field({ label, hint, error, required = false, htmlFor, children, className, ...rest }) {
  const id = htmlFor || `tt-field-${++fieldSeq}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("tt-field", className)} {...rest}>
      {label && (
        <label className="tt-field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="tt-field__required" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>
      )}
      {typeof children === "function"
        ? children({ id, "aria-describedby": describedBy, invalid: Boolean(error), required })
        : children}
      {error && (
        <p className="tt-field__error" id={errorId}>
          {error}
        </p>
      )}
      {hint && (
        <p className="tt-field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Fieldset({ className, children, ...rest }) {
  return (
    <div className={cx("tt-fieldset", className)} {...rest}>
      {children}
    </div>
  );
}

/* ===================== Card ===================== */

export const Card = forwardRef(function Card(
  { as: As = "div", pad = "md", interactive = false, className, children, ...rest },
  ref
) {
  const padClass = pad === false ? null : pad === "sm" ? "tt-card--pad-sm" : pad === "lg" ? "tt-card--pad-lg" : "tt-card--pad";
  return (
    <As ref={ref} className={cx("tt-card", padClass, interactive && "tt-card--interactive", className)} {...rest}>
      {children}
    </As>
  );
});

/* ===================== Pill / Chip ===================== */

// `color` fills the pill with an arbitrary token (job status, equipment
// status); `tone` picks one of the semantic outlined sets instead.
export function Pill({ tone, color, className, children, ...rest }) {
  return (
    <span
      className={cx("tt-pill", color ? "tt-pill--solid" : `tt-pill--${tone || "neutral"}`, className)}
      style={color ? { background: color, borderColor: color } : undefined}
      {...rest}
    >
      {children}
    </span>
  );
}

export function Chip({ active = false, count, className, children, ...rest }) {
  return (
    <button type="button" aria-pressed={active} className={cx("tt-chip", active && "tt-chip--active", className)} {...rest}>
      {children}
      {count > 0 && <span className="tt-chip__count">{count}</span>}
    </button>
  );
}

/* ===================== PageHeader / Toolbar ===================== */

export function PageHeader({ title, subtitle, actions, level = 1, className, ...rest }) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <div className={cx("tt-pageheader", className)} {...rest}>
      <div>
        <H className={cx("tt-pageheader__title", level !== 1 && "tt-pageheader__title--sub")}>{title}</H>
        {subtitle && <p className="tt-pageheader__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="tt-pageheader__actions">{actions}</div>}
    </div>
  );
}

export function Toolbar({ className, children, ...rest }) {
  return (
    <div className={cx("tt-toolbar", className)} {...rest}>
      {children}
    </div>
  );
}

export function ToolbarSpacer() {
  return <div className="tt-toolbar__spacer" />;
}

export function SectionLabel({ className, children, ...rest }) {
  return (
    <p className={cx("tt-label", className)} {...rest}>
      {children}
    </p>
  );
}

/* ===================== Table ===================== */

// The wrapper is what makes a wide table scroll inside its own box rather
// than pushing the whole page sideways, and it is easy to forget -- so it
// is built in here rather than left to each caller.
export function Table({ stickyFirstColumn = false, className, children, wrapperProps, ...rest }) {
  return (
    <div className="tt-tablewrap" {...wrapperProps}>
      <table className={cx("tt-table", stickyFirstColumn && "tt-table--stickyfirst", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

/* ===================== Alert ===================== */

const ALERT_ICONS = { info: IconInfo, warn: IconAlert, danger: IconAlert, ok: IconCheck };

export function Alert({ tone = "info", title, className, children, ...rest }) {
  const Icon = ALERT_ICONS[tone] || IconInfo;
  return (
    <div className={cx("tt-alert", `tt-alert--${tone}`, className)} role={tone === "danger" ? "alert" : undefined} {...rest}>
      <span className="tt-alert__icon">
        <Icon size={16} />
      </span>
      <div className="tt-alert__body">
        {title && <p className="tt-alert__title">{title}</p>}
        {typeof children === "string" ? <p>{children}</p> : children}
      </div>
    </div>
  );
}

/* ===================== EmptyState ===================== */

export function EmptyState({ title, children, action, icon, className, ...rest }) {
  return (
    <div className={cx("tt-empty", className)} {...rest}>
      <span className="tt-empty__icon">{icon || <IconInbox size={30} />}</span>
      {title && <p className="tt-empty__title">{title}</p>}
      {children && <p className="tt-empty__body">{children}</p>}
      {action}
    </div>
  );
}

/* ===================== Skeleton ===================== */

export function Skeleton({ height = 16, width = "100%", radius, className, style, ...rest }) {
  return (
    <span
      className={cx("tt-skeleton", className)}
      aria-hidden="true"
      style={{ display: "block", height, width, borderRadius: radius, ...style }}
      {...rest}
    />
  );
}

// Stands in for a list while it loads, instead of the bare "Loading…"
// paragraph that ~20 screens used -- which also caused a layout jump the
// moment real content arrived.
export function SkeletonList({ rows = 3, height = 62 }) {
  return (
    <div className="tt-skeleton-stack" aria-busy="true" aria-live="polite">
      <span className="tt-sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius="var(--radius-md)" />
      ))}
    </div>
  );
}

/* ===================== Switch ===================== */

export function Switch({ checked, onChange, label, className, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? "true" : "false"}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cx("tt-switch", className)}
      {...rest}
    />
  );
}

/* ===================== ActionList / ActionGrid ===================== */

// One component behind the Keys hub, the Meters hub, the workshop kiosk
// menu and the key-station menu -- four separate implementations before,
// with four different type scales. `size="kiosk"` is the walk-up
// touchscreen variant; `layout="grid"` lays them out in columns.
export function ActionList({ layout = "list", size = "normal", className, children, ...rest }) {
  return (
    <div
      className={cx("tt-actions", layout === "grid" && "tt-actions--grid", size === "kiosk" && "tt-actions--kiosk", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export const Action = forwardRef(function Action(
  { as: As = "button", variant = "default", icon, description, className, children, ...rest },
  ref
) {
  return (
    <As
      ref={ref}
      className={cx("tt-action", variant !== "default" && `tt-action--${variant}`, className)}
      {...(As === "button" ? { type: rest.type || "button" } : {})}
      {...rest}
    >
      {icon && <span className="tt-action__icon">{icon}</span>}
      <span className="tt-action__label">
        {children}
        {description && <span className="tt-action__desc">{description}</span>}
      </span>
    </As>
  );
});

/* ===================== Modal shell pieces ===================== */

export function ModalHeader({ title, onClose }) {
  return (
    <div className="tt-modal__head">
      <h2 className="tt-modal__title">{title}</h2>
      {onClose && (
        <IconButton label="Close" size="sm" onClick={onClose}>
          <IconClose size={18} />
        </IconButton>
      )}
    </div>
  );
}

export function ModalFooter({ children }) {
  return <div className="tt-modal__foot">{children}</div>;
}
