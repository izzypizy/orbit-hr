import {
  AimOutlined, CheckCircleOutlined, FlagOutlined, GiftOutlined, PlusOutlined, StarOutlined, TeamOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  Alert, App, Button, Card, Col, DatePicker, Empty, Form, Input, Modal, Progress, Rate, Row, Select, Space, Table, Tabs, Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { StatusTag, fmtDate, fmtMoney, fmtPeriod } from '../format';
import {
  AchievementBar, CheckInModal, KpiFields, KpiProgressTable, PaceSummary, blankKpi, type KpiDraft,
} from '../performance';
import type { Cycle, Employee, Kpi, MonitorRow, Review, Reward } from '../types';
import { PersonAvatar, StatCard } from '../ui';

interface Monitor {
  cycle: Cycle;
  rows: MonitorRow[];
  withoutKpis: Employee[];
}

export default function Performance() {
  const { user, hasRole } = useAuth();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const isHR = hasRole('HR');
  const canManage = hasRole('HR', 'MANAGER');

  const cycles = useApi<Cycle[]>('/cycles');
  const [cycleId, setCycleId] = useState<number>();
  const cycle = cycles.data?.find((c) => c.id === cycleId) ?? cycles.data?.find((c) => c.status !== 'CLOSED') ?? cycles.data?.[0];
  const reviews = useApi<Review[]>('/reviews');
  const monitor = useApi<Monitor>(canManage && cycle ? `/cycles/${cycle.id}/monitor` : null);
  const rewards = useApi<Reward[]>('/rewards/mine');

  const [checkIn, setCheckIn] = useState<Kpi | null>(null);
  const [kpisFor, setKpisFor] = useState<number | null>(); // undefined = closed, null = pick employee
  const [newCycle, setNewCycle] = useState(false);

  const inCycle = reviews.data?.filter((r) => r.cycle.id === cycle?.id) ?? [];
  const mine = inCycle.find((r) => r.employee.id === user!.id);

  const reload = () => {
    reviews.reload();
    monitor.reload();
    cycles.reload();
  };

  const phase = (action: 'start-review' | 'close') => modal.confirm({
    title: action === 'start-review' ? `Start the review phase for ${cycle!.name}?` : `Close ${cycle!.name}?`,
    content: action === 'start-review'
      ? 'KPI tracking ends and everyone in the cycle is asked for their self-review.'
      : 'Final ratings are locked. You can then calculate bonuses and increments in Rewards.',
    okText: action === 'start-review' ? 'Start review phase' : 'Close cycle',
    onOk: async () => {
      try {
        await api(`/cycles/${cycle!.id}/${action}`, { method: 'POST' });
        message.success(action === 'start-review' ? 'Review phase started' : 'Cycle closed');
        reload();
      } catch (e) {
        message.error((e as Error).message);
      }
    },
  });

  const yourTurn = (r: Review) =>
    (r.status === 'SELF_REVIEW' && r.employee.id === user!.id) || (r.status === 'MANAGER_REVIEW' && r.reviewerId === user!.id);

  const tabs = [
    {
      key: 'mine',
      label: 'My KPIs',
      children: mine ? (
        <>
          {mine.status === 'SELF_REVIEW' && (
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Your self-review is open"
              action={<Button type="primary" size="small" onClick={() => navigate(`/reviews/${mine.id}`)}>Start self-review</Button>} />
          )}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}><StatCard icon={<AimOutlined />} tone="violet" label="Overall achievement" value={mine.achievement} suffix="% of target" hint="Weighted by KPI" /></Col>
            <Col xs={24} sm={8}>
              <StatCard icon={<StarOutlined />} tone="amber" label={mine.overallRating ? 'Final rating' : 'Rating if the cycle ended today'}
                value={mine.overallRating ?? mine.suggestedRating} suffix="/ 5" hint={mine.overallRating ? `Reviewed by ${mine.reviewer}` : 'Suggested from achievement'} />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard icon={<FlagOutlined />} tone="green" label="KPIs on track" value={mine.pace.onTrack} suffix={`of ${mine.kpis.length}`} hint={<PaceSummary pace={mine.pace} />} />
            </Col>
          </Row>
          <Card title="My KPIs" extra={<Link to={`/reviews/${mine.id}`}>Open review and history</Link>}>
            <KpiProgressTable review={mine} canCheckIn={mine.status !== 'COMPLETED'} onCheckIn={setCheckIn} />
          </Card>
          <CheckInModal review={mine} kpi={checkIn} onClose={() => setCheckIn(null)} onSaved={reload} />
        </>
      ) : (
        <Card><Empty description={`No KPIs for ${cycle?.name ?? 'this cycle'} yet. Your manager sets them with you.`} /></Card>
      ),
    },
    ...(canManage ? [{
      key: 'team',
      label: isHR ? 'Everyone' : 'My team',
      children: <TeamMonitor data={monitor.data} loading={monitor.loading} onSetKpis={(id) => setKpisFor(id)} />,
    }] : []),
    {
      key: 'reviews',
      label: 'Reviews',
      children: (
        <Card>
          <Table
            rowKey="id"
            loading={reviews.loading}
            dataSource={inCycle}
            scroll={{ x: true }}
            columns={[
              { title: 'Employee', render: (_, r) => <Link to={`/reviews/${r.id}`}>{r.employee.name}</Link> },
              { title: 'Reviewer', dataIndex: 'reviewer' },
              { title: 'Achievement', render: (_, r) => <AchievementBar value={r.achievement} /> },
              { title: 'Status', render: (_, r) => <Space><StatusTag status={r.status} />{yourTurn(r) && <Typography.Text type="warning">Your turn</Typography.Text>}</Space> },
              { title: 'Final rating', render: (_, r) => (r.overallRating ? <Space><Rate disabled allowHalf value={r.overallRating} style={{ fontSize: 14 }} />{r.overallRating}</Space> : '—') },
              { title: 'Completed', render: (_, r) => fmtDate(r.completedAt) },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'rewards',
      label: 'My rewards',
      children: rewards.data?.length ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {rewards.data.map((r) => <RewardLetter key={r.id} reward={r} name={user!.name} />)}
        </Space>
      ) : (
        <Card><Empty description="Your bonus and increment letters appear here once a cycle's rewards are approved." /></Card>
      ),
    },
  ];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>Performance</Typography.Title>
        <Space wrap>
          <Select
            value={cycle?.id}
            onChange={setCycleId}
            loading={cycles.loading}
            style={{ minWidth: 170 }}
            options={cycles.data?.map((c) => ({ value: c.id, label: c.name }))}
          />
          {isHR && <Button onClick={() => setNewCycle(true)}>New cycle</Button>}
          {canManage && cycle?.status !== 'CLOSED' && <Button type="primary" icon={<PlusOutlined />} onClick={() => setKpisFor(null)}>Set KPIs</Button>}
        </Space>
      </Space>

      {cycle && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[24, 12]} align="middle">
            <Col flex="auto">
              <Space wrap>
                <Typography.Title level={5} style={{ margin: 0 }}>{cycle.name}</Typography.Title>
                <StatusTag status={cycle.status} />
                <Typography.Text type="secondary">{fmtDate(cycle.startDate)} – {fmtDate(cycle.endDate)}</Typography.Text>
              </Space>
              <Progress percent={cycle.elapsed} size="small" style={{ maxWidth: 420, marginTop: 8, marginBottom: 0 }} format={(p) => `${p}% of cycle`} />
            </Col>
            <Col>
              <Typography.Text type="secondary">{cycle.completed} of {cycle.reviews} reviews completed</Typography.Text>
            </Col>
            {isHR && cycle.status !== 'CLOSED' && (
              <Col>
                {cycle.status === 'TRACKING'
                  ? <Button onClick={() => phase('start-review')}>Start review phase</Button>
                  : <Button type="primary" onClick={() => phase('close')}>Close cycle</Button>}
              </Col>
            )}
            {hasRole('HR', 'FINANCE') && cycle.status === 'CLOSED' && (
              <Col><Button icon={<GiftOutlined />} onClick={() => navigate(`/rewards?cycle=${cycle.id}`)}>Rewards</Button></Col>
            )}
          </Row>
        </Card>
      )}

      <Tabs items={tabs} defaultActiveKey={canManage ? 'team' : 'mine'} />

      {cycle && kpisFor !== undefined && (
        <SetKpisModal cycle={cycle} employeeId={kpisFor} onClose={() => setKpisFor(undefined)} onCreated={(r) => { reload(); navigate(`/reviews/${r.id}`); }} />
      )}
      <NewCycleModal open={newCycle} onClose={() => setNewCycle(false)} onCreated={(c) => { cycles.reload(); setCycleId(c.id); }} />
    </>
  );
}

