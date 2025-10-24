// app/page.jsx
import PostsViewer from "@/components/PostsViewer";
import { ToastContainer } from "react-toastify";
import Navbar from "./components/Navbar";

export default async function HomePage() {
	return (
			
			<div className="mx-auto  p-4">
				<PostsViewer />
				<ToastContainer />
			</div>
	);
}
