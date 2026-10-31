import type { Metadata } from "next";

import { GalleryViewer } from "@/components/gallery/GalleryViewer";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { PublicClosing } from "@/components/marketing/PublicClosing";
import { PublicPageHeader } from "@/components/marketing/PublicPageHeader";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { env } from "@/config/env";
import { filterPublicGalleryItems } from "@/lib/marketing-media";
import { getPublicGallery } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Photo & Video Gallery · Chawan Farms",
  description:
    "Explore authentic moments from Chawan Farms in Baitwadi, Kolad — agricultural landscapes, rural activities, accommodation, and biodiversity.",
};

export default async function GalleryPage() {
  const gallery = await getPublicGallery();
  const items = filterPublicGalleryItems(gallery);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: "Chawan Farms Photo & Video Gallery",
    description:
      "Visual moments from Chawan Farms agri-tourism centre at Baitwadi, Kolad.",
    image: items.map((i) => i.media.publicId),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Header />
      <PublicPageHeader currentPage="Gallery" eyebrow="A look around" title="The farm, in pictures." description="Photographs selected by the farm team." />
      <main className="bg-cream-50/60 pb-20 pt-12 sm:pt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* Interactive Masonry Gallery with Lightbox */}
          <GalleryViewer items={items} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME ?? ""} />
        </div>
      </main>
      <PublicClosing />
      <StickyCtaBar />
      <Footer />
    </>
  );
}
