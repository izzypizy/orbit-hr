import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, InputNumber, Modal, Rate, Select, Space, Table, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { StatusTag, fmtDate } from '../format';
import type { Employee, Review } from '../types';

interface NewReview {
  employeeId: number;
  cycle: string;
  kpis: { title: string; weight: number }[];
}

export default function Reviews() {
  const { user, hasRole } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const reviews = useApi<Review[]>('/reviews');
  const canStart = hasRole('HR', 'MANAGER');
  const team = useApi<Employee[]>(canStart ? '/employees' : null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<NewReview>();

  const create = async (v: NewReview) => {
    try {
      const review = await api<Review>('/reviews', { body: v });
      navigate(`/reviews/${review.id}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const yourTurn = (r: Review) =>
    (r.status === 'SELF_REVIEW' && r.employee.id === user!.id) || (r.status === 'MANAGER_REVIEW' && r.reviewerId === user!.id);

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Performance Reviews</Typography.Title>
        {canStart && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Start review</Button>}
      </Space>

      <Card>
        <Table
          rowKey="id"
          loading={reviews.loading}
          dataSource={reviews.data}
          scroll={{ x: true }}
          columns={[
            { title: 'Cycle', render: (_, r) => <Link to={`/reviews/${r.id}`}>{r.cycle}</Link> },
            { title: 'Employee', render: (_, r) => r.employee.name },
            { title: 'Reviewer', dataIndex: 'reviewer' },
            { title: 'Status', render: (_, r) => <Space><StatusTag status={r.status} />{yourTurn(r) && <Typography.Text type="warning">Your turn</Typography.Text>}</Space> },
            { title: 'Rating', render: (_, r) => (r.overallRating ? <Space><Rate disabled allowHalf value={r.overallRating} style={{ fontSize: 14 }} />{r.overallRating}</Space> : '—') },
            { title: 'Completed', render: (_, r) => fmtDate(r.completedAt) },
          ]}
        />
      </Card>

      <Modal title="Start performance review" open={open} onCancel={() => setOpen(false)} onOk={form.submit} okText="Create" width={640} destroyOnHidden>
        <Form
          form={form}
          layout="vertical"
          onFinish={create}
          preserve={false}
          requiredMark={false}
          initialValues={{ cycle: `${new Date().getFullYear()} Annual`, kpis: [{ title: '', weight: 50 }, { title: '', weight: 30 }, { title: '', weight: 20 }] }}
        >
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]} style={{ minWidth: 260 }}>
              <Select showSearch optionFilterProp="label" options={team.data?.filter((e) => e.id !== user!.id).map((e) => ({ value: e.id, label: e.name }))} />
            </Form.Item>
            <Form.Item name="cycle" label="Review cycle" rules={[{ required: true }]}><Input /></Form.Item>
          </Space>
          <Typography.Text strong>KPIs (weights must add up to 100%)</Typography.Text>
          <Form.List name="kpis">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Space key={f.key} align="baseline" style={{ display: 'flex', marginTop: 8 }}>
                    <Form.Item name={[f.name, 'title']} rules={[{ required: true, min: 3, message: 'KPI title' }]} style={{ width: 380, marginBottom: 0 }}>
                      <Input placeholder="e.g. Deliver sprint commitments" />
                    </Form.Item>
                    <Form.Item name={[f.name, 'weight']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <InputNumber min={5} max={100} addonAfter="%" style={{ width: 110 }} />
                    </Form.Item>
                    {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(f.name)} />}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ title: '', weight: 10 })} icon={<PlusOutlined />} style={{ marginTop: 12 }}>Add KPI</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
}
