import { permanentRedirect } from "next/navigation";

export default function LegacyMediaRoute() {
  permanentRedirect("/admin");
}
