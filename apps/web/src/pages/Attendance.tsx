import { LoginOutlined, LogoutOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Space, Statistic, Table, Tabs, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { StatusTag, fmtDate } from '../format';
import type { AttendanceMonth, AttendanceRecord, OvertimeRequest, TeamAttendance } from '../types';

interface Today {
  date: string;
  workStart: string;
  record: AttendanceRecord | null;
}

/** Clock in/out card, also shown on the dashboard. */
export function ClockCard({ onChange }: { onChange?: () => void }) {
  const { message } = App.useApp();
  const today = useApi<Today>('/attendance/today');
  const r = today.data?.record;

  const clock = async (action: 'clock-in' | 'clock-out') => {
    try {
      const rec = await api<AttendanceRecord>(`/attendance/${action}`, { method: 'POST' });
      message.success(action === 'clock-in' ? `Clocked in at ${rec.clockInTime}` : `Clocked out at ${rec.clockOutTime}`);
      today.reload();
      onChange?.();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Card title={`Today · ${dayjs().format('ddd, DD MMM')}`} loading={today.loading}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Text type="secondary">Work starts at {today.data?.workStart}</Typography.Text>
        <Space size="large">
          <Statistic title="Clock in" value={r?.clockInTime ?? '--:--'} valueStyle={{ color: r?.late ? '#d46b08' : undefined }} />
          <Statistic title="Clock out" value={r?.clockOutTime ?? '--:--'} />
        </Space>
        {!r && <Button type="primary" icon={<LoginOutlined />} onClick={() => clock('clock-in')}>Clock in</Button>}
        {r && !r.clockOutTime && <Button icon={<LogoutOutlined />} onClick={() => clock('clock-out')}>Clock out</Button>}
        {r?.clockOutTime && <Typography.Text type="success">Done for today · {r.hours} h</Typography.Text>}
      </Space>
    </Card>
  );
}

function MyAttendance() {
  const [month, setMonth] = useState(dayjs());
  const data = useApi<AttendanceMonth>(`/attendance/records?month=${month.format('YYYY-MM')}`);
  const s = data.data?.summary;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <ClockCard onChange={data.reload} />
      </Col>
      <Col xs={24} lg={16}>
        <Card
          title="Monthly record"
          extra={<DatePicker picker="month" value={month} onChange={(m) => m && setMonth(m)} allowClear={false} format="MMM YYYY" />}
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Statistic title="Days present" value={s?.daysPresent ?? 0} /></Col>
            <Col span={8}><Statistic title="Late days" value={s?.lateDays ?? 0} valueStyle={{ color: s?.lateDays ? '#d46b08' : undefined }} /></Col>
            <Col span={8}><Statistic title="Total hours" value={s?.totalHours ?? 0} precision={1} /></Col>
          </Row>
          <Table
            rowKey="id"
            size="small"
            loading={data.loading}
            dataSource={data.data?.rows}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: 'Date', render: (_, r) => dayjs(r.date).format('ddd, DD MMM') },
              { title: 'In', render: (_, r) => <Space>{r.clockInTime}{r.late && <StatusTag status="LATE" />}</Space> },
              { title: 'Out', render: (_, r) => r.clockOutTime ?? '—' },
              { title: 'Hours', render: (_, r) => r.hours ?? '—' },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

function Overtime() {
  const { message } = App.useApp();
  const requests = useApi<OvertimeRequest[]>('/attendance/overtime');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ date: Dayjs; hours: number; reason: string }>();

  const submit = async (v: { date: Dayjs; hours: number; reason: string }) => {
    try {
      await api('/attendance/overtime', { body: { ...v, date: v.date.format('YYYY-MM-DD') } });
      message.success('Overtime submitted for approval');
      setOpen(false);
      requests.reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Card
      title="My overtime"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Request overtime</Button>}
    >
      <Table
        rowKey="id"
        loading={requests.loading}
        dataSource={requests.data}
        scroll={{ x: true }}
        columns={[
          { title: 'Date', render: (_, o) => fmtDate(o.date) },
          { title: 'Hours', dataIndex: 'hours' },
          { title: 'Reason', dataIndex: 'reason' },
          { title: 'Status', render: (_, o) => <StatusTag status={o.status} /> },
          { title: 'Decided by', render: (_, o) => (o.approver ? <span title={o.approverComment ?? ''}>{o.approver}</span> : '—') },
        ]}
      />
      <Modal title="Request overtime" open={open} onCancel={() => setOpen(false)} onOk={form.submit} okText="Submit" destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submit} preserve={false} requiredMark={false}>
          <Form.Item name="date" label="Date worked" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="hours" label="Extra hours" rules={[{ required: true }]} extra="Paid at 1.5× the hourly rate once approved">
            <InputNumber min={0.5} max={12} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="What did you work on?" rules={[{ required: true, min: 3 }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function TeamView() {
  const [date, setDate] = useState(dayjs());
  const team = useApi<TeamAttendance[]>(`/attendance/team?date=${date.format('YYYY-MM-DD')}`);
  const count = (status: string) => team.data?.filter((t) => t.status === status).length ?? 0;

  return (
    <Card title="Team attendance" extra={<DatePicker value={date} onChange={(d) => d && setDate(d)} allowClear={false} format="DD MMM YYYY" />}>
      <Space size="large" style={{ marginBottom: 16 }} wrap>
        <Statistic title="Present" value={count('PRESENT')} />
        <Statistic title="Late" value={count('LATE')} />
        <Statistic title="On leave" value={count('ON_LEAVE')} />
        <Statistic title="Absent / not in" value={count('ABSENT') + count('NOT_IN')} />
      </Space>
      <Table
        rowKey={(t) => t.employee.id}
        loading={team.loading}
        dataSource={team.data}
        pagination={false}
        scroll={{ x: true }}
        columns={[
          { title: 'Employee', render: (_, t) => t.employee.name },
          { title: 'Department', render: (_, t) => t.employee.department },
          { title: 'Status', render: (_, t) => <StatusTag status={t.status} /> },
          { title: 'In', render: (_, t) => t.record?.clockInTime ?? '—' },
          { title: 'Out', render: (_, t) => t.record?.clockOutTime ?? '—' },
          { title: 'Hours', render: (_, t) => t.record?.hours ?? '—' },
        ]}
      />
    </Card>
  );
}

export default function Attendance() {
  const { hasRole } = useAuth();
  const tabs = [
    { key: 'me', label: 'My attendance', children: <MyAttendance /> },
    { key: 'ot', label: 'Overtime', children: <Overtime /> },
    ...(hasRole('MANAGER', 'HR') ? [{ key: 'team', label: 'Team', children: <TeamView /> }] : []),
  ];
  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>Attendance</Typography.Title>
      <Tabs items={tabs} destroyOnHidden />
    </>
  );
}
