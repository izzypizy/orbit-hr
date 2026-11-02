import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, Modal, Space, Table, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useApi } from '../api';
import { ClaimStatusTag, fmtDate, fmtMoney } from '../format';
import type { Claim } from '../types';

export default function Claims() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const claims = useApi<Claim[]>('/claims');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ title: string }>();

  const create = async ({ title }: { title: string }) => {
    try {
      const claim = await api<Claim>('/claims', { body: { title } });
      navigate(`/claims/${claim.id}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>My Claims</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New claim</Button>
      </Space>

      <Card>
        <Table
          rowKey="id"
          loading={claims.loading}
          dataSource={claims.data}
          scroll={{ x: true }}
          columns={[
            { title: 'Title', render: (_, c) => <Link to={`/claims/${c.id}`}>{c.title}</Link> },
            { title: 'Items', render: (_, c) => c.items.length },
            { title: 'Amount', align: 'right', render: (_, c) => fmtMoney(c.totalAmount, c.currency) },
            { title: 'Status', render: (_, c) => <ClaimStatusTag status={c.status} /> },
            { title: 'Submitted', render: (_, c) => fmtDate(c.submittedAt) },
          ]}
        />
      </Card>

      <Modal title="New claim" open={open} onCancel={() => setOpen(false)} onOk={form.submit} okText="Create" destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={create} preserve={false} requiredMark={false}>
          <Form.Item name="title" label="Claim title" rules={[{ required: true, min: 3 }]} extra="e.g. 'Client visit – Johor, November'">
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
