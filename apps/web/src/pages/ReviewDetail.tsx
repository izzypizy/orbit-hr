import { AimOutlined, FlagOutlined, StarOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Descriptions, Form, Input, Rate, Result, Row, Space, Steps, Table, Typography } from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { StatusTag, fmtDate, fmtKpi } from '../format';
import { EntryModal, KpiProgressTable, PaceSummary, RATING_LABELS, RatingBadge, RatingScale } from '../performance';
import type { Kpi, Review } from '../types';
import { StatCard } from '../ui';

interface RatingsForm {
  ratings: Record<number, { rating: number; comment?: string }>;
  summary?: string;
}

export default function ReviewDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { message } = App.useApp();
  const review = useApi<Review>(`/reviews/${id}`);
  const [form] = Form.useForm<RatingsForm>();
  const [entry, setEntry] = useState<{ kpi: Kpi; period?: string } | null>(null);
  const ratings = Form.useWatch('ratings', form) as RatingsForm['ratings'] | undefined;

  const r = review.data;
  if (review.error) return <Result status="warning" title={review.error} />;
  if (!r) return <Card loading />;

  const mode = r.status === 'SELF_REVIEW' && r.employee.id === user!.id ? 'self'
    : r.status === 'MANAGER_REVIEW' && r.reviewerId === user!.id ? 'manager'
    : null;
  // Employees don't see manager ratings until the review is completed
  const showManager = r.status === 'COMPLETED' || r.reviewerId === user!.id || user!.role === 'HR';
  const canUpdate = r.status !== 'COMPLETED' && (r.employee.id === user!.id || r.reviewerId === user!.id || user!.role === 'HR');

  const submit = async (v: RatingsForm) => {
    try {
      const ratings = r.kpis.map((k) => ({ kpiId: k.id, rating: v.ratings?.[k.id]?.rating, comment: v.ratings?.[k.id]?.comment }));
      await api<Review>(`/reviews/${r.id}/${mode}`, { body: { ratings, summary: v.summary } });
      review.reload();
      message.success(mode === 'self' ? 'Self-review submitted to your manager' : 'Review completed');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const step = { IN_PROGRESS: 0, SELF_REVIEW: 1, MANAGER_REVIEW: 2, COMPLETED: 4 }[r.status];
  // Both forms start from the rating each KPI's scale gives
  const initialRatings = mode ? Object.fromEntries(r.kpis.map((k) => [k.id, { rating: k.rating ?? 1 }])) : undefined;

  const ratingCell = (k: Kpi, who: 'self' | 'manager') => {
    const rating = who === 'self' ? k.selfRating : k.managerRating;
    const comment = who === 'self' ? k.selfComment : k.managerComment;
    if (mode === who) {
      // A manager who moves away from the scale's rating has to say why
      const changed = who === 'manager' && ratings?.[k.id]?.rating != null && ratings[k.id].rating !== (k.rating ?? 1);
      return (
        <>
          <Form.Item name={['ratings', k.id, 'rating']} rules={[{ required: true, message: 'Rate this KPI' }]} style={{ marginBottom: 4 }}>
            <Rate tooltips={RATING_LABELS} />
          </Form.Item>
          <Form.Item name={['ratings', k.id, 'comment']} style={{ marginBottom: 0 }}
            rules={changed ? [{ required: true, message: `The scale gives ${k.rating ?? 1}. Say why you changed it` }] : []}>
            <Input placeholder={changed ? 'Reason for changing the rating' : 'Comment (optional)'} />
          </Form.Item>
        </>
      );
    }
    return rating ? <><Rate disabled value={rating} style={{ fontSize: 14 }} /><div><Typography.Text type="secondary">{comment}</Typography.Text></div></> : '—';
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Link to="/reviews">Performance</Link>
        <Typography.Text type="secondary">/</Typography.Text>
        <Typography.Title level={3} style={{ margin: 0 }}>{r.cycle.name} · {r.employee.name}</Typography.Title>
        <StatusTag status={r.status} />
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Steps
          size="small"
          current={step}
          items={[
            { title: 'Track KPIs', description: `${fmtDate(r.cycle.startDate)} – ${fmtDate(r.cycle.endDate)}` },
            { title: 'Self-review' },
            { title: `Manager review (${r.reviewer})` },
            { title: 'Completed', description: r.completedAt && fmtDate(r.completedAt) },
          ]}
        />
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <StatCard icon={<StarOutlined />} tone="amber" label={r.overallRating ? 'Final rating' : 'Rating from KPIs'} value={r.overallRating ?? r.suggestedRating} suffix="/ 5"
            hint={r.overallRating ? `From KPIs: ${r.suggestedRating}` : 'Each KPI rated on its own scale, weighted'} />
        </Col>
        <Col xs={24} sm={8}><StatCard icon={<AimOutlined />} tone="violet" label="Achievement" value={r.achievement} suffix="% of target" hint="Target = rating 3" /></Col>
        <Col xs={24} sm={8}>
          <StatCard icon={<FlagOutlined />} tone="green" label="Updates entered" value={r.updates.done}
            suffix={r.updates.missing ? `· ${r.updates.missing} missing` : ''} hint={<PaceSummary pace={r.pace} />} />
        </Col>
      </Row>

      {r.status === 'COMPLETED' && (
        <Card style={{ marginBottom: 16 }}>
          <Descriptions column={1}>
            <Descriptions.Item label="Final rating">
              <Space><Rate disabled allowHalf value={r.overallRating ?? 0} /><b>{r.overallRating}</b> / 5</Space>
            </Descriptions.Item>
            <Descriptions.Item label="Manager summary">{r.managerSummary}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title="KPI progress" style={{ marginBottom: 16 }} extra={<Typography.Text type="secondary">Open a row to see each period and the rating scale</Typography.Text>}>
        <KpiProgressTable review={r} canUpdate={canUpdate} onUpdate={(kpi, period) => setEntry({ kpi, period })} />
      </Card>
      {entry && <EntryModal review={r} kpi={entry.kpi} period={entry.period} onClose={() => setEntry(null)} onSaved={() => review.reload()} />}

      {r.status !== 'IN_PROGRESS' && (
        <Card title="Ratings">
          <Form form={form} onFinish={submit} disabled={!mode} initialValues={{ ratings: initialRatings }}>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={r.kpis}
              scroll={{ x: true }}
              columns={[
                {
                  title: 'KPI',
                  render: (_, k) => (
                    <>
                      <b>{k.title}</b>
                      <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>Result {fmtKpi(k.value, k.unit)} · weight {k.weight}%</Typography.Text></div>
                      <div style={{ marginTop: 4 }}><RatingScale kpi={k} highlight={k.rating} /></div>
                    </>
                  ),
                },
                { title: 'Scale gives', render: (_, k) => <RatingBadge rating={k.rating ?? 1} /> },
                { title: 'Self rating', render: (_, k) => ratingCell(k, 'self') },
                ...(showManager ? [{ title: 'Manager rating', render: (_: unknown, k: Kpi) => ratingCell(k, 'manager') }] : []),
              ]}
            />
            {mode === 'manager' && (
              <Form.Item name="summary" label="Overall summary" rules={[{ required: true }]} style={{ marginTop: 16 }}>
                <Input.TextArea rows={3} />
              </Form.Item>
            )}
            {mode && (
              <Button type="primary" htmlType="submit" style={{ marginTop: 16 }}>
                {mode === 'self' ? 'Submit self-review' : 'Complete review'}
              </Button>
            )}
          </Form>
          {!mode && r.status !== 'COMPLETED' && (
            <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
              Waiting for {r.status === 'SELF_REVIEW' ? `${r.employee.name}'s self-review` : `${r.reviewer}'s review`}.
            </Typography.Paragraph>
          )}
        </Card>
      )}
    </>
  );
}
