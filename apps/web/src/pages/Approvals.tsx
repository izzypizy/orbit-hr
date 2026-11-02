import { App, Badge, Button, Card, Input, Modal, Popconfirm, Space, Table, Tabs, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { ClaimStatusTag, fmtDate, fmtMoney, fmtRange } from '../format';
import type { Claim, LeaveRequest, OvertimeRequest } from '../types';

/** Approve / Reject buttons; rejecting asks for a reason. */
export function DecisionButtons({ path, onDone }: { path: string; onDone: () => void }) {
  const { message } = App.useApp();
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');

  const decide = async (approve: boolean) => {
    try {
      await api(path, { body: { approve, comment: comment || undefined } });
      message.success(approve ? 'Approved' : 'Rejected');
      setRejecting(false);
      setComment('');
      onDone();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <>
      <Space>
        <Button size="small" type="primary" onClick={() => decide(true)}>Approve</Button>
        <Button size="small" danger onClick={() => setRejecting(true)}>Reject</Button>
      </Space>
      <Modal title="Reject" open={rejecting} onCancel={() => setRejecting(false)} onOk={() => decide(false)} okText="Reject" okButtonProps={{ danger: true, disabled: !comment.trim() }}>
        <Input.TextArea rows={3} placeholder="Reason (shown to the employee)" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>
    </>
  );
}

export default function Approvals() {
  const { hasRole } = useAuth();
  const { message } = App.useApp();
  const canLeave = hasRole('MANAGER', 'HR');
  const isFinance = hasRole('FINANCE');

  const leave = useApi<LeaveRequest[]>(canLeave ? '/leave/approvals' : null);
  const claims = useApi<Claim[]>('/claims/approvals');
  const payable = useApi<Claim[]>(isFinance ? '/claims/payable' : null);
  const overtime = useApi<OvertimeRequest[]>(canLeave ? '/attendance/overtime/approvals' : null);

  const pay = async (id: number) => {
    try {
      await api(`/claims/${id}/pay`, { method: 'POST' });
      message.success('Marked as paid');
      payable.reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const claimColumns = [
    { title: 'Employee', render: (_: unknown, c: Claim) => c.employee.name },
    { title: 'Title', render: (_: unknown, c: Claim) => <Link to={`/claims/${c.id}`}>{c.title}</Link> },
    { title: 'Items', render: (_: unknown, c: Claim) => c.items.length },
    { title: 'Amount', align: 'right' as const, render: (_: unknown, c: Claim) => fmtMoney(c.totalAmount, c.currency) },
    { title: 'Status', render: (_: unknown, c: Claim) => <ClaimStatusTag status={c.status} /> },
    { title: 'Submitted', render: (_: unknown, c: Claim) => fmtDate(c.submittedAt) },
  ];

  const tabs = [
    canLeave && {
      key: 'leave',
      label: <Badge count={leave.data?.length} offset={[10, 0]}>Leave</Badge>,
      children: (
        <Table
          rowKey="id"
          loading={leave.loading}
          dataSource={leave.data}
          scroll={{ x: true }}
          locale={{ emptyText: 'Nothing to approve' }}
          columns={[
            { title: 'Employee', render: (_, r) => r.employee.name },
            { title: 'Type', render: (_, r) => r.leaveType.name },
            { title: 'Dates', render: (_, r) => fmtRange(r.startDate, r.endDate) },
            { title: 'Days', dataIndex: 'days' },
            { title: 'Reason', dataIndex: 'reason', ellipsis: true },
            { title: 'Applied', render: (_, r) => fmtDate(r.createdAt) },
            { title: '', render: (_, r) => <DecisionButtons path={`/leave/requests/${r.id}/decision`} onDone={leave.reload} /> },
          ]}
        />
      ),
    },
    canLeave && {
      key: 'overtime',
      label: <Badge count={overtime.data?.length} offset={[10, 0]}>Overtime</Badge>,
      children: (
        <Table
          rowKey="id"
          loading={overtime.loading}
          dataSource={overtime.data}
          scroll={{ x: true }}
          locale={{ emptyText: 'Nothing to approve' }}
          columns={[
            { title: 'Employee', render: (_, o) => o.employee.name },
            { title: 'Date', render: (_, o) => fmtDate(o.date) },
            { title: 'Hours', dataIndex: 'hours' },
            { title: 'Reason', dataIndex: 'reason', ellipsis: true },
            { title: '', render: (_, o) => <DecisionButtons path={`/attendance/overtime/${o.id}/decision`} onDone={overtime.reload} /> },
          ]}
        />
      ),
    },
    {
      key: 'claims',
      label: <Badge count={claims.data?.length} offset={[10, 0]}>Claims</Badge>,
      children: (
        <Table
          rowKey="id"
          loading={claims.loading}
          dataSource={claims.data}
          scroll={{ x: true }}
          locale={{ emptyText: 'Nothing to approve' }}
          columns={[...claimColumns, { title: '', render: (_: unknown, c: Claim) => <DecisionButtons path={`/claims/${c.id}/decision`} onDone={claims.reload} /> }]}
        />
      ),
    },
    isFinance && {
      key: 'payable',
      label: <Badge count={payable.data?.length} offset={[10, 0]} color="blue">To pay</Badge>,
      children: (
        <Table
          rowKey="id"
          loading={payable.loading}
          dataSource={payable.data}
          scroll={{ x: true }}
          locale={{ emptyText: 'No approved claims waiting for payment' }}
          columns={[
            ...claimColumns,
            {
              title: '',
              render: (_: unknown, c: Claim) => (
                <Popconfirm title={`Mark ${fmtMoney(c.totalAmount)} as paid?`} onConfirm={() => pay(c.id)}>
                  <Button size="small" type="primary">Mark paid</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      ),
    },
  ].filter(Boolean) as { key: string; label: JSX.Element; children: JSX.Element }[];

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>Approvals</Typography.Title>
      <Card>
        <Tabs items={tabs} />
      </Card>
    </>
  );
}
