import type { Metadata } from "next";

import { PublishedPolicyDocument } from "@/components/cms/PublishedPolicyDocument";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms & Conditions · Chawan Farms",
  description:
    "Review visitor terms, booking conditions, code of conduct, and guest safety policies for Chawan Farms.",
};

export default function TermsPage() {
  return (
    <PublishedPolicyDocument
      keys={["terms"]}
      title="Terms & Conditions"
      emptyMessage="Terms are awaiting client and legal approval."
    />
  );
}
