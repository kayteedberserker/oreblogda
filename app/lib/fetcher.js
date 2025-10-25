"use server"
export const fetcher = async (url) => {
  const fullUrl =
    typeof window === "undefined"
      ? `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${url}`
      : url;

  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error("Failed to fetch data");
  return res.json();
};
