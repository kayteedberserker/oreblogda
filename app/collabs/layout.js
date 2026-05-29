import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const metadata = {
    title: "THE SYSTEM // Collabs Hub",
    description: "Secure partner network and campaign deployment node.",
};

export default function CollabsLayout({ children }) {
    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white relative overflow-x-hidden antialiased">
            {/* GLOBAL HUD AMBIENT LIGHTS */}
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

            {/* CORE FRAME CONTENT */}
            <div className="relative z-10">
                {children}
            </div>

            {/* TOAST SYSTEM INSTANCE */}
            <ToastContainer
                position="bottom-right"
                autoClose={4000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            />
        </div>
    );
}