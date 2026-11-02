import {
  AuditOutlined, CalendarOutlined, MedicineBoxOutlined, NotificationOutlined, PlusOutlined, ThunderboltOutlined, WalletOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, List, Row, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../api';
import { useAuth } from '../auth';
import { ClaimStatusTag, LeaveStatusTag, fmtDate, fmtMoney, fmtRange } from '../format';
import type { Announcement, Claim, LeaveBalance, LeaveRequest, OvertimeRequest } from '../types';
import { IconChip, PersonAvatar, StatCard } from '../ui';
import { ClockCard } from './Attendance';

const greeting = () => {
  const h = dayjs().hour();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const isApprover = hasRole('MANAGER', 'HR', 'FINANCE');
  const from = dayjs().format('YYYY-MM-DD');
  const to = dayjs().add(14, 'day').format('YYYY-MM-DD');

  const balances = useApi<LeaveBalance[]>('/leave/balances');
  const onLeave = useApi<LeaveRequest[]>(`/leave/calendar?from=${from}&to=${to}`);
  const claims = useApi<Claim[]>('/claims');
  const leaveApprovals = useApi<LeaveRequest[]>(hasRole('MANAGER', 'HR') ? '/leave/approvals' : null);
  const claimApprovals = useApi<Claim[]>(isApprover ? '/claims/approvals' : null);
  const overtimeApprovals = useApi<OvertimeRequest[]>(hasRole('MANAGER', 'HR') ? '/attendance/overtime/approvals' : null);
  const announcements = useApi<Announcement[]>('/announcements');

  const pendingCount = (leaveApprovals.data?.length ?? 0) + (claimApprovals.data?.length ?? 0) + (overtimeApprovals.data?.length ?? 0);
  const openClaims = claims.data?.filter((c) => !['PAID', 'REJECTED', 'DRAFT'].includes(c.status)) ?? [];
  const balance = (code: string) => balances.data?.find((b) => b.leaveType.code === code);
  const annual = balance('AL');
  const sick = balance('SL');
  const emergency = balance('EL');

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="hero-sub" style={{ fontSize: 13 }}>{dayjs().format('dddd, D MMMM YYYY')}</span>
          <Typography.Title level={2}>{greeting()}, {user!.name.split(' ')[0]} 👋</Typography.Title>
          <div className="hero-sub">
            {isApprover && pendingCount
              ? `You have ${pendingCount} request${pendingCount > 1 ? 's' : ''} waiting for your approval.`
              : annual ? `You have ${annual.available} days of annual leave left this year.` : 'Here is what is happening today.'}
          </div>
          <Space wrap style={{ marginTop: 20 }}>
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => navigate('/leave')}>Apply leave</Button>
            <Button icon={<PlusOutlined />} onClick={() => navigate('/claims')}>New claim</Button>
            {isApprover && pendingCount > 0 && <Button icon={<AuditOutlined />} onClick={() => navigate('/approvals')}>Review approvals</Button>}
          </Space>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <StatCard tone="violet" icon={<CalendarOutlined />} label="Annual leave left" value={annual?.available ?? '–'} suffix={annual && `/ ${annual.entitled} days`} hint={annual && `${annual.pending} day(s) pending`} onClick={() => navigate('/leave')} />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard tone="teal" icon={<MedicineBoxOutlined />} label="Sick leave left" value={sick?.available ?? '–'} suffix={sick && `/ ${sick.entitled} days`} hint={sick && `${sick.taken} day(s) used`} onClick={() => navigate('/leave')} />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard tone="amber" icon={<WalletOutlined />} label="Open claims" value={openClaims.length} hint={fmtMoney(openClaims.reduce((s, c) => s + c.totalAmount, 0))} onClick={() => navigate('/claims')} />
        </Col>
        <Col xs={12} lg={6}>
          {isApprover ? (
            <StatCard tone="pink" icon={<AuditOutlined />} label="Waiting for you" value={pendingCount} hint="Leave, claims and overtime" onClick={() => navigate('/approvals')} />
          ) : (
            <StatCard tone="blue" icon={<ThunderboltOutlined />} label="Emergency leave left" value={emergency?.available ?? '–'} suffix={emergency && `/ ${emergency.entitled} days`} onClick={() => navigate('/leave')} />
          )}
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <ClockCard />
        </Col>
        <Col xs={24} lg={16}>
          <Card title="Announcements" extra={<Link to="/announcements">View all</Link>} style={{ height: '100%' }}>
            <List
              loading={announcements.loading}
              dataSource={announcements.data?.slice(0, 3)}
              locale={{ emptyText: 'No announcements' }}
              renderItem={(a) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<IconChip icon={<NotificationOutlined />} tone={a.pinned ? 'violet' : 'blue'} />}
                    title={<Space>{a.title}<Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{fmtDate(a.createdAt)}</Typography.Text></Space>}
                    description={<Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ marginBottom: 0 }}>{a.body}</Typography.Paragraph>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Who's on leave" extra={<Typography.Text type="secondary">Next 14 days</Typography.Text>} style={{ height: '100%' }}>
            <List
              loading={onLeave.loading}
              dataSource={onLeave.data}
              locale={{ emptyText: 'Nobody in your department is on leave' }}
              renderItem={(r) => (
                <List.Item extra={<LeaveStatusTag status={r.status} />}>
                  <List.Item.Meta
                    avatar={<PersonAvatar name={r.employee.name} size={36} />}
                    title={r.employee.name}
                    description={`${r.leaveType.name} · ${fmtRange(r.startDate, r.endDate)}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent claims" extra={<Link to="/claims">View all</Link>} style={{ height: '100%' }}>
            <List
              loading={claims.loading}
              dataSource={claims.data?.slice(0, 5)}
              locale={{ emptyText: 'No claims yet' }}
              renderItem={(c) => (
                <List.Item extra={<ClaimStatusTag status={c.status} />}>
                  <List.Item.Meta
                    avatar={<IconChip icon={<WalletOutlined />} tone="amber" />}
                    title={<Link to={`/claims/${c.id}`}>{c.title}</Link>}
                    description={fmtMoney(c.totalAmount, c.currency)}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
