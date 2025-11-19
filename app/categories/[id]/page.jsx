import ClientCategoryPage from "./ClientCategoryPage";

const limit = 5;

export default async function CategoryPage({ params }) {
  // destructure directly
  const checkedParams = params
  
  const { id } = checkedParams; 
  console.log("id:", id, params); // should log 'polls'
  
  const category = id
    ? id.includes("-")
      ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
      : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
    : "";

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/posts?category=${category}&page=1&limit=5`
  );
  const data = await res.json();
  const initialPosts = data.posts || [];

  return <ClientCategoryPage category={category} initialPosts={initialPosts} />;
}
