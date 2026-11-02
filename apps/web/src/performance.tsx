// Shared pieces for the performance pages: KPI progress, check-ins and the KPI editor.
import { HistoryOutlined, MinusCircleOutlined, PlusOutlined, RiseOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, InputNumber, Modal, Progress, Select, Space, Table, Timeline, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { api } from './api';
import { StatusTag, fmtDate, fmtKpi } from './format';
import type { Kpi, KpiCheckIn, PaceCounts, PaceStatus, Review } from './types';

const PACE_COLOR: Record<PaceStatus, string> = { ON_TRACK: '#16A34A', AT_RISK: '#F59E0B', OFF_TRACK: '#DC2626', NO_DATA: '#D4D4D8' };

export const RATING_LABELS = ['Unsatisfactory', 'Needs improvement', 'Meets expectations', 'Exceeds expectations', 'Outstanding'];

/** Achievement against target (capped at 100% visually; the number shows the real value). */
export function AchievementBar({ value, pace, width = 140 }: { value: number; pace?: PaceStatus; width?: number }) {
  const color = pace ? PACE_COLOR[pace] : value >= 100 ? PACE_COLOR.ON_TRACK : value >= 80 ? PACE_COLOR.AT_RISK : PACE_COLOR.OFF_TRACK;
  return (
    <Space size={8} style={{ width }}>
      <Progress percent={Math.min(100, value)} showInfo={false} strokeColor={color} size="small" style={{ width: width - 48, margin: 0 }} />
      <Typography.Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{value}%</Typography.Text>
    </Space>
  );
}

export function PaceSummary({ pace }: { pace: PaceCounts }) {
  const items: [PaceStatus, number][] = [['ON_TRACK', pace.onTrack], ['AT_RISK', pace.atRisk], ['OFF_TRACK', pace.offTrack], ['NO_DATA', pace.noData]];
  return (
    <Space size={4} wrap>
      {items.filter(([, n]) => n).map(([status, n]) => (
        <Tooltip key={status} title={`${n} KPI${n > 1 ? 's' : ''}`}>
          <span><StatusTag status={status} /></span>
        </Tooltip>
      ))}
    </Space>
  );
}

const describeTarget = (k: Kpi) =>
  `${k.direction === 'HIGHER' ? 'At least' : 'At most'} ${fmtKpi(k.target, k.unit)}${k.tracking === 'CUMULATIVE' ? ' by cycle end' : ''}`;

/** KPI table with targets, latest actuals, achievement and pace, plus check-in history. */
export function KpiProgressTable({ review, canCheckIn, onCheckIn }: {
  review: Review;
  canCheckIn: boolean;
  onCheckIn: (kpi: Kpi) => void;
}) {
  const history = (k: Kpi) => (review.checkIns ?? []).filter((c) => c.kpiId === k.id);
  return (
    <Table
      rowKey="id"
      pagination={false}
      dataSource={review.kpis}
      scroll={{ x: 'max-content' }}
      expandable={review.checkIns ? {
        rowExpandable: (k) => history(k).length > 0,
        expandedRowRender: (k) => <CheckInHistory items={history(k)} unit={k.unit} />,
        expandIcon: ({ expanded, onExpand, record, expandable }) => expandable
          ? <Tooltip title={expanded ? 'Hide history' : 'Show history'}><Button type="text" size="small" icon={<HistoryOutlined />} onClick={(e) => onExpand(record, e)} /></Tooltip>
          : null,
      } : undefined}
      columns={[
        {
          title: 'KPI',
          render: (_, k) => (
            <>
              <Typography.Text strong>{k.title}</Typography.Text>
              <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{describeTarget(k)} · weight {k.weight}%</Typography.Text></div>
            </>
          ),
        },
        { title: 'Actual', render: (_, k) => <span style={{ whiteSpace: 'nowrap' }}>{fmtKpi(k.actual, k.unit)}</span> },
        { title: 'Achievement', render: (_, k) => <AchievementBar value={k.achievement} pace={k.pace} /> },
        { title: 'Pace', render: (_, k) => <StatusTag status={k.pace} /> },
        ...(canCheckIn ? [{
          title: '',
          render: (_: unknown, k: Kpi) => <Button size="small" icon={<RiseOutlined />} onClick={() => onCheckIn(k)}>Update</Button>,
        }] : []),
      ]}
    />
  );
}

function CheckInHistory({ items, unit }: { items: KpiCheckIn[]; unit: string }) {
  return (
    <Timeline
      style={{ margin: '12px 0 0 8px' }}
      items={items.map((c) => ({
        children: (
          <>
            <b>{fmtKpi(c.value, unit)}</b> · {fmtDate(c.date)} · {c.by}
            {c.note && <div><Typography.Text type="secondary">{c.note}</Typography.Text></div>}
          </>
        ),
      }))}
    />
  );
}

/** Modal to log a KPI's latest value. Calls onSaved with the updated review. */
export function CheckInModal({ review, kpi, onClose, onSaved }: {
  review: Review;
  kpi: Kpi | null;
  onClose: () => void;
  onSaved: (r: Review) => void;
}) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const submit = async (v: { value: number; note?: string }) => {
    setSaving(true);
    try {
      onSaved(await api<Review>(`/reviews/${review.id}/check-ins`, { body: { kpiId: kpi!.id, ...v } }));
      message.success('Progress updated');
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={kpi ? `Update · ${kpi.title}` : ''} open={!!kpi} onCancel={onClose} footer={null} destroyOnHidden>
      {kpi && (
        <Form layout="vertical" onFinish={submit} initialValues={{ value: kpi.actual ?? undefined }} requiredMark={false}>
          <Typography.Paragraph type="secondary">
            Target: {describeTarget(kpi)}.{' '}
            {kpi.tracking === 'CUMULATIVE' ? 'Enter the running total so far.' : 'Enter the current level.'}
          </Typography.Paragraph>
          <Form.Item name="value" label={`Current value (${kpi.unit})`} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="Note (optional)"><Input.TextArea rows={2} placeholder="What changed, any blockers" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block>Save update</Button>
        </Form>
      )}
    </Modal>
  );
}

export interface KpiDraft {
  title: string;
  weight: number;
  unit: string;
  target: number;
  direction: Kpi['direction'];
  tracking: Kpi['tracking'];
}

export const blankKpi = (weight: number): KpiDraft => ({ title: '', weight, unit: '%', target: 100, direction: 'HIGHER', tracking: 'LEVEL' });

/** Form.List rows for defining measurable KPIs (used inside a Form with a `kpis` field). */
export function KpiFields() {
  return (
    <Form.List name="kpis">
      {(fields, { add, remove }) => (
        <>
          {fields.map((f) => (
            <div key={f.key} className="kpi-row">
              <Form.Item name={[f.name, 'title']} rules={[{ required: true, min: 3, message: 'KPI name' }]} style={{ flex: '2 1 220px' }}>
                <Input placeholder="KPI, e.g. Sales closed" />
              </Form.Item>
              <Form.Item name={[f.name, 'direction']} style={{ flex: '0 0 120px' }}>
                <Select options={[{ value: 'HIGHER', label: 'At least' }, { value: 'LOWER', label: 'At most' }]} />
              </Form.Item>
              <Form.Item name={[f.name, 'target']} rules={[{ required: true, message: 'Target' }]} style={{ flex: '0 0 110px' }}>
                <InputNumber min={0} placeholder="Target" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name={[f.name, 'unit']} rules={[{ required: true, message: 'Unit' }]} style={{ flex: '0 0 100px' }}>
                <Input placeholder="%, MYR, tickets" />
              </Form.Item>
              <Form.Item name={[f.name, 'tracking']} style={{ flex: '0 0 170px' }}>
                <Select options={[{ value: 'CUMULATIVE', label: 'Adds up over cycle' }, { value: 'LEVEL', label: 'Level to keep' }]} />
              </Form.Item>
              <Form.Item name={[f.name, 'weight']} rules={[{ required: true }]} style={{ flex: '0 0 100px' }}>
                <InputNumber min={5} max={100} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
              {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(f.name)} style={{ marginTop: 9 }} />}
            </div>
          ))}
          <Button type="dashed" onClick={() => add(blankKpi(10))} icon={<PlusOutlined />}>Add KPI</Button>
        </>
      )}
    </Form.List>
  );
}
