import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { StatusTag, fmtDate } from '../format';
import type { Employee, Training } from '../types';

interface TrainingForm {
  employeeId?: number;
  title: string;
  provider: string;
  date: Dayjs;
  hours: number;
  status: Training['status'];
  certificateExpiry?: Dayjs;
}

export default function TrainingPage() {
  const { user, hasRole } = useAuth();
  const { message } = App.useApp();
  const trainings = useApi<Training[]>('/training');
  const canAssign = hasRole('HR', 'MANAGER');
  const team = useApi<Employee[]>(canAssign ? '/employees' : null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<TrainingForm>();

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      message.success(success);
      trainings.reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const create = (v: TrainingForm) =>
    run(async () => {
      await api('/training', {
        body: { ...v, date: v.date.format('YYYY-MM-DD'), certificateExpiry: v.certificateExpiry?.format('YYYY-MM-DD') ?? null },
      });
      setOpen(false);
    }, 'Training recorded');

  const year = String(dayjs().year());
  const mine = trainings.data?.filter((t) => t.employeeId === user!.id) ?? [];
  const hoursThisYear = mine.filter((t) => t.status === 'COMPLETED' && t.date.startsWith(year)).reduce((s, t) => s + t.hours, 0);
  const soon = dayjs().add(90, 'day').format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Training</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Add training</Button>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title={`My training hours (${year})`} value={hoursThisYear} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="My upcoming" value={mine.filter((t) => t.status === 'PLANNED').length} /></Card></Col>
      </Row>

      <Card>
        <Table
          rowKey="id"
          loading={trainings.loading}
          dataSource={trainings.data}
          scroll={{ x: true }}
          columns={[
            ...(canAssign ? [{ title: 'Employee', dataIndex: 'employeeName' }] : []),
            { title: 'Course', dataIndex: 'title' },
            { title: 'Provider', dataIndex: 'provider' },
            { title: 'Date', render: (_: unknown, t: Training) => fmtDate(t.date) },
            { title: 'Hours', dataIndex: 'hours' },
            { title: 'Status', render: (_: unknown, t: Training) => <StatusTag status={t.status} /> },
            {
              title: 'Certificate expiry',
              render: (_: unknown, t: Training) => !t.certificateExpiry ? '—' : (
                <Space>
                  {fmtDate(t.certificateExpiry)}
                  {t.certificateExpiry < today ? <Tag color="red">Expired</Tag> : t.certificateExpiry <= soon && <Tag color="orange">Expiring soon</Tag>}
                </Space>
              ),
            },
            {
              title: '',
              render: (_: unknown, t: Training) => (
                <Space>
                  {t.status === 'PLANNED' && (
                    <Button size="small" onClick={() => run(() => api(`/training/${t.id}/complete`, { method: 'POST' }), 'Marked as completed')}>Mark completed</Button>
                  )}
                  <Popconfirm title="Delete this record?" onConfirm={() => run(() => api(`/training/${t.id}`, { method: 'DELETE' }), 'Deleted')}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="Add training" open={open} onCancel={() => setOpen(false)} onOk={form.submit} okText="Save" destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={create} preserve={false} requiredMark={false} initialValues={{ status: 'PLANNED', employeeId: user!.id }}>
          {canAssign && (
            <Form.Item name="employeeId" label="Employee">
              <Select
                showSearch
                optionFilterProp="label"
                options={[{ value: user!.id, label: `${user!.name} (me)` }, ...(team.data ?? []).filter((e) => e.id !== user!.id).map((e) => ({ value: e.id, label: e.name }))]}
              />
            </Form.Item>
          )}
          <Form.Item name="title" label="Course" rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true, min: 2 }]}><Input placeholder="e.g. Internal L&D" /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item></Col>
            <Col span={12}><Form.Item name="hours" label="Hours" rules={[{ required: true }]}><InputNumber min={0.5} max={500} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select options={[{ value: 'PLANNED', label: 'Planned' }, { value: 'COMPLETED', label: 'Completed' }]} />
              </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="certificateExpiry" label="Certificate expiry (optional)"><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