function TeamMonitor({ data, loading, onSetKpis }: { data?: Monitor; loading: boolean; onSetKpis: (employeeId: number) => void }) {
  const rows = data?.rows ?? [];
  const kpis = rows.flatMap((r) => r.kpis);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.achievement, 0) / rows.length) : 0;
  const tracking = data?.cycle.status === 'TRACKING';

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><StatCard icon={<TeamOutlined />} tone="violet" label="People with KPIs" value={rows.length} hint={data?.withoutKpis.length ? `${data.withoutKpis.length} still need KPIs` : 'Everyone is set up'} /></Col>
        <Col xs={12} md={6}><StatCard icon={<AimOutlined />} tone="blue" label="Average achievement" value={avg} suffix="%" /></Col>
        <Col xs={12} md={6}><StatCard icon={<CheckCircleOutlined />} tone="green" label="KPIs on track" value={kpis.filter((k) => k.pace === 'ON_TRACK').length} suffix={`of ${kpis.length}`} /></Col>
        <Col xs={12} md={6}><StatCard icon={<WarningOutlined />} tone="amber" label="At risk or off track" value={kpis.filter((k) => k.pace === 'AT_RISK' || k.pace === 'OFF_TRACK').length} hint="Worth a check-in" /></Col>
      </Row>

      {!!data?.withoutKpis.length && data.cycle.status !== 'CLOSED' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No KPIs set yet"
          description={
            <Space wrap>
              {data.withoutKpis.map((e) => <Button key={e.id} size="small" onClick={() => onSetKpis(e.id)}>Set KPIs for {e.name}</Button>)}
            </Space>
          }
        />
      )}

      <Card>
        <Table
          rowKey="reviewId"
          loading={loading}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          style={{ whiteSpace: 'nowrap' }}
          expandable={{
            expandedRowRender: (r) => (
              <KpiProgressTable review={{ ...r, id: r.reviewId } as unknown as Review} canCheckIn={false} onCheckIn={() => {}} />
            ),
          }}
          columns={[
            {
              title: 'Employee',
              render: (_, r) => (
                <Space>
                  <PersonAvatar name={r.employee.name} size={28} />
                  <div style={{ lineHeight: 1.25 }}>
                    <Link to={`/reviews/${r.reviewId}`}>{r.employee.name}</Link>
                    <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.employee.position}</Typography.Text></div>
                  </div>
                </Space>
              ),
            },
            { title: 'Achievement', sorter: (a, b) => a.achievement - b.achievement, render: (_, r) => <AchievementBar value={r.achievement} width={160} /> },
            { title: 'KPI pace', render: (_, r) => <PaceSummary pace={r.pace} /> },
            {
              title: tracking ? 'Rating so far' : 'Rating',
              render: (_, r) => r.overallRating
                ? <b>{r.overallRating}</b>
                : <Typography.Text type="secondary">{r.suggestedRating} suggested</Typography.Text>,
            },
            { title: 'Status', render: (_, r) => <StatusTag status={r.status} /> },
            { title: 'Last update', render: (_, r) => fmtDate(r.lastCheckIn) },
          ]}
        />
      </Card>
    </>
  );
}

