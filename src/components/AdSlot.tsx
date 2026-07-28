import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

// No publisher ID is configured until AdSense approval, so this renders
// nothing in the meantime - the call sites are already wired at their
// final locations for when VITE_ADSENSE_CLIENT_ID is set.
const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;

interface AdSlotProps {
  slotId: string;
  format?: 'auto' | 'fluid';
  minHeight?: number;
  className?: string;
}

export function AdSlot({ slotId, format = 'auto', minHeight = 280, className = '' }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px 0px' },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }, [inView]);

  if (!ADSENSE_CLIENT_ID) return null;

  return (
    // Reserved height before the ad resolves, to avoid layout shift.
    <div ref={containerRef} className={className} style={{ minHeight }}>
      {inView && (
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}
