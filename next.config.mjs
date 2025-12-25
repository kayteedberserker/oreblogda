/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["res.cloudinary.com"], // allow Cloudinary images
  },
  async redirects() {
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