import type { Metadata } from "next";

import { PublishedPolicyDocument } from "@/components/cms/PublishedPolicyDocument";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy · Chawan Farms",
  description:
    "Learn how Chawan Farms collects, handles, and protects your personal data and video submissions in accordance with DPDP regulations.",
};

export default function PrivacyPage() {
  return (
    <PublishedPolicyDocument
      keys={["privacy"]}
      title="Privacy Policy"
      emptyMessage="Privacy policy text is awaiting client and legal approval."
    />
  );
}
