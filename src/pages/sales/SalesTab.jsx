import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext.jsx";
import { querySales, isSaleOverdueWithoutCover } from "../../lib/caravanSalesQuery.js";
import { colors } from "../../lib/theme.js";
import { Button, EmptyState, PageHeader, Pill, SkeletonList, Table } from "../../ui/index.js";

export default function SalesTab() {
  const { activeSite, terminology } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSite) return;
    querySales(activeSite.id)
      .then(setSales)
      .finally(() => setLoading(false));
  }, [activeSite]);

  return (
    <div>
      <PageHeader
        title="Sales"
        actions={<Button variant="primary" onClick={() => navigate("/office-hub/sales/new")}>+ New sale</Button>}
      />
      {loading ? (
        <SkeletonList rows={4} height={56} />
      ) : sales.length === 0 ? (
        <EmptyState title="No sales yet">Add one with "+ New sale" once an order's been agreed.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>{terminology.pitch || "Pitch"}</th>
              <th>Caravan</th>
              <th>Stage</th>
              <th>Order date</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const overdue = isSaleOverdueWithoutCover(sale);
              return (
                <tr key={sale.id} onClick={() => navigate(`/office-hub/sales/${sale.id}`)} style={{ cursor: "pointer" }}>
                  <td>{[sale.forename, sale.surname].filter(Boolean).join(" ")}</td>
                  <td>{sale.pitch?.pitch_number_or_name || "—"}</td>
                  <td>{[sale.caravan_make, sale.caravan_model].filter(Boolean).join(" ") || "—"}</td>
                  <td>
                    {sale.is_complete ? (
                      <Pill tone="ok">Complete</Pill>
                    ) : overdue ? (
                      <Pill tone="danger">Needs attention</Pill>
                    ) : (
                      <Pill tone="warn">In progress</Pill>
                    )}
                  </td>
                  <td style={{ color: colors.inkSoft }}>{new Date(sale.created_at).toLocaleDateString("en-GB")}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
