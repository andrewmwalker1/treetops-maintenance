import { useEffect, useRef } from "react";
import { ModalHeader } from "./primitives.jsx";
import "./ui.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The app's dialog. This is the same component and the same props as the
// original src/components/Modal.jsx (which now re-exports this one), plus
// the three things every dialog is expected to do and this one previously
// did not: close on Escape, keep Tab inside itself, and hand focus back to
// whatever opened it.
//
// Eight files used to hand-roll this same scrim-and-panel markup rather
// than import it. Those are being converted to use this instead.
export default function Modal({ title, onClose, children, maxWidth = "440px", labelledBy }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;

    // Focus the first control in the dialog, falling back to the panel
    // itself, so a keyboard user starts inside it rather than back at the
    // top of the page behind the scrim.
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first || panel)?.focus?.();

    // The page behind a dialog should not scroll under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="tt-modal__scrim" onClick={onClose}>
      <div
        ref={panelRef}
        className="tt-modal"
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <ModalHeader title={title} onClose={onClose} />}
        {children}
      </div>
    </div>
  );
}
