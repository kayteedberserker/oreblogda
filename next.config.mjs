/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["res.cloudinary.com"], // allow Cloudinary images
  },
  async redirects() {
    return [
      {
        source: '/download',
        destination: 'https://expo.dev/artifacts/eas/t81hLZrqffFmwSjYZRvHEo.apk',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;