// Barrel for the shared UI primitives. Import from here:
//   import { Button, Field, Input, Card, PageHeader } from "../ui/index.js";
//
// House rules (see BUILD-BRIEF.md section 8):
//   - build screens from these, not from raw <button style={{}}>
//   - never re-declare a local `fieldStyle` / `labelStyle` -- use <Field>
//   - all colour, spacing and sizing comes from tokens, never a literal
export * from "./primitives.jsx";
export * from "./icons.jsx";
export { default as Modal } from "./Modal.jsx";
export { default as Menu, MenuItem, MenuHeader, MenuSeparator } from "./Menu.jsx";
