import Image, { type ImageProps } from "next/image";

type MediaResource = "image" | "video";

export type CldImageProps = Omit<ImageProps, "src" | "alt" | "loader" | "placeholder" | "blurDataURL"> & {
  cloudName?: string;
  publicId: string;
  alt: string;
  resourceType?: MediaResource;
  focalX?: number | null;
  focalY?: number | null;
  blurDataURL?: string;
};

function cloudinaryUrl({ cloudName, publicId, resourceType, width, quality, focalX, focalY }: {
  cloudName: string;
  publicId: string;
  resourceType: MediaResource;
  width: number;
  quality?: number | string;
  focalX?: number | null;
  focalY?: number | null;
}) {
  if (!cloudName) return "";
  const focal = focalX !== null && focalX !== undefined && focalY !== null && focalY !== undefined
    ? `,g_xy_center,x_${Math.round(focalX * 1000)},y_${Math.round(focalY * 1000)}`
    : ",g_auto";
  const outputFormat = resourceType === "video" ? "f_jpg" : "f_auto";
  const transforms = resourceType === "video" ? `so_0,${outputFormat}` : `${outputFormat},q_auto,c_fill,w_${width}${focal}`;
  const path = encodeURI(publicId).replaceAll("?", "%3F").replaceAll("#", "%23");
  const suffix = resourceType === "video" ? ".jpg" : "";
  void quality;
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/${resourceType}/upload/${transforms}/${path}${suffix}`;
}

export function CldImage({ cloudName, publicId, alt, resourceType = "image", focalX, focalY, blurDataURL, sizes = "100vw", ...props }: CldImageProps) {
  // Keep the Cloudinary URL serializable. Next/Image is a Client Component in
  // Next 16, so a loader callback cannot cross from a Server Component.
  const resolvedCloudName = cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
  const width = typeof props.width === "number" ? props.width : 2000;
  const src = cloudinaryUrl({ cloudName: resolvedCloudName, publicId, resourceType, width, focalX, focalY });
  const hasValidBlur = typeof blurDataURL === "string" && blurDataURL.startsWith("data:");
  if (!src) return null;
  return <Image {...props} src={src} alt={alt} sizes={sizes} placeholder={hasValidBlur ? "blur" : "empty"} blurDataURL={hasValidBlur ? blurDataURL : undefined} />;
}
