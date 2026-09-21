// Kit ID with its make and model underneath (when set) -- the Kit ID alone
// doesn't tell you which of several small tractors you're picking. Used by
// the check-out/check-in lists in both the kiosk and the main app.
export function equipmentMakeModel(equipment) {
  return [equipment?.make, equipment?.model].filter(Boolean).join(" ");
}

export default function EquipmentLabel({ equipment, subSize = "var(--text-sm)" }) {
  const makeModel = equipmentMakeModel(equipment);
  if (!makeModel) return <span>{equipment.name}</span>;
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
      <span>{equipment.name}</span>
      <span style={{ fontSize: subSize, fontWeight: 400 }}>{makeModel}</span>
    </span>
  );
}
