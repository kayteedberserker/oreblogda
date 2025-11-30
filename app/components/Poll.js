 "use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

export default function Poll({ poll, postId, setPosts, readOnly = false }) {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const handleOptionChange = (optionIndex) => {
    if (readOnly || submitted) return;
    if (poll.pollMultiple) {
      setSelectedOptions((prev) =>
        prev.includes(optionIndex)
          ? prev.filter((i) => i !== optionIndex)
          : [...prev, optionIndex]
      );
    } else {
      setSelectedOptions([optionIndex]);
    }
  };
  let fpPromise;
  
    async function getFingerprint() {
      if (!fpPromise) fpPromise = FingerprintJS.load();
      const fp = await fpPromise;
      const result = await fp.get();
      return result.visitorId; // extremely strong fingerprint
    }
  const handleVote = async () => {
  if (readOnly || selectedOptions.length === 0) return;

  try {
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "vote",
        fingerprint: await getFingerprint(),  // ✅ add this
        payload: { selectedOptions },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.message === "Already voted") {
        toast.info("You’ve already voted!");
        setSubmitted(true);
      } else {
        toast.error(data.message || "Vote failed");
      }
      return;
    }

    if (data.message === "Vote added") {
      setPosts((prev) =>
        Array.isArray(prev)
          ? prev.map((p) =>
              p._id === postId ? { ...p, ...(data.post || data) } : p
            )
          : prev
      );
      setSubmitted(true);
      toast.success("Vote submitted!");
    }
  } catch {
    toast.error("Failed to vote");
  }
};


  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <div className="mt-4 p-3 border rounded-md bg-gray-50 dark:bg-gray-700">
      <h4 className="font-semibold mb-3">Poll</h4>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
  {poll.options.map((opt, i) => {
    const percentage = totalVotes ? ((opt.votes / totalVotes) * 100).toFixed(1) : 0;
    return (
      <div key={i} className="mb-3">
        <div className="flex items-center">
          {!readOnly && !submitted && (
            <div>
              <label htmlFor={opt.text} className="sr-only">{opt.text}</label>
              <input
                id={opt.text}
                type={poll.pollMultiple ? "checkbox" : "radio"}
                name={`poll-${postId}`}
                checked={selectedOptions.includes(i)}
                onChange={() => handleOptionChange(i)}
                className="mr-2"
              />
            </div>
          )}
          <span className="text-sm">{opt.text}</span>
          <span className="ml-2 text-gray-500 text-sm">({opt.votes})</span>
        </div>

        <div className="w-full bg-gray-300 dark:bg-gray-600 h-2 rounded mt-1">
          <div
            className="bg-blue-500 h-2 rounded"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        <span className="text-xs text-gray-600 dark:text-gray-400">
          {percentage}% of votes
        </span>
      </div>
    );
  })}
</div>

      {!readOnly && !submitted && (
        <button
          aria-label="Submit vote"
          onClick={handleVote}
          className="px-3 py-1 mt-3 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Submit Vote
        </button>
      )}

      {submitted && <p className="text-sm text-green-600 mt-2">✅ You’ve voted</p>}
    </div>
  );
}
