import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // The progress-card PDF renderer reads these font files at runtime (Arabic text on the card)
  outputFileTracingIncludes: { "/**": ["./lib/fonts/**"] },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;

// Trigger Next.js restart
