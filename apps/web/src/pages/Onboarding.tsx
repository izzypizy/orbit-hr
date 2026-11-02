import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Col, Empty, Form, List, Modal, Progress, Row, Select, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { fmtDate } from '../format';
import type { Checklist, Employee, TaskOwner } from '../types';

const OWNER_COLOR: Record<TaskOwner, string> = { HR: 'purple', MANAGER: 'blue', EMPLOYEE: 'green', FINANCE: 'orange' };

function ChecklistCard({ c, onChange }: { c: Checklist; onChange: (c: Checklist) => void }) {
  const { message } = App.useApp();

  const toggle = async (taskId: number, done: boolean) => {
    try {
      onChange(await api<Checklist>(`/checklists/${c.id}/tasks/${taskId}`, { body: { done } }));
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Card
      title={<Space>{c.employee.name}<Tag color={c.type === 'ONBOARDING' ? 'green' : 'volcano'}>{c.type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'}</Tag></Space>}
      extra={<Typography.Text type="secondary">{c.employee.position} · started {fmtDate(c.createdAt)}</Typography.Text>}
    >
      <Progress percent={c.progress} status={c.progress === 100 ? 'success' : 'active'} />
      <List
        size="small"
        dataSource={c.tasks}
        renderItem={(t) => (
          <List.Item extra={<Tag color={OWNER_COLOR[t.owner]}>{t.owner.charAt(0) + t.owner.slice(1).toLowerCase()}</Tag>}>
            <Checkbox checked={t.done} disabled={!t.canComplete} onChange={(e) => toggle(t.id, e.target.checked)}>
              <span style={{ textDecoration: t.done ? 'line-through' : undefined }}>{t.title}</span>
              {t.done && <Typography.Text type="secondary" style={{ fontSize: 12 }}> · {t.doneByName}, {fmtDate(t.doneAt)}</Typography.Text>}
            </Checkbox>
          </List.Item>
        )}
      />
    </Card>
  );
}

export default function Onboarding() {
  const { hasRole } = useAuth();
  const { message } = App.useApp();
  const checklists = useApi<Checklist[]>('/checklists');
  const employees = useApi<Employee[]>(hasRole('HR') ? '/employees' : null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ employeeId: number; type: Checklist['type'] }>();

  const create = async (v: { employeeId: number; type: Checklist['type'] }) => {
    try {
      await api('/checklists', { body: v });
      message.success('Checklist started');
      setOpen(false);
      checklists.reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const replace = (updated: Checklist) => checklists.setData(checklists.data?.map((c) => (c.id === updated.id ? updated : c)));
  const active = checklists.data?.filter((c) => c.progress < 100) ?? [];
  const done = checklists.data?.filter((c) => c.progress === 100) ?? [];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{hasRole('EMPLOYEE') ? 'My Onboarding' : 'Onboarding & Offboarding'}</Typography.Title>
        {hasRole('HR') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Start checklist</Button>}
      </Space>

      {!checklists.loading && !checklists.data?.length && <Card><Empty description="No checklists" /></Card>}
      <Row gutter={[16, 16]}>
        {[...active, ...done].map((c) => (
          <Col xs={24} lg={12} key={c.id}><ChecklistCard c={c} onChange={replace} /></Col>
        ))}
      </Row>

      <Modal title="Start checklist" open={open} onCancel={() => setOpen(false)} onOk={form.submit} okText="Start" destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={create} preserve={false} requiredMark={false} initialValues={{ type: 'ONBOARDING' }}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={employees.data?.map((e) => ({ value: e.id, label: `${e.name} (${e.empNo})` }))} />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Select options={[{ value: 'ONBOARDING', label: 'Onboarding' }, { value: 'OFFBOARDING', label: 'Offboarding' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
