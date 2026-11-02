import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Col, DatePicker, Form, Input, Modal, Popconfirm, Progress, Row, Select, Space, Table, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { api, useApi } from '../api';
import { LeaveStatusTag, fmtDate, fmtRange } from '../format';
import type { LeaveBalance, LeaveRequest, LeaveType } from '../types';

interface ApplyForm {
  leaveTypeId: number;
  range: [Dayjs, Dayjs];
  halfDay: boolean;
  reason: string;
}

export default function MyLeave() {
  const { message } = App.useApp();
  const balances = useApi<LeaveBalance[]>('/leave/balances');
  const requests = useApi<LeaveRequest[]>('/leave/requests');
  const types = useApi<LeaveType[]>('/leave/types');
  const [open, setOpen] = useState(false);

  const reload = () => {
    balances.reload();
    requests.reload();
  };

  const cancel = async (id: number) => {
    try {
      await api(`/leave/requests/${id}/cancel`, { method: 'POST' });
      message.success('Leave cancelled');
      reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const today = dayjs().format('YYYY-MM-DD');

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>My Leave</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Apply leave</Button>
      </Space>

      <Row gutter={[16, 16]}>
        {balances.data?.map((b) => (
          <Col xs={12} md={6} key={b.leaveTypeId}>
            <Card size="small" title={b.leaveType.name}>
              {b.available === null ? (
                <Typography.Text type="secondary">No limit · {b.taken} day(s) taken</Typography.Text>
              ) : (
                <>
                  <Typography.Title level={3} style={{ margin: 0 }}>{b.available} <Typography.Text type="secondary" style={{ fontSize: 14 }}>days left</Typography.Text></Typography.Title>
                  <Progress percent={b.entitled ? ((b.taken + b.pending) / b.entitled) * 100 : 0} success={{ percent: b.entitled ? (b.taken / b.entitled) * 100 : 0 }} showInfo={false} size="small" />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{b.taken} taken · {b.pending} pending · {b.entitled} entitled</Typography.Text>
                </>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="My requests" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          loading={requests.loading}
          dataSource={requests.data}
          scroll={{ x: true }}
          columns={[
            { title: 'Type', render: (_, r) => r.leaveType.name },
            { title: 'Dates', render: (_, r) => fmtRange(r.startDate, r.endDate) },
            { title: 'Days', dataIndex: 'days' },
            { title: 'Reason', dataIndex: 'reason', ellipsis: true },
            { title: 'Status', render: (_, r) => <LeaveStatusTag status={r.status} /> },
            { title: 'Decided by', render: (_, r) => (r.approver ? <span title={r.approverComment ?? ''}>{r.approver}</span> : '—') },
            { title: 'Applied', render: (_, r) => fmtDate(r.createdAt) },
            {
              title: '',
              render: (_, r) =>
                (r.status === 'PENDING' || (r.status === 'APPROVED' && r.startDate > today)) && (
                  <Popconfirm title="Cancel this leave?" onConfirm={() => cancel(r.id)}>
                    <Button size="small" danger>Cancel</Button>
                  </Popconfirm>
                ),
            },
          ]}
        />
      </Card>

      <ApplyLeaveModal open={open} types={types.data ?? []} onClose={() => setOpen(false)} onApplied={reload} />
    </>
  );
}

function ApplyLeaveModal({ open, types, onClose, onApplied }: { open: boolean; types: LeaveType[]; onClose: () => void; onApplied: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ApplyForm>();
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const range = Form.useWatch('range', form);
  const halfDay = Form.useWatch('halfDay', form);

  const singleDay = !!range && range[0].isSame(range[1], 'day');

  // Preview working days (excludes weekends and public holidays) as dates change
  useEffect(() => {
    if (!range) return setDays(null);
    const [s, e] = range.map((d) => d.format('YYYY-MM-DD'));
    api<{ days: number }>(`/leave/working-days?start=${s}&end=${e}`)
      .then((r) => setDays(r.days))
      .catch(() => setDays(null));
  }, [range]);

  const submit = async (values: ApplyForm) => {
    setSaving(true);
    try {
      await api('/leave/requests', {
        body: {
          leaveTypeId: values.leaveTypeId,
          startDate: values.range[0].format('YYYY-MM-DD'),
          endDate: values.range[1].format('YYYY-MM-DD'),
          halfDay: singleDay && !!values.halfDay,
          reason: values.reason,
        },
      });
      message.success('Leave submitted for approval');
      form.resetFields();
      onClose();
      onApplied();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Apply leave" open={open} onCancel={onClose} onOk={form.submit} okText="Submit" confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} preserve={false}>
        <Form.Item name="leaveTypeId" label="Leave type" rules={[{ required: true }]}>
          <Select options={types.map((t) => ({ value: t.id, label: t.name }))} />
        </Form.Item>
        <Form.Item
          name="range"
          label="Dates"
          rules={[{ required: true }]}
          extra={days !== null && `${singleDay && halfDay ? 0.5 : days} working day(s) — weekends and public holidays are excluded`}
        >
          <DatePicker.RangePicker style={{ width: '100%' }} format="DD MMM YYYY" />
        </Form.Item>
        {singleDay && (
          <Form.Item name="halfDay" valuePropName="checked">
            <Checkbox>Half day</Checkbox>
          </Form.Item>
        )}
        <Form.Item name="reason" label="Reason" rules={[{ required: true, min: 3 }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
