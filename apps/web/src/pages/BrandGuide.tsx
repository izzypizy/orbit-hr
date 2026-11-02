import { ArrowLeftOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Logo, OrbitMark } from '../brand/Logo';
import { brand, tones } from '../theme';
import { IconChip, PersonAvatar } from '../ui';

const SWATCHES = [
  { name: 'Orbit Violet', hex: brand.violet, use: 'Primary actions, links, the mark', dark: true },
  { name: 'Nebula Purple', hex: brand.purple, use: 'Middle of the brand gradient', dark: true },
  { name: 'Comet Pink', hex: brand.pink, use: 'Gradient end, highlights', dark: true },
  { name: 'Satellite Cyan', hex: brand.cyan, use: 'Tiny accents only: the satellite, live dots', dark: false },
  { name: 'Deep Space', hex: brand.space, use: 'Dark surfaces, wordmark, headings', dark: true },
  { name: 'Stardust', hex: brand.stardust, use: 'App background', dark: false },
];

const VOICE = [
  { title: 'Human', body: 'Talk like a helpful colleague, not a system. Use names, not ticket numbers.' },
  { title: 'Clear', body: 'Short sentences. Say what happened and what to do next. No HR jargon.' },
  { title: 'Upbeat', body: 'Warm and positive, never cheesy. Celebrate the good moments, stay calm in the bad ones.' },
];

const EXAMPLES = [
  { good: 'Your leave is approved. Enjoy the break!', bad: 'Request #4471 status changed to APPROVED.' },
  { good: "Payslip for October is ready.", bad: 'Payroll run 2026-10 has been published to ESS.' },
  { good: 'Add a receipt for the flight, then submit.', bad: 'Validation error: mandatory attachment missing.' },
];

function Section({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 48 }}>
      <Typography.Text style={{ color: brand.violet, fontWeight: 600, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{kicker}</Typography.Text>
      <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 20 }}>{title}</Typography.Title>
      {children}
    </section>
  );
}

