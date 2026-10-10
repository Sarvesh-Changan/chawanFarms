import { PolicyVersionManager } from "@/components/admin/cms/PolicyVersionManager";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { getCmsPageStaff } from "@/server/services/cms/page-access";
import { listPolicyVersions } from "@/server/services/cms/policies";

export default async function CmsPoliciesAdmin() {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const versions = await listPolicyVersions();
  return <section className="space-y-6"><PageHeader title="Policies" description="Create immutable versions for stay rules, cancellation, privacy and terms. Unapproved PDF conflicts remain drafts."/><PolicyVersionManager rows={versions}/></section>;
}
