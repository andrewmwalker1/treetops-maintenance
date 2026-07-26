// Placeholder screen — proves the scaffold (React, router, Supabase client,
// design tokens) is wired up. Real job list/filtering lands in a later
// build-order step (Section 10, step 4 of the brief).

const tokens = {
  bg: "#E7E2CC",
  paper: "#FBF9F1",
  ink: "#31382D",
  inkSoft: "#78806E",
  mossDark: "#3F5837",
  line: "#DDD6BC",
};

export default function JobsList() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: "'Work Sans', sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: tokens.paper,
          border: `1px solid ${tokens.line}`,
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontFamily: "'Lora', serif",
            fontWeight: 700,
            color: tokens.mossDark,
            margin: 0,
          }}
        >
          Tree Tops Maintenance
        </h1>
        <p style={{ color: tokens.inkSoft }}>Scaffold running. Jobs list lands next.</p>
      </div>
    </div>
  );
}
