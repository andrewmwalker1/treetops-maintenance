// Moved to src/ui/Modal.jsx, which adds Escape-to-close, a focus trap and
// scroll locking. Re-exported from here so the screens that already import
// this path keep working unchanged; new code should import from src/ui.
export { default } from "../ui/Modal.jsx";
