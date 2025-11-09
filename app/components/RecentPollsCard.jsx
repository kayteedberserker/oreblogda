"use client";
import useSWR from "swr";
import Link from "next/link";
import Poll from "./Poll";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function RecentPollsCard() {
  const { data, error, isLoading } = useSWR(
    "/api/posts?category=Polls&page=1&limit=2",
    fetcher,
    { refreshInterval: 10000 } // refetch every 10s
  );

  const polls = Array.isArray(data) ? data : data?.posts || [];

  if (isLoading) return <p className="text-gray-500">Loading polls...</p>;
  if (error) return <p className="text-red-500">Failed to load polls</p>;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-md max-h-[50vh] md:max-h-[70vh] shadow-md overflow-y-scroll">
      <h2 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
        Recent Polls
      </h2>

      {polls.length > 0 ? (
        <ul className="space-y-4">
          {polls.map((poll) => (
            <li
              key={poll._id}
              className="p-2 border rounded-md border-gray-200 dark:border-gray-700"
            >
              <p className="text-gray-800 dark:text-gray-100 mb-2 font-medium">
                {poll.message.length > 50
                  ? poll.message.slice(0, 50) + "..."
                  : poll.message}
              </p>

              <Poll
                poll={poll.poll}
                postId={poll._id}
                readOnly={false}
              />

              <Link
                href={`/post/${poll.slug}`}
                className="text-blue-500 hover:underline text-sm mt-1 block"
              >
                View full poll
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No recent polls</p>
      )}

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
