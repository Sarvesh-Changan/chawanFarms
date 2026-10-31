import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const cspPolicy = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
    : "script-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' blob: https://res.cloudinary.com",
  isDev
    ? "connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://challenges.cloudflare.com ws: wss:"
    : "connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://challenges.cloudflare.com",
  !isDev ? "report-uri /api/csp-report" : "",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: cspPolicy,
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/experience", destination: "/experiences", permanent: true },
      { source: "/find-us", destination: "/contact#find-us", permanent: true },
      { source: "/location", destination: "/contact#find-us", permanent: true },
      { source: "/offers", destination: "/packages", permanent: true },
      { source: "/admin/cms", destination: "/admin", permanent: true },
      { source: "/admin/cms/pages", destination: "/admin", permanent: true },
      { source: "/admin/cms/policies/:path*", destination: "/admin/settings/policies/:path*", permanent: true },
      { source: "/admin/cms/packages/:path*", destination: "/admin/packages/:path*", permanent: true },
      { source: "/admin/cms/accommodations/:path*", destination: "/admin/accommodation/:path*", permanent: true },
      { source: "/admin/cms/activity/:path*", destination: "/admin/activities/:path*", permanent: true },
      { source: "/admin/cms/experience/:path*", destination: "/admin/experiences-legacy/:path*", permanent: true },
      { source: "/admin/cms/menu-category/:path*", destination: "/admin/menu/menu-category/:path*", permanent: true },
      { source: "/admin/cms/menu-item/:path*", destination: "/admin/menu/menu-item/:path*", permanent: true },
      { source: "/admin/cms/faq/:path*", destination: "/admin/faqs/:path*", permanent: true },
      { source: "/admin/cms/gallery-item/:path*", destination: "/admin/gallery/:path*", permanent: true },
      { source: "/admin/cms/post/:path*", destination: "/admin/stories/:path*", permanent: true },
      { source: "/admin/cms/post-category/:path*", destination: "/admin/stories", permanent: true },
      { source: "/admin/cms/offer/:path*", destination: "/admin", permanent: true },
      { source: "/admin/cms/testimonial/:path*", destination: "/admin", permanent: true },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
