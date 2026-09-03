import { useEffect, useId, useRef, useState } from "react";
import "./ui.css";

const FOCUSABLE = '[data-menu-item]:not([disabled]):not([aria-disabled="true"])';

// One popover, used everywhere the app needs a dropdown.
//
// Layout.jsx previously carried two of these -- the nav ☰ menu and the
// account menu -- built independently, with different positioning
// strategies (fixed vs absolute), different widths and different padding,
// and neither closed on Escape or kept focus inside itself. This is the
// single implementation both now use.
//
// `trigger` is a render prop rather than an element so the caller can wire
// the open state into its own button styling:
//   <Menu trigger={({ open, ...props }) => <button {...props}>Menu</button>}>
export default function Menu({ trigger, align = "right", children, menuProps = {} }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        // Escape should land the user back on the button they opened, not
        // adrift at the top of the document.
        anchorRef.current?.querySelector("button, a")?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...(menuRef.current?.querySelectorAll(FOCUSABLE) || [])];
      if (items.length === 0) return;
      e.preventDefault();
      const current = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }

    // Pointer-down rather than click: a click listener would also catch the
    // release of the very press that opened the menu on some touch
    // browsers, closing it again immediately.
    function handlePointerDown(e) {
      if (!anchorRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="tt-menu__anchor" ref={anchorRef}>
      {trigger({
        open,
        onClick: () => setOpen((o) => !o),
        "aria-expanded": open,
        "aria-haspopup": "true",
        "aria-controls": open ? id : undefined,
      })}
      {open && (
        <div
          id={id}
          ref={menuRef}
          className={`tt-menu tt-menu--${align}`}
          {...menuProps}
        >
          {typeof children === "function" ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}

// A row inside a Menu. `as` takes a react-router <Link> for navigation
// items; the default is a button for actions.
export function MenuItem({ as: As = "button", danger = false, meta, onClick, onSelect, children, className, ...rest }) {
  return (
    <As
      data-menu-item=""
      className={["tt-menu__item", danger && "tt-menu__item--danger", className].filter(Boolean).join(" ")}
      {...(As === "button" ? { type: "button" } : {})}
      onClick={(e) => {
        onClick?.(e);
        onSelect?.(e);
      }}
      {...rest}
    >
      <span>{children}</span>
      {meta != null && <span className="tt-menu__meta">{meta}</span>}
    </As>
  );
}

export function MenuHeader({ children }) {
  return <div className="tt-menu__head">{children}</div>;
}

export function MenuSeparator() {
  return <div className="tt-menu__sep" role="separator" />;
}
