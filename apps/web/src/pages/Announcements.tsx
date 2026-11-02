import { DeleteOutlined, PushpinFilled } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Empty, Form, Input, List, Popconfirm, Space, Typography } from 'antd';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { fmtDate } from '../format';
import type { Announcement } from '../types';

export default function Announcements() {
  const { hasRole } = useAuth();
  const { message } = App.useApp();
  const announcements = useApi<Announcement[]>('/announcements');
  const [form] = Form.useForm<{ title: string; body: string; pinned: boolean }>();
  const isHr = hasRole('HR');

  const post = async (values: { title: string; body: string; pinned: boolean }) => {
    try {
      await api('/announcements', { body: { ...values, pinned: !!values.pinned } });
      form.resetFields();
      message.success('Announcement posted');
      announcements.reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    await api(`/announcements/${id}`, { method: 'DELETE' });
    announcements.reload();
  };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>Announcements</Typography.Title>

      {isHr && (
        <Card title="Post an announcement" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" onFinish={post} requiredMark={false}>
            <Form.Item name="title" label="Title" rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
            <Form.Item name="body" label="Message" rules={[{ required: true, min: 3 }]}><Input.TextArea rows={3} /></Form.Item>
            <Space>
              <Form.Item name="pinned" valuePropName="checked" noStyle><Checkbox>Pin to top</Checkbox></Form.Item>
              <Button type="primary" htmlType="submit">Post</Button>
            </Space>
          </Form>
        </Card>
      )}

      <Card>
        <List
          loading={announcements.loading}
          dataSource={announcements.data}
          locale={{ emptyText: <Empty description="No announcements" /> }}
          renderItem={(a) => (
            <List.Item
              actions={isHr ? [
                <Popconfirm key="del" title="Delete this announcement?" onConfirm={() => remove(a.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ] : []}
            >
              <List.Item.Meta
                title={<Space>{a.pinned && <PushpinFilled style={{ color: '#1f6feb' }} />}{a.title}</Space>}
                description={`${a.author} · ${fmtDate(a.createdAt)}`}
              />
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{a.body}</Typography.Paragraph>
            </List.Item>
          )}
        />
      </Card>
    </>
  );
}
