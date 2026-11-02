import { CalculatorOutlined, DollarOutlined, EditOutlined, GiftOutlined, MinusCircleOutlined, PlusOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons';
import {
  Alert, App, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Steps, Table, Tag, Tooltip, Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { StatusTag, fmtDate, fmtMoney, fmtPeriod } from '../format';
import type { Cycle, Reward, RewardBand, RewardSummary } from '../types';
import { PersonAvatar, StatCard } from '../ui';

export default function Rewards() {
  const { hasRole } = useAuth();
  const { message, modal } = App.useApp();
  const isHR = hasRole('HR');
  const isFinance = hasRole('FINANCE');
  const [params, setParams] = useSearchParams();

  const cycles = useApi<Cycle[]>('/cycles');
  const cycleId = Number(params.get('cycle')) || cycles.data?.find((c) => c.status === 'CLOSED')?.id;
  const summary = useApi<RewardSummary>(cycleId ? `/rewards/cycles/${cycleId}` : null);
  const [bandsOpen, setBandsOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<Reward | null>(null);

  const s = summary.data;
  const c = s?.cycle;
  const editable = isHR && c && (c.rewardStatus === 'NOT_STARTED' || c.rewardStatus === 'DRAFT');

  const run = async (path: string, body: unknown, done: string) => {
    try {
      summary.setData(await api<RewardSummary>(path, { body }));
      message.success(done);
      return true;
    } catch (e) {
      message.error((e as Error).message);
      return false;
    }
  };

  const decide = (approve: boolean) => {
    let comment = '';
    modal.confirm({
      title: approve ? `Approve ${c!.name} rewards?` : 'Send back to HR?',
      content: (
        <>
          {approve && (
            <Typography.Paragraph>
              Bonuses of {fmtMoney(s!.totals.bonus)} are paid with {fmtPeriod(c!.payoutPeriod!)} payroll, and new salaries apply from {fmtDate(c!.effectiveDate)}.
            </Typography.Paragraph>
          )}
          <Input.TextArea rows={2} placeholder={approve ? 'Comment (optional)' : 'What should HR change?'} onChange={(e) => (comment = e.target.value)} />
        </>
      ),
      okText: approve ? 'Approve' : 'Send back',
      okButtonProps: { danger: !approve },
      onOk: () => run(`/rewards/cycles/${cycleId}/decision`, { approve, comment }, approve ? 'Rewards approved' : 'Sent back to HR'),
    });
  };

  const step = { NOT_STARTED: 0, DRAFT: 0, SUBMITTED: 1, APPROVED: 3 }[c?.rewardStatus ?? 'NOT_STARTED'];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>Rewards</Typography.Title>
        <Select
          value={cycleId}
          onChange={(id) => setParams({ cycle: String(id) })}
          loading={cycles.loading}
          style={{ minWidth: 200 }}
          options={cycles.data?.map((x) => ({ value: x.id, label: `${x.name}${x.status === 'CLOSED' ? '' : ' (open)'}` }))}
        />
      </Space>

      {!s ? <Card loading={summary.loading || cycles.loading}><Empty description="Pick a performance cycle" /></Card> : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Steps
              size="small"
              current={step}
              items={[
                { title: 'HR calculates and adjusts', description: c!.rewardStatus === 'NOT_STARTED' ? 'Not started' : undefined },
                { title: 'Finance approves' },
                { title: 'Paid in payroll', description: c!.payoutPeriod ? `Bonus in ${fmtPeriod(c!.payoutPeriod)}` : undefined },
              ]}
            />
          </Card>

          {c!.status !== 'CLOSED' && (
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message={`${c!.name} is still open`}
              description="Rewards are calculated from final ratings. Finish the reviews and close the cycle on the Performance page first." />
          )}
          {c!.rewardStatus === 'DRAFT' && c!.rewardComment && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={`Sent back by ${c!.decidedBy}`} description={c!.rewardComment} />
          )}
          {c!.rewardStatus === 'APPROVED' && (
            <Alert type="success" showIcon style={{ marginBottom: 16 }}
              message={`Approved by ${c!.decidedBy} on ${fmtDate(c!.rewardDecidedAt)}`}
              description={`Bonuses are paid with ${fmtPeriod(c!.payoutPeriod!)} payroll; new salaries apply from ${fmtDate(c!.effectiveDate)}. Employees can see their reward letter under Performance → My rewards.`} />
          )}

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}><StatCard icon={<TeamOutlined />} tone="violet" label="People rewarded" value={s.totals.employees} hint={s.missing.length ? `${s.missing.length} not included` : undefined} /></Col>
            <Col xs={12} md={6}><StatCard icon={<GiftOutlined />} tone="pink" label="Total bonus" value={fmtMoney(s.totals.bonus)} /></Col>
            <Col xs={12} md={6}><StatCard icon={<RiseOutlined />} tone="green" label="Average increment" value={s.totals.avgIncrementPct} suffix="%" /></Col>
            <Col xs={12} md={6}><StatCard icon={<DollarOutlined />} tone="amber" label="Increment cost" value={fmtMoney(s.totals.monthlyIncrement)} suffix="/ month" hint={`${fmtMoney(s.totals.annualIncrement)} a year`} /></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="Reward bands" extra={editable && <Button size="small" icon={<EditOutlined />} onClick={() => setBandsOpen(true)}>Edit bands</Button>} style={{ height: '100%' }}>
                <Table
                  rowKey="label"
                  size="small"
                  pagination={false}
                  dataSource={c!.rewardBands.map((b, i) => ({ ...b, upTo: i === 0 ? 5 : c!.rewardBands[i - 1].minRating, count: s.distribution.find((d) => d.label === b.label)?.count ?? 0 }))}
                  columns={[
                    { title: 'Final rating', render: (_, b) => `${b.minRating.toFixed(1)} – ${b.upTo === 5 ? '5.0' : `< ${b.upTo.toFixed(1)}`}` },
                    { title: 'Band', dataIndex: 'label' },
                    { title: 'Bonus', render: (_, b) => (b.bonusMonths ? `${b.bonusMonths} × basic` : '—') },
                    { title: 'Increment', render: (_, b) => `${b.incrementPct}%` },
                    { title: 'People', dataIndex: 'count', align: 'right' },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Next step" style={{ height: '100%' }}>
                {isHR && editable && c!.status === 'CLOSED' && (
                  <CalculateForm cycle={c!} hasRewards={s.rewards.length > 0}
                    onSubmit={(v) => run(`/rewards/cycles/${cycleId}/calculate`, v, 'Rewards calculated')} />
                )}
                {isHR && c!.rewardStatus === 'DRAFT' && (
                  <Button type="primary" block style={{ marginTop: 12 }} onClick={() => run(`/rewards/cycles/${cycleId}/submit`, {}, 'Sent to Finance for approval')}>
                    Submit to Finance
                  </Button>
                )}
                {isFinance && c!.rewardStatus === 'SUBMITTED' && (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Typography.Paragraph>HR has submitted {s.totals.employees} rewards totalling {fmtMoney(s.totals.bonus)} in bonuses.</Typography.Paragraph>
                    <Button type="primary" block onClick={() => decide(true)}>Approve rewards</Button>
                    <Button block danger onClick={() => decide(false)}>Send back to HR</Button>
                  </Space>
                )}
                {!(isHR && editable) && !(isFinance && c!.rewardStatus === 'SUBMITTED') && (
                  <Typography.Text type="secondary">
                    {c!.rewardStatus === 'SUBMITTED' ? 'Waiting for Finance to approve.'
                      : c!.rewardStatus === 'APPROVED' ? 'Done. Nothing else to do for this cycle.'
                      : c!.status !== 'CLOSED' ? 'Waiting for the cycle to close.'
                      : 'Waiting for HR to calculate rewards.'}
                  </Typography.Text>
                )}
              </Card>
            </Col>
          </Row>

          {!!s.missing.length && c!.status === 'CLOSED' && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Not included (no completed review)"
              description={s.missing.map((m) => `${m.employee.name}: ${m.reason}`).join(' · ')} />
          )}

          <Card title="Rewards by employee">
            <Table
              rowKey="id"
              dataSource={s.rewards}
              pagination={false}
              scroll={{ x: 'max-content' }}
              style={{ whiteSpace: 'nowrap' }}
              locale={{ emptyText: c!.status === 'CLOSED' ? 'Calculate rewards to see them here' : 'The cycle is still open' }}
              columns={[
                {
                  title: 'Employee',
                  render: (_, r) => (
                    <Space>
                      <PersonAvatar name={r.employee.name} size={28} />
                      <div style={{ lineHeight: 1.25 }}>
                        {r.employee.name}
                        <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.employee.position}</Typography.Text></div>
                      </div>
                    </Space>
                  ),
                },
                { title: 'Rating', sorter: (a, b) => a.rating - b.rating, render: (_, r) => <><b>{r.rating}</b> <Typography.Text type="secondary">{r.band}</Typography.Text></> },
                { title: 'Basic', align: 'right', render: (_, r) => fmtMoney(r.basicSalary) },
                {
                  title: 'Bonus',
                  align: 'right',
                  render: (_, r) => (
                    <>
                      <b>{fmtMoney(r.bonusAmount)}</b>
                      <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.bonusMonths} mo{r.prorate < 1 ? ` × ${Math.round(r.prorate * 100)}%` : ''}</Typography.Text></div>
                    </>
                  ),
                },
                { title: 'Increment', align: 'right', render: (_, r) => <>{r.incrementPct}%<div><Typography.Text type="secondary" style={{ fontSize: 12 }}>+{fmtMoney(r.incrementAmount)}</Typography.Text></div></> },
                { title: 'New basic', align: 'right', render: (_, r) => <b>{fmtMoney(r.newSalary)}</b> },
                {
                  title: '',
                  render: (_, r) => (
                    <Space>
                      {r.adjusted && <Tooltip title={r.note}><Tag color="purple">Adjusted</Tag></Tooltip>}
                      {isHR && c!.rewardStatus === 'DRAFT' && <Button size="small" onClick={() => setAdjusting(r)}>Adjust</Button>}
                    </Space>
                  ),
                },
              ]}
              summary={(rows) => rows.length ? (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}><b>Total</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right"><b>{fmtMoney(s.totals.bonus)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">+{fmtMoney(s.totals.monthlyIncrement)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5} colSpan={2} />
                </Table.Summary.Row>
              ) : null}
            />
          </Card>

          <BandsModal open={bandsOpen} bands={c!.rewardBands} onClose={() => setBandsOpen(false)}
            onSave={async (bands) => (await run(`/rewards/cycles/${cycleId}/bands`, { bands }, 'Bands saved. Recalculate to apply them')) && setBandsOpen(false)} />
          <AdjustModal reward={adjusting} onClose={() => setAdjusting(null)}
            onSave={async (v) => (await run(`/rewards/${adjusting!.id}`, v, 'Reward adjusted')) && setAdjusting(null)} />
        </>
      )}
    </>
  );
}

