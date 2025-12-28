export const metadata = {
  title: "Join Our WhatsApp Channel",
  description: "Join our WhatsApp Channel for anime trivia and updates.",
};

export default function JoinWhatsApp() {
  const channelLink =
    "https://whatsapp.com/channel/0029VbBkiupCRs1wXFWtDG3N";


  return (
    <main className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="text-2xl font-bold mb-3">
          Join Our WhatsApp Channel
        </h1>

        <p className="text-gray-600 mb-4">
          Anime trivia, updates, and featured posts — directly on WhatsApp.
        </p>

        <a
          href={channelLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium"
        >
          Join on WhatsApp
        </a>
        <center>
            <a href="https://oreblogda.com" className="mt-5 w-fit p-3 block bg-gray-600 text-white px-6 py-3 rounded-lg text-xs font-light">Continue to Posts</a>
        </center>
      </div>
    </main>
  );
}
