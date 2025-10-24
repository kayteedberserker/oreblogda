"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Poll from "./Poll"; // your existing Poll component

export default function RecentPollsCard() {
  const [polls, setPolls] = useState([]);

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const res = await fetch("/api/posts?category=Polls&page=1&limit=2");
        const data = await res.json();
        setPolls(Array.isArray(data) ? data : data.posts || []);
      } catch (err) {
        console.error(err);
        setPolls([]);
      }
    };
    fetchPolls();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-md max-h-[50vh] md:max-h-[70vh] shadow-md overflow-y-scroll">
      <h2 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Recent Polls</h2>
      
      {polls.length > 0 ? (
        <ul className="space-y-4">
          {polls.map((poll) => (
            <li key={poll._id} className="p-2 border rounded-md border-gray-200 dark:border-gray-700">
              <p className="text-gray-800 dark:text-gray-100 mb-2 font-medium">
                {poll.message.length > 50 ? poll.message.slice(0, 50) + "..." : poll.message}
              </p>

              {/* Poll Component */}
              <Poll
                poll={poll.poll}
                postId={poll._id}
                setPosts={setPolls}
                readOnly={false} // allow voting
              />

              <Link href={`/post/${poll._id}`} className="text-blue-500 hover:underline text-sm mt-1 block">
                View full poll
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No recent polls</p>
      )}

      {/* Custom thin scrollbar via CSS */}
      <style jsx>{`
        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        div::-webkit-scrollbar-thumb {
          background-color: rgba(107, 114, 128, 0.5);
          border-radius: 10px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background-color: rgba(107, 114, 128, 0.8);
        }
      `}</style>
    </div>
  );
}
