
'use client';

import type { FC } from 'react';
import { useEffect } from 'react';

interface GoogleAdProps {
  client: string;
  slot: string;
  format?: string;
  responsive?: string;
  layout?: string;
  layoutKey?: string;
  style?: React.CSSProperties;
  className?: string;
}

const GoogleAd: FC<GoogleAdProps> = ({
  client,
  slot,
  format = 'auto',
  responsive = 'true',
  layout,
  layoutKey,
  style = { display: 'block' }, // Default style from Google
  className,
}) => {
  // Check for essential props; render nothing if missing.
  if (!client || !slot) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('GoogleAd: client or slot ID is missing. Ad will not render.');
    }
    return null;
  }

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
        // Ensure adsbygoogle is an array before pushing
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } else if (process.env.NODE_ENV === 'development') {
        // Only log warning in development if adsbygoogle is not found
        // It might be blocked by an ad blocker in production, which is expected.
        console.warn(`adsbygoogle.js not loaded for slot ${slot}. Ad may not display if script failed or is blocked.`);
      }
    } catch (err) {
      console.error(`Error pushing ad for slot ${slot}:`, err);
    }
  }, [slot]); // Re-run if slot changes (e.g., dynamic ad slots)

  return (
    <div className={className} style={{ overflow: 'hidden', ...style }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }} // Critical style for Adsense ads to be visible
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
        data-ad-layout={layout}
        data-ad-layout-key={layoutKey}
        aria-hidden="true" // Ads are often non-semantic content for screen readers
      />
    </div>
  );
};

export default GoogleAd;
