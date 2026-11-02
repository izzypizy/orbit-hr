// Shared pieces for the performance pages: KPI results, period entries, rating scales and the KPI editor.
import { EditOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Form, Input, InputNumber, Modal, Progress, Row, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { api } from './api';
import { StatusTag, fmtDate, fmtKpi } from './format';
import type { Kpi, KpiAggregation, KpiFrequency, KpiPeriod, PaceCounts, PaceStatus, Review } from './types';

const PACE_COLOR: Record<PaceStatus, string> = { ON_TRACK: '#16A34A', AT_RISK: '#F59E0B', OFF_TRACK: '#DC2626', NO_DATA: '#D4D4D8' };

export const RATING_LABELS = ['Does not meet expectations', 'Partially meets expectations', 'Meets expectations', 'Exceeds expectations', 'Far exceeds expectations'];

export const FREQUENCY_LABEL: Record<KpiFrequency, string> = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', HALF_YEARLY: 'Half-yearly' };
const FIGURE: Record<KpiFrequency, string> = { MONTHLY: 'monthly', QUARTERLY: 'quarterly', HALF_YEARLY: 'half-year' };
export const AGGREGATION_LABEL: Record<KpiAggregation, string> = { AVERAGE: 'Average', TOTAL: 'Total', LATEST: 'Latest value' };

/** "Average of monthly figures", "Total of quarterly figures", "Latest monthly figure". */
export const describeKpi = (k: Pick<Kpi, 'aggregation' | 'frequency'>) =>
  k.aggregation === 'LATEST' ? `Latest ${FIGURE[k.frequency]} figure` : `${AGGREGATION_LABEL[k.aggregation]} of ${FIGURE[k.frequency]} figures`;

/** Rating ranges for a KPI, from 1 to 5, e.g. ["below MYR 20,000", "MYR 20,000 – 49,999", ...]. */
export function scaleRanges(k: Pick<Kpi, 'direction' | 'scale' | 'unit'>) {
  const f = (n: number) => fmtKpi(n, k.unit);
  const s = k.scale;
  if (k.direction === 'HIGHER') {
    // Whole-number scales read as "50,000 – 55,000"; others as "50.5 to below 55.5"
    const upTo = (from: number, next: number) => (Number.isInteger(next) ? `${f(from)} – ${f(next - 1)}` : `${f(from)} to below ${f(next)}`);
    return [`below ${f(s[0])}`, upTo(s[0], s[1]), upTo(s[1], s[2]), upTo(s[2], s[3]), `${f(s[3])} or more`];
  }
  return [`more than ${f(s[0])}`, `${f(s[0])} or less`, `${f(s[1])} or less`, `${f(s[2])} or less`, `${f(s[3])} or less`];
}

export function RatingScale({ kpi, highlight }: { kpi: Pick<Kpi, 'direction' | 'scale' | 'unit'>; highlight?: number | null }) {
  const ranges = scaleRanges(kpi);
  return (
    <Space size={[6, 6]} wrap>
      {ranges.map((r, i) => (
        <Tooltip key={i} title={RATING_LABELS[i]}>
          <Tag color={highlight === i + 1 ? 'purple' : undefined} style={{ margin: 0 }}>
            <b>{i + 1}</b> · {r}
          </Tag>
        </Tooltip>
      ))}
    </Space>
  );
}

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

export const RatingBadge = ({ rating }: { rating: number | null }) => rating == null
  ? <Typography.Text type="secondary">—</Typography.Text>
  : <Tooltip title={RATING_LABELS[rating - 1]}><Tag color={['red', 'orange', 'blue', 'green', 'purple'][rating - 1]} style={{ fontWeight: 600 }}>{rating}</Tag></Tooltip>;

/** KPI table: result so far, rating from the KPI's scale, updates done/missing, pace; expands to every period. */
export function KpiProgressTable({ review, canUpdate, onUpdate }: {
  review: Review;
  canUpdate: boolean;
  onUpdate: (kpi: Kpi, period?: string) => void;
}) {
  return (
    <Table
      rowKey="id"
      pagination={false}
      dataSource={review.kpis}
      scroll={{ x: 'max-content' }}
      expandable={{
        expandedRowRender: (k) => <PeriodTable kpi={k} canUpdate={canUpdate} onUpdate={(p) => onUpdate(k, p)} />,
      }}
      columns={[
        {
          title: 'KPI',
          render: (_, k) => (
            <>
              <Typography.Text strong>{k.title}</Typography.Text>
              <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{describeKpi(k)} · target {fmtKpi(k.target, k.unit)} · weight {k.weight}%</Typography.Text></div>
            </>
          ),
        },
        {
          title: 'Result so far',
          render: (_, k) => (
            <div style={{ whiteSpace: 'nowrap' }}>
              {fmtKpi(k.value, k.unit)}
              {k.aggregation === 'TOTAL' && k.projected != null && k.projected !== k.value && (
                <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>on course for {fmtKpi(k.projected, k.unit)}</Typography.Text></div>
              )}
            </div>
          ),
        },
        {
          title: 'Rating',
          render: (_, k) => (
            <Space size={4}>
              <RatingBadge rating={k.rating} />
              {k.projectedRating !== k.rating && <Tooltip title="If the current pace continues"><Typography.Text type="secondary" style={{ fontSize: 12 }}>→ {k.projectedRating}</Typography.Text></Tooltip>}
            </Space>
          ),
        },
        {
          title: 'Updates',
          render: (_, k) => (
            <Space size={4} style={{ whiteSpace: 'nowrap' }}>
              <Typography.Text>{k.done}/{k.periods.length}</Typography.Text>
              {k.missing > 0 && <Tag color="red">{k.missing} missing</Tag>}
            </Space>
          ),
        },
        { title: 'Pace', render: (_, k) => <StatusTag status={k.pace} /> },
        ...(canUpdate ? [{
          title: '',
          render: (_: unknown, k: Kpi) => <Button size="small" icon={<EditOutlined />} onClick={() => onUpdate(k)}>Enter figure</Button>,
        }] : []),
      ]}
    />
  );
}

const PERIOD_STATUS: Record<KpiPeriod['status'], [string, string]> = {
  DONE: ['Entered', 'green'],
  MISSING: ['Missing', 'red'],
  OPEN: ['Open now', 'blue'],
  UPCOMING: ['Upcoming', 'default'],
};

function PeriodTable({ kpi, canUpdate, onUpdate }: { kpi: Kpi; canUpdate: boolean; onUpdate: (period: string) => void }) {
  return (
    <div style={{ padding: '4px 0 8px' }}>
      <div style={{ marginBottom: 10 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Rating scale ({describeKpi(kpi).toLowerCase()}):</Typography.Text>
        <RatingScale kpi={kpi} highlight={kpi.rating} />
      </div>
      <Table
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={kpi.periods}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: kpi.frequency === 'MONTHLY' ? 'Month' : 'Period', dataIndex: 'label' },
          { title: 'Status', render: (_, p) => <Tag color={PERIOD_STATUS[p.status][1]}>{PERIOD_STATUS[p.status][0]}</Tag> },
          { title: 'Figure', render: (_, p) => fmtKpi(p.value, kpi.unit) },
          { title: 'Note', render: (_, p) => p.note ?? '' },
          { title: 'Entered', render: (_, p) => (p.by ? `${p.by}, ${fmtDate(p.updatedAt)}` : '') },
          ...(canUpdate ? [{
            title: '',
            render: (_: unknown, p: KpiPeriod) => p.status !== 'UPCOMING' && (
              <Button size="small" type={p.status === 'DONE' ? 'text' : 'link'} onClick={() => onUpdate(p.key)}>{p.status === 'DONE' ? 'Correct' : 'Enter'}</Button>
            ),
          }] : []),
        ]}
      />
    </div>
  );
}

