import { App, Button, Card, Descriptions, Form, Input, Rate, Result, Space, Steps, Table, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { StatusTag, fmtDate } from '../format';
import type { Review } from '../types';

interface RatingsForm {
  ratings: Record<number, { rating: number; comment?: string }>;
  summary?: string;
}

const RATING_LABELS = ['Unsatisfactory', 'Needs improvement', 'Meets expectations', 'Exceeds expectations', 'Outstanding'];

export default function ReviewDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { message } = App.useApp();
  const review = useApi<Review>(`/reviews/${id}`);
  const [form] = Form.useForm<RatingsForm>();

  const r = review.data;
  if (review.error) return <Result status="warning" title={review.error} />;
  if (!r) return <Card loading />;

  const mode = r.status === 'SELF_REVIEW' && r.employee.id === user!.id ? 'self'
    : r.status === 'MANAGER_REVIEW' && r.reviewerId === user!.id ? 'manager'
    : null;
  // Employees don't see manager ratings until the review is completed
  const showManager = r.status === 'COMPLETED' || r.reviewerId === user!.id || user!.role === 'HR';

  const submit = async (v: RatingsForm) => {
    try {
      const ratings = r.kpis.map((k) => ({ kpiId: k.id, rating: v.ratings?.[k.id]?.rating, comment: v.ratings?.[k.id]?.comment }));
      review.setData(await api<Review>(`/reviews/${r.id}/${mode}`, { body: { ratings, summary: v.summary } }));
      message.success(mode === 'self' ? 'Self-review submitted to your manager' : 'Review completed');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const step = { SELF_REVIEW: 0, MANAGER_REVIEW: 1, COMPLETED: 2 }[r.status];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{r.cycle} review · {r.employee.name}</Typography.Title>
        <StatusTag status={r.status} />
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Steps size="small" current={step === 2 ? 3 : step} items={[{ title: 'Self-review' }, { title: `Manager review (${r.reviewer})` }, { title: 'Completed', description: r.completedAt && fmtDate(r.completedAt) }]} />
      </Card>

      {r.status === 'COMPLETED' && (
        <Card style={{ marginBottom: 16 }}>
          <Descriptions column={1}>
            <Descriptions.Item label="Overall rating">
              <Space><Rate disabled allowHalf value={r.overallRating ?? 0} /><b>{r.overallRating}</b> / 5</Space>
            </Descriptions.Item>
            <Descriptions.Item label="Manager summary">{r.managerSummary}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title="KPIs">
        <Form form={form} onFinish={submit} disabled={!mode}>
          <Table
            rowKey="id"
            pagination={false}
            dataSource={r.kpis}
            scroll={{ x: true }}
            columns={[
              { title: 'KPI', dataIndex: 'title' },
              { title: 'Weight', render: (_, k) => `${k.weight}%` },
              {
                title: 'Self rating',
                render: (_, k) => mode === 'self' ? (
                  <>
                    <Form.Item name={['ratings', k.id, 'rating']} rules={[{ required: true, message: 'Rate this KPI' }]} style={{ marginBottom: 4 }}>
                      <Rate tooltips={RATING_LABELS} />
                    </Form.Item>
                    <Form.Item name={['ratings', k.id, 'comment']} style={{ marginBottom: 0 }}><Input placeholder="Comment (optional)" /></Form.Item>
                  </>
                ) : k.selfRating ? (
                  <><Rate disabled value={k.selfRating} style={{ fontSize: 14 }} /><div><Typography.Text type="secondary">{k.selfComment}</Typography.Text></div></>
                ) : '—',
              },
              ...(showManager ? [{
                title: 'Manager rating',
                render: (_: unknown, k: Review['kpis'][number]) => mode === 'manager' ? (
                  <>
                    <Form.Item name={['ratings', k.id, 'rating']} rules={[{ required: true, message: 'Rate this KPI' }]} style={{ marginBottom: 4 }}>
                      <Rate tooltips={RATING_LABELS} />
                    </Form.Item>
                    <Form.Item name={['ratings', k.id, 'comment']} style={{ marginBottom: 0 }}><Input placeholder="Comment (optional)" /></Form.Item>
                  </>
                ) : k.managerRating ? (
                  <><Rate disabled value={k.managerRating} style={{ fontSize: 14 }} /><div><Typography.Text type="secondary">{k.managerComment}</Typography.Text></div></>
                ) : '—',
              }] : []),
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
    </>
  );
}
