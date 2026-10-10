import { StickyCtaBarClient } from "@/components/marketing/StickyCtaBarClient";
import { getPublicSettings } from "@/server/services/public-content";

export async function StickyCtaBar() {
  const settings = await getPublicSettings();
  return <StickyCtaBarClient phone={settings.phones[0]} whatsappNumber={settings.whatsappNumber || undefined} whatsappMessage={settings.whatsappMessage}/>;
}
