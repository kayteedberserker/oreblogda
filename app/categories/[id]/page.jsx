import ClientCategoryPage from "./ClientCategoryPage";

const limit = 5;

export default async function CategoryPage({ params }) {
  console.log(" Paramus": + params) 
  const { id } = params;
console.log(id) 
  const category = id
    ? id.includes("-")
      ? id
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("/")
      : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
    : "";
console.log(category) 
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/posts?category=${category}&page=1&limit=${limit}`
  );
  const data = await res.json();
  const initialPosts = data.posts || [];

  return <ClientCategoryPage category={category} initialPosts={initialPosts} />;
}
