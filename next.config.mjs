/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public", // service worker and manifest go here
  disable: process.env.NODE_ENV === "development", // disables PWA in dev
});

const nextConfig = {
  images: {
    domains: ["res.cloudinary.com"], // allow Cloudinary images
  },
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