function CalculateForm({ cycle, hasRewards, onSubmit }: {
  cycle: Cycle;
  hasRewards: boolean;
  onSubmit: (v: { payoutPeriod: string; effectiveDate: string }) => void;
}) {
  // Default: bonus with the month after the cycle ends, increment from the first of that month
  const after = dayjs(cycle.endDate).add(1, 'day');
  const payout = cycle.payoutPeriod ? dayjs(`${cycle.payoutPeriod}-01`) : dayjs().isAfter(after) ? dayjs().startOf('month') : after;
  return (
    <Form
      layout="vertical"
      requiredMark={false}
      initialValues={{ payoutPeriod: payout, effectiveDate: cycle.effectiveDate ? dayjs(cycle.effectiveDate) : payout.startOf('month') }}
      onFinish={(v: { payoutPeriod: Dayjs; effectiveDate: Dayjs }) => onSubmit({ payoutPeriod: v.payoutPeriod.format('YYYY-MM'), effectiveDate: v.effectiveDate.format('YYYY-MM-DD') })}
    >
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="payoutPeriod" label="Pay bonus with" rules={[{ required: true }]}><DatePicker picker="month" format="MMM YYYY" style={{ width: '100%' }} /></Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="effectiveDate" label="Increment from" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Col>
      </Row>
      <Button htmlType="submit" icon={<CalculatorOutlined />} block type={hasRewards ? 'default' : 'primary'}>
        {hasRewards ? 'Recalculate (clears adjustments)' : 'Calculate rewards'}
      </Button>
    </Form>
  );
}

