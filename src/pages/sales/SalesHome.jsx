import { PageHeader, EmptyState, IconFolder } from "../../ui/index.js";

// Landing page for the Sales CRM section. Placeholder until the stock
// list (the first screen being built) lands.
export default function SalesHome() {
  return (
    <div>
      <PageHeader title="Sales" subtitle="Buyer enquiries, stock and deals" />
      <EmptyState title="Coming soon" icon={<IconFolder size={30} />}>
        The stock list is the first part of Sales being built.
      </EmptyState>
    </div>
  );
}
