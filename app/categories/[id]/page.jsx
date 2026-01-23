import ClientCategoryPage from "./ClientCategoryPage";

const limit = 5;

// Define the headers to satisfy middleware security
const INTERNAL_HEADERS = {
  "x-oreblogda-secret": process.env.APP_INTERNAL_SECRET,
  "Content-Type": "application/json",
};

export async function generateMetadata({ params }) {
  const awaitParams = await params;
  const { id } = awaitParams;

  const category = id
    ? id.includes("-")
      ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
      : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
    : "";

  // Added INTERNAL_HEADERS here to prevent 401 in metadata generation
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?category=${category}&page=1&limit=10`,
    { headers: INTERNAL_HEADERS }
  );
  
  if (!res.ok) return { title: `${category} – Oreblogda` };

  const data = await res.json();
  const posts = data.posts || [];

  const description =
    posts.length > 0
      ? posts
          .map((p) => p.message?.slice(0, 100))
          .join(" ")
          .slice(0, 150)
      : `Latest posts in ${category}`;

  return {
    title: `${category} – Oreblogda`,
    description,
    openGraph: {
      title: `${category} – Oreblogda`,
      description,
      url: `https://oreblogda.com/category/${id}`,
      siteName: "Oreblogda",
      type: "website",
      images: [
        {
          url: "https://oreblogda.com/ogimage.png",
          width: 1200,
          height: 630,
          alt: `Oreblogda – ${category}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${category} – Oreblogda`,
      description,
      images: ["https://oreblogda.com/ogimage.png"],
      creator: "@oreblogda",
    },
    alternates: {
      canonical: `https://oreblogda.com/category/${id}`,
    },
  };
}

export default async function CategoryPage({ params }) {
  const checkedParams = await params;
  const { id } = checkedParams; 
  
  const category = id
    ? id.includes("-")
      ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
      : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
    : "";

  // Added INTERNAL_HEADERS to bypass middleware during data fetch
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?category=${category}&page=1&limit=10`,
    {
      headers: INTERNAL_HEADERS,
      next: { revalidate: 600 } // cache for 10 minutes
    }
  );

  // Error handling to prevent "unexpected token in JSON" errors if middleware blocks it
  if (!res.ok) {
    console.error(`⛔ Category fetch failed: ${res.status}`);
    return <ClientCategoryPage category={category} initialPosts={[]} />;
  }

  const data = await res.json();
  const initialPosts = data.posts || [];

  return <ClientCategoryPage category={category} initialPosts={initialPosts} />;
}
