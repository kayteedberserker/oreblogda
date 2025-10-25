// app/page.jsx
import PostsViewer from "@/app/components/PostsViewer";
import { ToastContainer } from "react-toastify";
import Navbar from "@/app/components/Navbar";

export default async function HomePage() {
	return (
			
			<div className="mx-auto  p-4 relative min-h-[70vh]">
				{/* Subtle anime glow */}
				<div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
				<div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

				<PostsViewer />
				<ToastContainer />
			</div>
	);
}
