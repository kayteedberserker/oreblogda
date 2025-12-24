'use client';

export default function AdsterraBannerSync() {
  // Using the sync-iframe source for the 468x60 key
  const adKey = '210eae0aa8eb0a53c768e9591ea05f9d';
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