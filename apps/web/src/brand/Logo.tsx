import { useId } from 'react';
import { brand } from '../theme';

/**
 * The Orbit mark: a core (your people) with a tilted ring passing behind and in front of it,
 * and a satellite (every HR service) travelling on the ring.
 */
export function OrbitMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
      <defs>
        <linearGradient id={`g${id}`} x1="4" y1="6" x2="36" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor={brand.violet} />
          <stop offset="0.55" stopColor={brand.purple} />
          <stop offset="1" stopColor={brand.pink} />
        </linearGradient>
      </defs>
      {/* back half of the ring */}
      <ellipse cx="20" cy="20" rx="17" ry="7" transform="rotate(-30 20 20)" stroke={`url(#g${id})`} strokeWidth="2.6" opacity="0.55" />
      <circle cx="20" cy="20" r="8.5" fill={`url(#g${id})`} />
      {/* front half of the ring, drawn over the core */}
      <path d="M3 20 A17 7 0 0 0 37 20" transform="rotate(-30 20 20)" stroke={`url(#g${id})`} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="34.7" cy="11.5" r="3.2" fill={brand.cyan} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

/** Mark + "orbit" wordmark. Use tone="light" on dark backgrounds. */
export function Logo({ size = 32, tone = 'dark', suffix }: { size?: number; tone?: 'dark' | 'light'; suffix?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3 }}>
      <OrbitMark size={size} />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size * 0.72,
          letterSpacing: '-0.045em',
          color: tone === 'light' ? '#fff' : brand.space,
          lineHeight: 1,
        }}
      >
        orbit
      </span>
      {suffix && (
        <span
          style={{
            fontSize: size * 0.32,
            fontWeight: 600,
            letterSpacing: '0.08em',
            padding: '2px 6px',
            borderRadius: 6,
            color: tone === 'light' ? 'rgba(255,255,255,0.8)' : brand.violet,
            background: tone === 'light' ? 'rgba(255,255,255,0.12)' : '#F0EEFF',
          }}
        >
          {suffix}
        </span>
      )}
    </span>
  );
}