/** Modal to enter or correct a KPI's figure for one period. Calls onSaved with the updated review. */
export function EntryModal({ review, kpi, period, onClose, onSaved }: {
  review: Review;
  kpi: Kpi | null;
  period?: string;
  onClose: () => void;
  onSaved: (r: Review) => void;
}) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ period: string; value: number; note?: string }>();
  const selected = Form.useWatch('period', form);

  if (!kpi) return null;
  const open = kpi.periods.filter((p) => p.status !== 'UPCOMING');
  const initial = period ?? (open.find((p) => p.status === 'MISSING') ?? open.find((p) => p.status === 'OPEN') ?? open[open.length - 1])?.key;
  const current = kpi.periods.find((p) => p.key === selected);

  const submit = async (v: { period: string; value: number; note?: string }) => {
    setSaving(true);
    try {
      onSaved(await api<Review>(`/reviews/${review.id}/entries`, { body: { kpiId: kpi.id, ...v } }));
      message.success('Figure saved');
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Enter figure · ${kpi.title}`} open onCancel={onClose} footer={null} destroyOnHidden>
      <Typography.Paragraph type="secondary">
        {FREQUENCY_LABEL[kpi.frequency]} figure. The KPI result is the {describeKpi(kpi).toLowerCase()}.
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        requiredMark={false}
        initialValues={{ period: initial, value: kpi.periods.find((p) => p.key === initial)?.value ?? undefined, note: kpi.periods.find((p) => p.key === initial)?.note ?? undefined }}
        onValuesChange={(changed) => {
          if (changed.period) {
            const p = kpi.periods.find((x) => x.key === changed.period);
            form.setFieldsValue({ value: p?.value ?? undefined, note: p?.note ?? undefined });
          }
        }}
      >
        <Form.Item name="period" label={kpi.frequency === 'MONTHLY' ? 'Month' : 'Period'} rules={[{ required: true }]}>
          <Select options={open.map((p) => ({ value: p.key, label: `${p.label}${p.status === 'DONE' ? ` (entered: ${fmtKpi(p.value, kpi.unit)})` : p.status === 'MISSING' ? ' (missing)' : ''}` }))} />
        </Form.Item>
        <Form.Item name="value" label={`Figure for this period (${kpi.unit})`} rules={[{ required: true }]}
          extra={current?.status === 'DONE' ? 'Saving replaces the figure entered earlier.' : undefined}>
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="note" label="Note (optional)"><Input.TextArea rows={2} placeholder="What drove the result, any blockers" /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} block>Save figure</Button>
      </Form>
    </Modal>
  );
}

export interface KpiDraft {
  title: string;
  weight: number;
  unit: string;
  frequency: KpiFrequency;
  aggregation: KpiAggregation;
  direction: Kpi['direction'];
  scale: [number, number, number, number];
}

/** Form.List cards for defining KPIs (used inside a Form with a `kpis` field). */
export function KpiFields() {
  return (
    <Form.List name="kpis">
      {(fields, { add, remove }) => (
        <>
          {fields.map((f, i) => (
            <Card
              key={f.key}
              size="small"
              style={{ marginBottom: 12 }}
              title={`KPI ${i + 1}`}
              extra={fields.length > 1 && <Button type="text" size="small" icon={<MinusCircleOutlined />} onClick={() => remove(f.name)}>Remove</Button>}
            >
              <Row gutter={12}>
                <Col xs={24} md={12}><Form.Item name={[f.name, 'title']} label="KPI" rules={[{ required: true, min: 3 }]}><Input placeholder="e.g. Average monthly sales" /></Form.Item></Col>
                <Col xs={12} md={6}><Form.Item name={[f.name, 'unit']} label="Unit" rules={[{ required: true }]}><Input placeholder="MYR, %, tickets" /></Form.Item></Col>
                <Col xs={12} md={6}><Form.Item name={[f.name, 'weight']} label="Weight" rules={[{ required: true }]}><InputNumber min={5} max={100} addonAfter="%" style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}>
                  <Form.Item name={[f.name, 'frequency']} label="Update" rules={[{ required: true }]}>
                    <Select options={(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY'] as const).map((v) => ({ value: v, label: FREQUENCY_LABEL[v] }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name={[f.name, 'aggregation']} label="Result is the" rules={[{ required: true }]}>
                    <Select options={[{ value: 'AVERAGE', label: 'Average of the figures' }, { value: 'TOTAL', label: 'Total of the figures' }, { value: 'LATEST', label: 'Latest figure' }]} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name={[f.name, 'direction']} label="Better when" rules={[{ required: true }]}>
                    <Select options={[{ value: 'HIGHER', label: 'Higher (e.g. sales)' }, { value: 'LOWER', label: 'Lower (e.g. defects)' }]} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item noStyle shouldUpdate={(a, b) => a.kpis?.[f.name]?.direction !== b.kpis?.[f.name]?.direction}>
                {({ getFieldValue }) => {
                  const lower = getFieldValue(['kpis', f.name, 'direction']) === 'LOWER';
                  return (
                    <>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Rating scale: the result {lower ? 'at or below' : 'at or above'} each value earns that rating; anything else is 1. Rating 3 is the target.
                      </Typography.Text>
                      <Row gutter={12} style={{ marginTop: 6 }}>
                        {[2, 3, 4, 5].map((rating, j) => (
                          <Col xs={12} md={6} key={rating}>
                            <Form.Item name={[f.name, 'scale', j]} label={`Rating ${rating} ${lower ? 'at most' : 'from'}`} rules={[{ required: true }]} tooltip={RATING_LABELS[rating - 1]}>
                              <InputNumber style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        ))}
                      </Row>
                    </>
                  );
                }}
              </Form.Item>
            </Card>
          ))}
          <Button type="dashed" block onClick={() => add(blankKpi(10))} icon={<PlusOutlined />}>Add KPI</Button>
        </>
      )}
    </Form.List>
  );
}

// Scale left empty so the form asks for it
export const blankKpi = (weight: number): KpiDraft => ({
  title: '', weight, unit: '', frequency: 'MONTHLY', aggregation: 'AVERAGE', direction: 'HIGHER', scale: [] as unknown as KpiDraft['scale'],
});

/** The sales example: average monthly sales, RM50,000 target. */
export const salesKpiExample = (weight: number): KpiDraft => ({
  title: 'Average monthly sales', weight, unit: 'MYR', frequency: 'MONTHLY', aggregation: 'AVERAGE', direction: 'HIGHER',
  scale: [20000, 50000, 55001, 60001],
});
