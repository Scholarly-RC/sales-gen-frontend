import type { Client, ClientExport, User } from "@/types/workspace";

type DashboardItemsProps = {
  clients: Client[];
  salesRecords: ClientExport[];
  users: User[];
};

export function DashboardItems({
  clients,
  salesRecords,
  users,
}: DashboardItemsProps) {
  const activeUsers = users.filter((user) => user.is_active).length;

  const cards = [
    { label: "Total Clients", value: clients.length.toString() },
    { label: "Total Client Sales", value: salesRecords.length.toString() },
    { label: "Total Users", value: users.length.toString() },
    { label: "Active Users", value: activeUsers.toString() },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border/70 bg-background p-4"
        >
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
