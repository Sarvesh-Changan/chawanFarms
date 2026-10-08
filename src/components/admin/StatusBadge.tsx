import { Badge } from "@/components/ui/badge";

const primaryStatuses = new Set(["ACTIVE", "CONFIRMED", "APPROVED", "PAID"]);
const secondaryStatuses = new Set(["NEW", "PENDING", "PENDING_CONFIRMATION", "ENQUIRY", "CONTACTED", "QUALIFIED"]);
const destructiveStatuses = new Set(["SUSPENDED", "CANCELLED", "REJECTED"]);

export function StatusBadge({ status }: { status: string }) {
  const label = status.toLowerCase().replaceAll("_", " ");
  const variant = primaryStatuses.has(status) ? "default" : secondaryStatuses.has(status) ? "secondary" : destructiveStatuses.has(status) ? "destructive" : "outline";
  return <Badge variant={variant} className="capitalize">{label}</Badge>;
}
