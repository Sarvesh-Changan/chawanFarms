import type { Metadata } from "next";

import { PublishedPolicyDocument } from "@/components/cms/PublishedPolicyDocument";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stay Rules & Cancellation Policy · Chawan Farms",
  description:
    "Review farm guidelines, ID requirements, meal policies, and stay cancellation terms at Chawan Farms.",
};

export default function PoliciesPage() {
  return (
    <PublishedPolicyDocument
      keys={["stay-rules-and-cancellation", "cancellation", "stay-rules"]}
      title="Stay Rules & Cancellation Policy"
      emptyMessage="Policy text is being reviewed and will be published when approved."
    />
  );
}
