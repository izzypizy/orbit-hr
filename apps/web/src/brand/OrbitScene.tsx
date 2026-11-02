import { CalendarOutlined, ClockCircleOutlined, FileTextOutlined, StarOutlined, WalletOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { tones, type Tone } from '../theme';
import { PersonAvatar } from '../ui';
import { OrbitMark } from './Logo';

interface Satellite {
  angle: number; // starting position on the ring, degrees
  content: ReactNode;
}

interface Ring {
  size: number; // diameter as % of the scene
  seconds: number; // time for one full turn
  dashed?: boolean;
  reverse?: boolean;
  satellites: Satellite[];
}

const pill = (icon: ReactNode, tone: Tone, label: string) => (
  <div className="orbit-pill">
    <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', background: tones[tone].bg, color: tones[tone].fg, fontSize: 12 }}>
      {icon}
    </span>
    {label}
  </div>
);

const person = (name: string) => (
  <div style={{ borderRadius: '50%', padding: 3, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}>
    <PersonAvatar name={name} size={34} />
  </div>
);

// People orbit close to the core; the services they use orbit further out.
const RINGS: Ring[] = [
  { size: 40, seconds: 50, satellites: [{ angle: 20, content: person('Siti Aminah') }, { angle: 200, content: person('Kumar Raj') }] },
  {
    size: 66, seconds: 80, dashed: true, reverse: true,
    satellites: [
      { angle: 60, content: pill(<CalendarOutlined />, 'violet', 'Leave approved') },
      { angle: 180, content: person('Daniel Lim') },
      { angle: 300, content: pill(<WalletOutlined />, 'amber', 'Claim paid') },
    ],
  },
  {
    size: 94, seconds: 120,
    satellites: [
      { angle: 0, content: pill(<FileTextOutlined />, 'green', 'Payslip ready') },
      { angle: 100, content: person('Aisha Rahman') },
      { angle: 160, content: pill(<ClockCircleOutlined />, 'blue', 'Clocked in 08:52') },
      { angle: 250, content: pill(<StarOutlined />, 'pink', 'Review completed') },
      { angle: 320, content: person('Priya Nair') },
    ],
  },
];

/** The Orbit brand scene: your people at the centre, HR moments circling around them. */
export function OrbitScene({ className }: { className?: string }) {
  return (
    <div className={`orbit-scene ${className ?? ''}`} aria-hidden="true">
      <div className="orbit-core"><OrbitMark size={88} /></div>
      {RINGS.map((ring, i) => (
        <div
          key={i}
          className={`orbit-ring${ring.dashed ? ' dashed' : ''}`}
          style={{
            width: `${ring.size}%`,
            height: `${ring.size}%`,
            marginLeft: `-${ring.size / 2}%`,
            marginTop: `-${ring.size / 2}%`,
            animationDuration: `${ring.seconds}s`,
            animationDirection: ring.reverse ? 'reverse' : 'normal',
          }}
        >
          {ring.satellites.map((s, j) => (
            // An arm rotated to the starting angle puts the anchor on the ring edge; the anchor undoes that
            // rotation and the spinner undoes the ring's spin, so the content always stays upright.
            <div key={j} className="orbit-arm" style={{ transform: `rotate(${s.angle}deg)` }}>
              <div className="orbit-anchor" style={{ transform: `rotate(${-s.angle}deg)` }}>
                <div className="orbit-spinner" style={{ animationDuration: `${ring.seconds}s`, animationDirection: ring.reverse ? 'normal' : 'reverse' }}>
                  <div className="orbit-content">{s.content}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
