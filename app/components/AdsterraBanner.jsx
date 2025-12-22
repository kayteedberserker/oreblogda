'use client';

export default function AdsterraBanner({ adKey, width = 320, height = 50 }) {
  // We use the iframe source provided by Adsterra for repeating ads
  const iframeSrc = `//www.highperformanceformat.com/watchnew?key=${adKey}`;

  return (
    <div className="flex justify-center items-center my-6 overflow-hidden">
      <iframe
        src={iframeSrc}
        width={width}
        height={height}
        frameBorder="0"
        scrolling="no"
        className="rounded shadow-sm"
        title={`ad-${adKey}`}
      />
    </div>
  );
}