function BandsModal({ open, bands, onClose, onSave }: { open: boolean; bands: RewardBand[]; onClose: () => void; onSave: (b: RewardBand[]) => void }) {
  const [form] = Form.useForm<{ bands: RewardBand[] }>();
  return (
    <Modal title="Reward bands" open={open} onCancel={onClose} onOk={form.submit} okText="Save bands" width={720} destroyOnHidden>
      <Typography.Paragraph type="secondary">
        Each band covers final ratings from its starting value up to the next band. The lowest band must start at 0.
      </Typography.Paragraph>
      <Form form={form} initialValues={{ bands }} onFinish={(v) => onSave(v.bands)} preserve={false}>
        <Form.List name="bands">
          {(fields, { add, remove }) => (
            <>
              {fields.map((f) => (
                <Space key={f.key} align="baseline" wrap style={{ display: 'flex' }}>
                  <Form.Item name={[f.name, 'minRating']} rules={[{ required: true }]}><InputNumber min={0} max={5} step={0.5} addonBefore="From" style={{ width: 130 }} /></Form.Item>
                  <Form.Item name={[f.name, 'label']} rules={[{ required: true }]}><Input placeholder="Band name" style={{ width: 190 }} /></Form.Item>
                  <Form.Item name={[f.name, 'bonusMonths']} rules={[{ required: true }]}><InputNumber min={0} max={12} step={0.5} addonAfter="months" style={{ width: 140 }} /></Form.Item>
                  <Form.Item name={[f.name, 'incrementPct']} rules={[{ required: true }]}><InputNumber min={0} max={50} step={0.5} addonAfter="%" style={{ width: 110 }} /></Form.Item>
                  {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(f.name)} />}
                </Space>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ minRating: 0, label: '', bonusMonths: 0, incrementPct: 0 })}>Add band</Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}

function AdjustModal({ reward, onClose, onSave }: {
  reward: Reward | null;
  onClose: () => void;
  onSave: (v: { bonusMonths: number; incrementPct: number; note: string }) => void;
}) {
  const [form] = Form.useForm();
  return (
    <Modal title={reward ? `Adjust · ${reward.employee.name}` : ''} open={!!reward} onCancel={onClose} onOk={form.submit} okText="Save" destroyOnHidden>
      {reward && (
        <Form form={form} layout="vertical" requiredMark={false} preserve={false} onFinish={onSave}
          initialValues={{ bonusMonths: reward.bonusMonths, incrementPct: reward.incrementPct, note: reward.note ?? '' }}>
          <Typography.Paragraph type="secondary">
            Final rating {reward.rating} ({reward.band}). Basic {fmtMoney(reward.basicSalary)}{reward.prorate < 1 ? `, bonus pro-rated to ${Math.round(reward.prorate * 100)}%` : ''}.
          </Typography.Paragraph>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="bonusMonths" label="Bonus" rules={[{ required: true }]}><InputNumber min={0} max={12} step={0.25} addonAfter="months" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="incrementPct" label="Increment" rules={[{ required: true }]}><InputNumber min={0} max={50} step={0.5} addonAfter="%" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="note" label="Reason (shown to Finance)" rules={[{ required: true, min: 3 }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      )}
    </Modal>
  );
}
