/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["res.cloudinary.com", "flagcdn.com"], // allow Cloudinary images
  },
  experimental: {
    serverComponentsExternalPackages: ["geoip-lite"],
  },
  async redirects() {
    console.log("🚀 Someone tried to install app...");
    return [
      {
        source: '/download',
        destination: 'https://d.apkpure.com/b/APK/com.kaytee.oreblogda?version=latest',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;