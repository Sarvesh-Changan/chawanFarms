import { ClosingCta } from "@/components/marketing/ClosingCta";
import { getPublicSettings } from "@/server/services/public-content";

export async function PublicClosing() {
  const settings = await getPublicSettings();
  return <ClosingCta settings={settings}/>;
}
