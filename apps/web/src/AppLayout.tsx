import {
  ApartmentOutlined, AuditOutlined, BellOutlined, BgColorsOutlined, BookOutlined, CalendarOutlined, CheckSquareOutlined, ClockCircleOutlined,
  DashboardOutlined, DollarOutlined, FileTextOutlined, FlagOutlined, LogoutOutlined, NotificationOutlined, SearchOutlined,
  StarOutlined, TeamOutlined, UserOutlined, WalletOutlined,
} from '@ant-design/icons';
import { AutoComplete, Badge, Button, Dropdown, Input, Layout, Menu, Space, Tooltip, Typography } from 'antd';
import type { MenuItemGroupType } from 'antd/es/menu/interface';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApi } from './api';
import { useAuth } from './auth';
import { Logo } from './brand/Logo';
import type { Claim, LeaveRequest, OvertimeRequest } from './types';
import { PersonAvatar } from './ui';

const { Sider, Header, Content } = Layout;

const ROLE_LABEL = { EMPLOYEE: 'Employee', MANAGER: 'Manager', HR: 'HR Admin', FINANCE: 'Finance' };

interface NavItem {
  key: string;
  icon: JSX.Element;
  label: string;
}

export default function AppLayout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const isApprover = hasRole('MANAGER', 'HR', 'FINANCE');
  const leaveApprovals = useApi<LeaveRequest[]>(hasRole('MANAGER', 'HR') ? '/leave/approvals' : null);
  const claimApprovals = useApi<Claim[]>(isApprover ? '/claims/approvals' : null);
  const otApprovals = useApi<OvertimeRequest[]>(hasRole('MANAGER', 'HR') ? '/attendance/overtime/approvals' : null);
  const pending = (leaveApprovals.data?.length ?? 0) + (claimApprovals.data?.length ?? 0) + (otApprovals.data?.length ?? 0);

  // Refresh the approval count whenever the user moves between pages
  useEffect(() => {
    if (!isApprover) return;
    leaveApprovals.reload();
    claimApprovals.reload();
    otApprovals.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Ctrl/Cmd + K focuses the page search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups: { label: string; children: (NavItem | false)[] }[] = [
    {
      label: 'Me',
      children: [
        { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
        { key: '/profile', icon: <UserOutlined />, label: 'My Profile' },
        { key: '/leave', icon: <CalendarOutlined />, label: 'Leave' },
        { key: '/claims', icon: <WalletOutlined />, label: 'Claims' },
        { key: '/attendance', icon: <ClockCircleOutlined />, label: 'Attendance' },
        { key: '/payslips', icon: <FileTextOutlined />, label: 'Payslips' },
        { key: '/reviews', icon: <StarOutlined />, label: 'Performance' },
        { key: '/training', icon: <BookOutlined />, label: 'Training' },
        hasRole('EMPLOYEE') && { key: '/onboarding', icon: <CheckSquareOutlined />, label: 'My Onboarding' },
      ],
    },
    {
      label: 'Company',
      children: [
        { key: '/announcements', icon: <NotificationOutlined />, label: 'Announcements' },
        { key: '/org-chart', icon: <ApartmentOutlined />, label: 'Org Chart' },
        { key: '/holidays', icon: <FlagOutlined />, label: 'Public Holidays' },
        { key: '/brand', icon: <BgColorsOutlined />, label: 'Brand Guide' },
      ],
    },
    {
      label: 'Manage',
      children: [
        isApprover && { key: '/approvals', icon: <AuditOutlined />, label: 'Approvals' },
        hasRole('MANAGER', 'HR') && { key: '/employees', icon: <TeamOutlined />, label: hasRole('HR') ? 'Employees' : 'My Team' },
        isApprover && { key: '/onboarding', icon: <CheckSquareOutlined />, label: 'On/Offboarding' },
        hasRole('HR', 'FINANCE') && { key: '/payroll', icon: <DollarOutlined />, label: 'Payroll' },
      ],
    },
  ];

  const visible = groups
    .map((g) => ({ ...g, children: g.children.filter(Boolean) as NavItem[] }))
    .filter((g) => g.children.length);
  const flat = visible.flatMap((g) => g.children);
  const selected = flat.filter((i) => i.key !== '/' && pathname.startsWith(i.key)).map((i) => i.key);
  const current = flat.find((i) => i.key === (selected[0] ?? '/'));

  const searchOptions = useMemo(
    () => flat
      .filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
      .map((i) => ({ value: i.key, label: <Space>{i.icon}{i.label}</Space> })),
    [flat, search],
  );

  const menuItems = visible.map((g): MenuItemGroupType => ({
    type: 'group',
    key: g.label,
    label: g.label,
    children: g.children.map((c) => ({
      ...c,
      label: c.key === '/approvals' && pending ? <Space style={{ width: '100%', justifyContent: 'space-between' }}>{c.label}<Badge count={pending} size="small" /></Space> : c.label,
    })),
  }));

  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider className="app-sider" breakpoint="lg" collapsedWidth={0} width={248}>
        <div className="brand">
          <Logo size={30} suffix="HR" />
        </div>
        <Menu mode="inline" items={menuItems} selectedKeys={selected.length ? selected : ['/']} onClick={(e) => navigate(e.key)} style={{ borderInlineEnd: 0 }} />
        <div className="sider-user">
          <PersonAvatar name={user!.name} size={32} />
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>{user!.name}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{ROLE_LABEL[user!.role]}</Typography.Text>
          </div>
          <Tooltip title="Sign out">
            <Button type="text" size="small" icon={<LogoutOutlined />} onClick={signOut} />
          </Tooltip>
        </div>
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Text strong style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{current?.label}</Typography.Text>
          <AutoComplete
            className="app-search"
            options={searchOptions}
            value={search}
            onChange={setSearch}
            onSelect={(key: string) => { navigate(key); setSearch(''); searchRef.current?.blur(); }}
          >
            <Input ref={searchRef as never} prefix={<SearchOutlined style={{ color: '#A1A1AA' }} />} placeholder="Jump to a page…" suffix={<span className="kbd">Ctrl K</span>} />
          </AutoComplete>
          <Space size={8}>
            {isApprover && (
              <Tooltip title={pending ? `${pending} waiting for your approval` : 'No pending approvals'}>
                <Badge count={pending} size="small" offset={[-4, 4]}>
                  <Button shape="circle" icon={<BellOutlined />} onClick={() => navigate('/approvals')} />
                </Badge>
              </Tooltip>
            )}
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'who', label: <div style={{ lineHeight: 1.3 }}><b>{user!.name}</b><br /><span style={{ color: '#71717A', fontSize: 12 }}>{user!.email}</span></div>, disabled: true },
                  { type: 'divider' },
                  { key: 'profile', icon: <UserOutlined />, label: 'My Profile', onClick: () => navigate('/profile') },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true, onClick: signOut },
                ],
              }}
            >
              <Button type="text" style={{ height: 40, padding: '0 6px' }}>
                <PersonAvatar name={user!.name} size={30} />
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
