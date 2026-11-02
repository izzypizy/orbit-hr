import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { fmtDate } from '../format';
import type { Department, Employee, Role } from '../types';

interface NewEmployee {
  name: string;
  email: string;
  role: Role;
  position: string;
  departmentId: number;
  managerId: number | null;
  joinDate: Dayjs;
  basicSalary: number;
}

export default function Employees() {
  const { hasRole } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const isHr = hasRole('HR');
  const employees = useApi<Employee[]>('/employees');
  const departments = useApi<Department[]>(isHr ? '/employees/departments' : null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<NewEmployee>();

  const q = search.toLowerCase();
  const rows = employees.data?.filter((e) => [e.name, e.empNo, e.email, e.department, e.position].some((v) => v.toLowerCase().includes(q)));

  const create = async (v: NewEmployee) => {
    try {
      const e = await api<Employee>('/employees', { body: { ...v, managerId: v.managerId ?? null, joinDate: v.joinDate.format('YYYY-MM-DD') } });
      message.success(`${e.name} added (${e.empNo}). Onboarding checklist started.`);
      setOpen(false);
      employees.reload();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const offboard = async (e: Employee) => {
    try {
      await api('/checklists', { body: { employeeId: e.id, type: 'OFFBOARDING' } });
      navigate('/onboarding');
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{isHr ? 'Employees' : 'My Team'}</Typography.Title>
        {isHr && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Add employee</Button>}
      </Space>
      <Card>
        <Input.Search placeholder="Search name, ID, department…" allowClear onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 16 }} />
        <Table
          rowKey="id"
          loading={employees.loading}
          dataSource={rows}
          scroll={{ x: true }}
          columns={[
            { title: 'ID', dataIndex: 'empNo' },
            { title: 'Name', dataIndex: 'name' },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Phone', render: (_, e) => e.phone || '—' },
            { title: 'Department', dataIndex: 'department' },
            { title: 'Position', dataIndex: 'position' },
            { title: 'Reports to', render: (_, e) => e.manager ?? '—' },
            { title: 'Role', render: (_, e) => <Tag>{e.role}</Tag> },
            { title: 'Joined', render: (_, e) => fmtDate(e.joinDate) },
            ...(isHr ? [{
              title: '',
              render: (_: unknown, e: Employee) => (
                <Popconfirm title={`Start offboarding for ${e.name}?`} onConfirm={() => offboard(e)}>
                  <Button size="small">Offboard</Button>
                </Popconfirm>
              ),
            }] : []),
          ]}
        />
      </Card>

      <Modal title="Add employee" open={open} onCancel={() => setOpen(false)} onOk={form.submit} okText="Add" width={640} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={create} preserve={false} requiredMark={false} initialValues={{ role: 'EMPLOYEE', joinDate: dayjs() }}>
          <Row gutter={12}>
            <Col xs={24} sm={12}><Form.Item name="name" label="Full name" rules={[{ required: true, min: 2 }]}><Input /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="email" label="Work email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="position" label="Position" rules={[{ required: true, min: 2 }]}><Input /></Form.Item></Col>
            <Col xs={24} sm={12}>
              <Form.Item name="departmentId" label="Department" rules={[{ required: true }]}>
                <Select options={departments.data?.map((d) => ({ value: d.id, label: d.name }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="managerId" label="Reports to">
                <Select allowClear showSearch optionFilterProp="label" options={employees.data?.map((e) => ({ value: e.id, label: `${e.name} · ${e.position}` }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="role" label="System role">
                <Select options={[
                  { value: 'EMPLOYEE', label: 'Employee' },
                  { value: 'MANAGER', label: 'Manager' },
                  { value: 'HR', label: 'HR Admin' },
                  { value: 'FINANCE', label: 'Finance' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}><Form.Item name="joinDate" label="Join date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item></Col>
            <Col xs={24} sm={12}>
              <Form.Item name="basicSalary" label="Basic salary (MYR / month)" rules={[{ required: true }]}>
                <InputNumber min={1} step={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text type="secondary">The new employee signs in with the demo password from the README.</Typography.Text>
        </Form>
      </Modal>
    </>
  );
}
