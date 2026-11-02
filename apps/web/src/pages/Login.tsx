import { ArrowRightOutlined } from '@ant-design/icons';
import { Alert, Button, ConfigProvider, Form, Input, Typography, theme as antdTheme } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Logo } from '../brand/Logo';
import { OrbitScene } from '../brand/OrbitScene';
import { brand } from '../theme';
import { PersonAvatar } from '../ui';

// Demo accounts from the API's mock data (apps/api/src/data/mock-data.ts)
const DEMO_USERS = [
  { name: 'Siti Aminah', role: 'Employee', email: 'employee@demo.local' },
  { name: 'Daniel Lim', role: 'Manager', email: 'manager@demo.local' },
  { name: 'Aisha Rahman', role: 'HR Admin', email: 'hr@demo.local' },
  { name: 'Priya Nair', role: 'Finance', email: 'finance@demo.local' },
];

// Dark theme for the controls inside the glass card (not inheriting the app's light text colours)
const glassTheme = {
  inherit: false,
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: brand.violet,
    colorBgContainer: 'rgba(255, 255, 255, 0.05)',
    colorBorder: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    controlHeightLG: 46,
    fontFamily: "'Inter', sans-serif",
  },
};

export default function Login() {
  const { login } = useAuth();
  const [form] = Form.useForm();
  const email = Form.useWatch('email', form);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(undefined);
    try {
      await login(values.email, values.password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-inner">
        <header className="login-top">
          <Logo size={34} tone="light" suffix="HR" />
          <Link to="/brand" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Brand guide</Link>
        </header>

        <section className="login-copy">
          <span className="login-eyebrow"><span className="live-dot" />Your people workspace</span>
          <h1>
            Everything revolves
            <br />
            around <span className="gradient-text">your people.</span>
          </h1>
          <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.65)', fontSize: 17, lineHeight: 1.6, maxWidth: 460 }}>
            Leave, claims, attendance, payroll and growth, all in one orbit. Less admin, more time for the humans.
          </Typography.Paragraph>
          <div className="login-stats">
            <div><b>8</b><span>HR modules</span></div>
            <div><b>1</b><span>sign-in</span></div>
            <div><b>0</b><span>paper forms</span></div>
          </div>
        </section>

        <section className="login-side">
          <OrbitScene />
          <ConfigProvider theme={glassTheme}>
            <div className="glass-card">
              <Typography.Title level={3} style={{ margin: '0 0 4px', letterSpacing: '-0.03em' }}>Sign in</Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>Welcome back to Orbit.</Typography.Paragraph>
              {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
              <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} size="large">
                <Form.Item name="email" label="Work email" rules={[{ required: true, type: 'email' }]}>
                  <Input autoComplete="username" placeholder="you@company.com" />
                </Form.Item>
                <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                  <Input.Password autoComplete="current-password" placeholder="••••••••" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading} className="btn-gradient">
                  Enter Orbit <ArrowRightOutlined />
                </Button>
              </Form>

              <div style={{ marginTop: 28 }}>
                <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Demo crew · password in README
                </Typography.Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  {DEMO_USERS.map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      className={`demo-user${email === u.email ? ' active' : ''}`}
                      onClick={() => form.setFieldsValue({ email: u.email })}
                    >
                      <PersonAvatar name={u.name} size={28} />
                      <span style={{ lineHeight: 1.2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{u.name.split(' ')[0]}</span>
                        <br />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{u.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ConfigProvider>
        </section>

        <footer className="login-footer">
          <span>© {new Date().getFullYear()} Orbit HR · Demo environment with mock data</span>
          <span>Made for people, not paperwork.</span>
        </footer>
      </div>
    </div>
  );
}
