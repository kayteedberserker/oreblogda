// next.config.js
const withPWA = require("next-pwa");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["res.cloudinary.com"],
  },
  turbopack: {}, // disables Turbopack for custom webpack setups
};

module.exports = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  ...nextConfig,
});
