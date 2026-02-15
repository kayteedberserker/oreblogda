/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["res.cloudinary.com", "flagcdn.com"], // allow Cloudinary images
  },
  experimental: {
    /* * Added 'mongoose' here. 
     * This prevents Next.js from bundling it multiple times, 
     * ensuring your connection cache stays consistent.
     */
    serverComponentsExternalPackages: ["geoip-lite", "mongoose"],
  },
};

export default nextConfig;
