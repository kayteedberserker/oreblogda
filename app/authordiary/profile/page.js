"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 5;
  const prevScrollHeight = useRef(0);
  const router = useRouter();

  // 🔹 Fetch logged-in user (secure, using JWT)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();

        if (!res.ok || !data?.user) {
          router.push("/login");
          return;
        }

        setUser(data.user);
        setDescription(data.user?.description || "");
      } catch (err) {
        console.error("Error loading user:", err);
        toast.error("Failed to load user data");
      }
    };
    fetchUser();
  }, [router]);

  // 🔹 Fetch user's posts (with pagination + scroll fix)
  const fetchUserPosts = async (pageNum = 1) => {
    if (!user?._id) return;
    try {
      setLoadingPosts(true);
      const res = await fetch(`/api/posts?author=${user._id}&page=${pageNum}&limit=${limit}`);
      const data = await res.json();
      const newPosts = data.posts || [];

      if (newPosts.length < limit) setHasMore(false);

      // preserve scroll position
      prevScrollHeight.current = document.body.scrollHeight;

      setPosts(prev => [...prev, ...newPosts]);

      setTimeout(() => {
        const diff = document.body.scrollHeight - prevScrollHeight.current;
        window.scrollBy({ top: -diff, behavior: "instant" });
      }, 0);
    } catch (err) {
      console.error("Error loading posts:", err);
      toast.error("Failed to load posts");
    } finally {
      setLoadingPosts(false);
    }
  };

  // first load
  useEffect(() => {
    if (user?._id) fetchUserPosts(page);
  }, [user, page]);

  // infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 200 &&
        hasMore &&
        !loadingPosts
      ) {
        setPage(prev => prev + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingPosts]);

  // 🔹 Handle file selection
  const handleFileChange = e => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setPreview(selectedFile ? URL.createObjectURL(selectedFile) : null);
  };

  // 🔹 Update profile
  const handleUpdate = async e => {
    e.preventDefault();
    if (!user?._id) return toast.error("User not found");

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("userId", user._id);
      formData.append("description", description);
      if (file) formData.append("file", file);

      const res = await fetch("/api/users/upload", {
        method: "PUT",
        body: formData,
      });

      const result = await res.json();
      if (res.ok) {
        toast.success("Profile updated successfully!");
        setUser(result.user);
        setFile(null);
        setPreview(null);
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Delete post (secure)
  const handleDelete = async postId => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch("/api/posts/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Post deleted successfully!");
        setPosts(prev => prev.filter(p => p._id !== postId));
      } else {
        toast.error(data.message || "Delete failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting post");
    }
  };

  if (!user) return <div className="p-6 text-center">Loading profile...</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6">Edit Profile</h2>

      {/* Profile Section */}
      <div className="flex flex-col items-center gap-4 mb-6">
        <img
          src={preview || user?.profilePic?.url || "/default-avatar.png"}
          alt="Profile"
          className="w-24 h-24 rounded-full object-cover border shadow"
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="border p-2 rounded w-full"
        />
      </div>

      <form onSubmit={handleUpdate} className="space-y-4 mb-10">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-600">Name</label>
          <input
            type="text"
            value={user.username}
            disabled
            className="border rounded w-full p-2 bg-gray-200 text-black"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-600">Email</label>
          <input
            type="email"
            value={user.email}
            disabled
            className="border rounded w-full p-2 bg-gray-200 text-black"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-600">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="border rounded w-full p-2 h-24"
            placeholder="Write something about yourself..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* User Posts Section */}
      <h3 className="text-xl font-semibold mb-4">Your Posts</h3>
      {loadingPosts && posts.length === 0 ? (
        <p>Loading posts...</p>
      ) : posts.length === 0 ? (
        <p className="text-gray-500">You haven’t posted anything yet.</p>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <div
              key={post._id}
              className="border p-4 rounded-xl flex justify-between items-center hover:shadow-md transition"
            >
              <div>
                <h3 className="font-medium text-lg">{post.title || post.message}</h3>
                <p className="text-gray-500 text-sm">
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(post._id)}
                className="md:text-red-500 text-white hover:cursor-pointer md:hover:text-red-700 border-2 p-1 md:border-0 font-semibold"
              >
                Delete
              </button>
            </div>
          ))}
          {loadingPosts && <p className="text-center text-gray-500">Loading more...</p>}
          {!hasMore && (
            <p className="text-center text-gray-400">No more posts to show</p>
          )}
        </div>
      )}

      <ToastContainer autoClose={2500} />
    </div>
  );
};

export default ProfilePage;
