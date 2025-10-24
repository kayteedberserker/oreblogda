// components/SeoClient.js
"use client";

import { DefaultSeo } from "next-seo";

export default function SeoClient({ config }) {
  return <DefaultSeo {...config} />;
}
