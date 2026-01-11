/**
 * OpenNext Cloudflare Configuration
 * This manual export bypasses strict type checking to ensure
 * the bundle is minified and split to stay under the 3MB limit.
 */
const config = {
  default: {
    minify: true,
  },
  dangerous: {
    splitNextJsBundle: true,
  },
};

export default config;