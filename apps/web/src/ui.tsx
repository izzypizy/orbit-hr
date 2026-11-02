import { Avatar, Card, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { tones, type Tone } from './theme';

const AVATAR_TONES: Tone[] = ['violet', 'green', 'amber', 'blue', 'pink', 'teal'];

/** Avatar with initials and a colour picked consistently from the name. */
export function PersonAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const tone = tones[AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length]];
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Avatar size={size} style={{ background: tone.bg, color: tone.fg, fontWeight: 600, fontSize: size * 0.38, flex: 'none' }}>
      {initials}
    </Avatar>
  );
}

export function IconChip({ icon, tone = 'violet' }: { icon: ReactNode; tone?: Tone }) {
  return <div className="chip" style={{ background: tones[tone].bg, color: tones[tone].fg }}>{icon}</div>;
}

/** Metric card: icon chip, label, big number and an optional hint line. */
export function StatCard({ icon, tone, label, value, suffix, hint, onClick }: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card hoverable={!!onClick} onClick={onClick} style={{ height: '100%' }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <IconChip icon={icon} tone={tone} />
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>{label}</Typography.Text>
          <div style={{ fontSize: 28, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {value}
            {suffix && <span style={{ fontSize: 14, fontWeight: 500, color: '#71717A', marginLeft: 4 }}>{suffix}</span>}
          </div>
          {hint && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{hint}</Typography.Text>}
        </div>
      </Space>
    </Card>
  );
}
