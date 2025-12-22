'use client';

export default function AdsterraBannerSync() {
  // Using the sync-iframe source for the 468x60 key
  const adKey = '0cfc5dd4d10f00218a78c61ae0f57450';
  const iframeSrc = `//www.highperformanceformat.com/watchnew?key=${adKey}`;

  return (
    <div className="flex justify-center items-center my-6 overflow-hidden w-full">
      <iframe
        src={iframeSrc}
        width="468"
        height="60"
        frameBorder="0"
        scrolling="no"
        className="rounded shadow-sm max-w-full"
        title={`ad-sync-${adKey}`}
      />
    </div>
  );
}