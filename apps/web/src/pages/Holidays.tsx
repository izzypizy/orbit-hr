import { DeleteOutlined } from '@ant-design/icons';
import { App, Button, Card, DatePicker, Form, Input, Popconfirm, Select, Space, Table, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import type { Holiday } from '../types';

export default function Holidays() {
  const { hasRole } = useAuth();
  const { message } = App.useApp();
  const [year, setYear] = useState(dayjs().year());
  const holidays = useApi<Holiday[]>(`/holidays?year=${year}`);
  const [form] = Form.useForm<{ date: Dayjs; name: string }>();
  const isHr = hasRole('HR');

  const add = async (v: { date: Dayjs; name: string }) => {
    try {
      await api('/holidays', { body: { date: v.date.format('YYYY-MM-DD'), name: v.name } });
      form.resetFields();
      holidays.reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    await api(`/holidays/${id}`, { method: 'DELETE' });
    holidays.reload();
  };

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Public Holidays</Typography.Title>
        <Select value={year} onChange={setYear} options={[year - 1, year, year + 1].map((y) => ({ value: y, label: y }))} style={{ width: 100 }} />
      </Space>

      {isHr && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Form form={form} layout="inline" onFinish={add} style={{ rowGap: 8 }}>
            <Form.Item name="date" rules={[{ required: true, message: 'Date required' }]}>
              <DatePicker format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="name" rules={[{ required: true, message: 'Name required' }]}>
              <Input placeholder="Holiday name" />
            </Form.Item>
            <Button type="primary" htmlType="submit">Add holiday</Button>
          </Form>
        </Card>
      )}

      <Card>
        <Table
          rowKey="id"
          loading={holidays.loading}
          dataSource={holidays.data}
          pagination={false}
          columns={[
            { title: 'Date', render: (_, h) => dayjs(h.date).format('DD MMM YYYY') },
            { title: 'Day', render: (_, h) => dayjs(h.date).format('dddd') },
            { title: 'Holiday', dataIndex: 'name' },
            ...(isHr
              ? [{
                  title: '',
                  render: (_: unknown, h: Holiday) => (
                    <Popconfirm title="Remove this holiday?" onConfirm={() => remove(h.id)}>
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                }]
              : []),
          ]}
        />
      </Card>
    </>
  );
}