function SetKpisModal({ cycle, employeeId, onClose, onCreated }: {
  cycle: Cycle;
  employeeId: number | null;
  onClose: () => void;
  onCreated: (r: Review) => void;
}) {
  const { user } = useAuth();
  const { message } = App.useApp();
  const team = useApi<Employee[]>('/employees');
  const [form] = Form.useForm<{ employeeId: number; kpis: KpiDraft[] }>();
  const kpis = Form.useWatch('kpis', form) ?? [];
  const total = kpis.reduce((s, k) => s + (k?.weight ?? 0), 0);

  const create = async (v: { employeeId: number; kpis: KpiDraft[] }) => {
    try {
      onCreated(await api<Review>('/reviews', { body: { ...v, cycleId: cycle.id } }));
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Modal title={`Set KPIs · ${cycle.name}`} open onCancel={onClose} onOk={form.submit} okText="Save KPIs" width={900} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        onFinish={create}
        requiredMark={false}
        initialValues={{
          employeeId: employeeId ?? undefined,
          kpis: [
            { ...blankKpi(40), unit: 'MYR', target: 50000, direction: 'HIGHER', tracking: 'CUMULATIVE' },
            { ...blankKpi(30), unit: '%', target: 95 },
            { ...blankKpi(30), unit: 'defects', target: 5, direction: 'LOWER', tracking: 'CUMULATIVE' },
          ],
        }}
      >
        <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]} style={{ maxWidth: 320 }}>
          <Select showSearch optionFilterProp="label" options={team.data?.filter((e) => e.id !== user!.id).map((e) => ({ value: e.id, label: e.name }))} />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
          Make each KPI measurable: a target, a unit, whether more or less is better, and whether it adds up over the cycle
          (like sales) or is a level to keep (like uptime). Weights must add up to 100%.
        </Typography.Paragraph>
        <KpiFields />
        <Typography.Text type={total === 100 ? 'success' : 'danger'} style={{ display: 'block', marginTop: 12 }}>
          Total weight: {total}%
        </Typography.Text>
      </Form>
    </Modal>
  );
}

function NewCycleModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: Cycle) => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ name: string; dates: [Dayjs, Dayjs] }>();
  const create = async (v: { name: string; dates: [Dayjs, Dayjs] }) => {
    try {
      const c = await api<Cycle>('/cycles', { body: { name: v.name, startDate: v.dates[0].format('YYYY-MM-DD'), endDate: v.dates[1].format('YYYY-MM-DD') } });
      message.success(`${c.name} created`);
      onCreated(c);
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  return (
    <Modal title="New performance cycle" open={open} onCancel={onClose} onOk={form.submit} okText="Create" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={create} requiredMark={false} preserve={false}>
        <Form.Item name="name" label="Name" rules={[{ required: true, min: 3 }]}><Input placeholder="e.g. 2027 Annual" /></Form.Item>
        <Form.Item name="dates" label="Period" rules={[{ required: true }]}><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  );
}

/** What the employee sees once Finance approves the cycle's rewards. */
export function RewardLetter({ reward: r, name }: { reward: Reward; name: string }) {
  return (
    <div className="reward-letter">
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>{r.cycle} · {r.band}</Typography.Title>
        <Space><Rate disabled allowHalf value={r.rating} style={{ fontSize: 16 }} /><b>{r.rating}</b></Space>
      </Space>
      <Typography.Paragraph style={{ marginTop: 12 }}>
        Dear {name.split(' ')[0]}, thank you for your contribution this cycle. Based on your final rating of {r.rating} ({r.band}):
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card size="small">
            <Typography.Text type="secondary">Performance bonus</Typography.Text>
            <div className="display" style={{ fontSize: 28, fontWeight: 700 }}>{fmtMoney(r.bonusAmount)}</div>
            <Typography.Text type="secondary">
              {r.bonusMonths} month{r.bonusMonths === 1 ? '' : 's'} of basic{r.prorate < 1 ? `, pro-rated ${Math.round(r.prorate * 100)}%` : ''} · paid with {fmtPeriod(r.payoutPeriod)} salary
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small">
            <Typography.Text type="secondary">Salary increment</Typography.Text>
            <div className="display" style={{ fontSize: 28, fontWeight: 700 }}>+{r.incrementPct}%</div>
            <Typography.Text type="secondary">
              {fmtMoney(r.basicSalary)} → <b>{fmtMoney(r.newSalary)}</b> a month from {fmtDate(r.effectiveDate)}
            </Typography.Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