export default function BrandGuide() {
  const { user } = useAuth();

  return (
    <div style={user ? undefined : { maxWidth: 1180, margin: '0 auto', padding: '24px 16px 64px' }}>
      {!user && (
        <Link to="/" style={{ display: 'inline-block', marginBottom: 16 }}><ArrowLeftOutlined /> Back to sign in</Link>
      )}

      <div className="hero" style={{ padding: '48px 40px' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Logo size={44} tone="light" suffix="HR" />
          <Typography.Title level={2} style={{ fontSize: 44, marginTop: 28 }}>Brand guide</Typography.Title>
          <div className="hero-sub" style={{ fontSize: 17, maxWidth: 560 }}>
            Orbit is the people workspace where everything revolves around your people.
            This page is the single source of truth for how Orbit looks and sounds.
          </div>
        </div>
      </div>

      <Section kicker="01 · Idea" title="Why “Orbit”">
        <Row gutter={[16, 16]}>
          {[
            { tone: 'violet' as const, icon: <OrbitMark size={22} />, t: 'The core is your people', d: 'Employees sit at the centre of everything. Every screen starts from “what does this person need?”' },
            { tone: 'pink' as const, icon: <span style={{ fontWeight: 700 }}>◯</span>, t: 'The ring is HR', d: 'Leave, claims, payroll, reviews: services that circle around people, always within reach.' },
            { tone: 'teal' as const, icon: <span style={{ width: 10, height: 10, borderRadius: '50%', background: brand.cyan, display: 'block' }} />, t: 'The satellite is a moment', d: 'An approval, a payslip, a check-in. Small moments that keep the team moving.' },
          ].map((c) => (
            <Col xs={24} md={8} key={c.t}>
              <Card style={{ height: '100%' }}>
                <IconChip icon={c.icon} tone={c.tone} />
                <Typography.Title level={5} style={{ marginTop: 14 }}>{c.t}</Typography.Title>
                <Typography.Text type="secondary">{c.d}</Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Section>

      <Section kicker="02 · Logo" title="Mark and wordmark">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card style={{ height: 220, display: 'grid', placeItems: 'center' }} styles={{ body: { display: 'grid', placeItems: 'center', height: '100%' } }}>
              <Logo size={56} />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card style={{ height: 220, background: brand.space, borderColor: brand.space }} styles={{ body: { display: 'grid', placeItems: 'center', height: '100%' } }}>
              <Logo size={56} tone="light" />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card styles={{ body: { display: 'grid', placeItems: 'center', height: 140 } }}><OrbitMark size={64} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card styles={{ body: { display: 'grid', placeItems: 'center', height: 140 } }}><Logo size={28} suffix="HR" /></Card>
          </Col>
          <Col xs={24} md={12}>
            <Card style={{ height: '100%' }}>
              <Space direction="vertical" size={6}>
                <Typography.Text><CheckCircleFilled style={{ color: '#16A34A' }} /> Use the mark alone for app icons and favicons (min 16px).</Typography.Text>
                <Typography.Text><CheckCircleFilled style={{ color: '#16A34A' }} /> Keep clear space of half the mark's height around the logo.</Typography.Text>
                <Typography.Text><CloseCircleFilled style={{ color: '#DC2626' }} /> Don't recolour, stretch, outline or add shadows to the mark.</Typography.Text>
                <Typography.Text><CloseCircleFilled style={{ color: '#DC2626' }} /> Don't capitalise the wordmark: it's always “orbit”.</Typography.Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </Section>

      <Section kicker="03 · Colour" title="Palette">
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <div className="swatch" style={{ background: brand.gradient, color: '#fff', height: 100 }}>
              <b>Orbit Gradient</b>
              <span style={{ fontSize: 12, opacity: 0.85 }}>Violet → Purple → Pink at 135°. Hero moments, primary sign-in button, the mark. Use once per screen.</span>
            </div>
          </Col>
          {SWATCHES.map((s) => (
            <Col xs={12} md={8} lg={4} key={s.name}>
              <div className="swatch" style={{ background: s.hex, color: s.dark ? '#fff' : brand.space }}>
                <b style={{ fontSize: 13 }}>{s.name}</b>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{s.hex}</span>
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>{s.use}</Typography.Text>
            </Col>
          ))}
        </Row>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          Supporting tones for icons and status:{' '}
          {Object.entries(tones).map(([k, t]) => <Tag key={k} style={{ background: t.bg, color: t.fg }}>{k}</Tag>)}
        </Typography.Paragraph>
      </Section>

      <Section kicker="04 · Type" title="Typography">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card style={{ height: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Display · Space Grotesk 700 · tracking −4%</Typography.Text>
              <div className="display" style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.04em', margin: '8px 0 16px' }}>
                Everything revolves around <span className="gradient-text">your people.</span>
              </div>
              <Typography.Text type="secondary">Headings, page titles, big numbers and the wordmark.</Typography.Text>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card style={{ height: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Body · Inter 400 / 500 / 600</Typography.Text>
              <Typography.Paragraph style={{ fontSize: 16, marginTop: 8 }}>
                Your annual leave from 23 to 25 November has been approved by Daniel. You have 6 days left this year.
              </Typography.Paragraph>
              <Typography.Text type="secondary">Everything else: labels, tables, forms and messages.</Typography.Text>
              <div className="display" style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 16 }}>MYR 5,794.71</div>
            </Card>
          </Col>
        </Row>
      </Section>

      <Section kicker="05 · Voice" title="How Orbit sounds">
        <Row gutter={[16, 16]}>
          {VOICE.map((v) => (
            <Col xs={24} md={8} key={v.title}>
              <Card style={{ height: '100%' }}>
                <Typography.Title level={4} style={{ marginTop: 0 }}>{v.title}</Typography.Title>
                <Typography.Text type="secondary">{v.body}</Typography.Text>
              </Card>
            </Col>
          ))}
          <Col xs={24}>
            <Card>
              {EXAMPLES.map((e) => (
                <Row key={e.good} gutter={16} style={{ padding: '10px 0', borderBottom: '1px solid #F0F0F3' }}>
                  <Col xs={24} md={12}><CheckCircleFilled style={{ color: '#16A34A' }} /> {e.good}</Col>
                  <Col xs={24} md={12}><Typography.Text type="secondary"><CloseCircleFilled style={{ color: '#DC2626' }} /> {e.bad}</Typography.Text></Col>
                </Row>
              ))}
            </Card>
          </Col>
        </Row>
      </Section>

      <Section kicker="06 · Elements" title="UI building blocks">
        <Card>
          <Space wrap size={16} align="center">
            <Button type="primary" className="btn-gradient" size="large">Enter Orbit</Button>
            <Button type="primary" size="large">Primary</Button>
            <Button size="large">Secondary</Button>
            <Tag color="green">Approved</Tag>
            <Tag color="gold">Pending</Tag>
            <Tag color="red">Rejected</Tag>
            <IconChip icon={<OrbitMark size={20} />} tone="violet" />
            <PersonAvatar name="Siti Aminah" size={36} />
            <PersonAvatar name="Daniel Lim" size={36} />
            <PersonAvatar name="Priya Nair" size={36} />
          </Space>
        </Card>
      </Section>
    </div>
  );
}
