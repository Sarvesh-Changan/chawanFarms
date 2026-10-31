import { ExternalLink, MapPin, Phone } from "lucide-react";

type LocationSettings = { address: string; phones: string[] };

const FARM_LOCATION_NAME = "Chawan Farms (Agricultural Farming Centre)";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/@18.4381634,73.2249314,17z?entry=ttu&g_ep=EgoyMDI2MTAyOC4wIKXMDSoASAFQAw%3D%3D";

export function LocationDetails({ settings, howToReach }: { settings: LocationSettings; howToReach?: string }) {
  const mapHref = GOOGLE_MAPS_URL;
  const displayedAddress = settings.address || FARM_LOCATION_NAME;
  return <div className="grid gap-6 lg:grid-cols-2">
    <div className="bg-clay-100 rounded-2xl p-6 sm:p-8">
      <h2 className="font-heading text-forest-900 text-2xl">Find us</h2>
      <address className="text-mist-500 mt-5 flex gap-3 not-italic leading-7"><MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-laterite-600" />{displayedAddress}</address>
      {settings.phones.length ? <div className="mt-5 grid gap-2">{settings.phones.map((phone) => <a key={phone} href={`tel:${phone}`} className="text-forest-700 inline-flex min-h-11 items-center gap-3 text-sm font-semibold hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500"><Phone aria-hidden="true" className="size-4" />{phone}</a>)}</div> : null}
      <a href={mapHref} target="_blank" rel="noopener noreferrer" className="bg-forest-700 text-cream-50 mt-7 inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-semibold hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Open in Google Maps <ExternalLink aria-hidden="true" className="size-4" /></a>
    </div>
    {howToReach ? <section className="border-forest-900/10 rounded-2xl border p-6 sm:p-8"><h2 className="font-heading text-forest-900 text-2xl">How to reach us</h2><p className="text-mist-500 mt-5 whitespace-pre-line text-sm leading-7">{howToReach}</p></section> : null}
  </div>;
}
