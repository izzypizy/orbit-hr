import { DeleteOutlined, PaperClipOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
  App, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Popconfirm, Result, Row, Select, Space, Steps, Table, Tag, Typography, Upload,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, openFile, useApi } from '../api';
import { useAuth } from '../auth';
import { ClaimStatusTag, fmtDate, fmtMoney } from '../format';
import type { Claim, ClaimCategory, ClaimItem } from '../types';
import { DecisionButtons } from './Approvals';

interface ItemForm {
  categoryId: number;
  date: Dayjs;
  amount: number;
  description: string;
}

export default function ClaimDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const claim = useApi<Claim>(`/claims/${id}`);
  const categories = useApi<ClaimCategory[]>('/claims/categories');
  const [form] = Form.useForm<ItemForm>();

  const c = claim.data;
  if (claim.error) return <Result status="warning" title={claim.error} />;
  if (!c) return <Card loading />;

  const isOwnerDraft = c.status === 'DRAFT' && c.employee.id === user!.id;
  const run = async (fn: () => Promise<Claim | unknown>, success?: string) => {
    try {
      const updated = await fn();
      if (updated && (updated as Claim).id) claim.setData(updated as Claim);
      if (success) message.success(success);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const addItem = (v: ItemForm) =>
    run(async () => {
      const updated = await api<Claim>(`/claims/${c.id}/items`, { body: { ...v, date: v.date.format('YYYY-MM-DD') } });
      form.resetFields();
      return updated;
    });

  const upload = (item: ClaimItem, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    run(() => api<Claim>(`/claims/items/${item.id}/receipt`, { form: fd }), 'Receipt attached');
    return false; // stop antd's own upload
  };

  const step = { DRAFT: 0, PENDING_MANAGER: 1, PENDING_FINANCE: 2, APPROVED: 3, PAID: 4, REJECTED: -1 }[c.status];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Space>
          <Typography.Title level={3} style={{ margin: 0 }}>{c.title}</Typography.Title>
          <ClaimStatusTag status={c.status} />
        </Space>
        {isOwnerDraft && (
          <Space>
            <Popconfirm title="Delete this draft?" onConfirm={() => run(async () => { await api(`/claims/${c.id}`, { method: 'DELETE' }); navigate('/claims'); })}>
              <Button danger>Delete draft</Button>
            </Popconfirm>
            <Button type="primary" disabled={!c.items.length} onClick={() => run(() => api<Claim>(`/claims/${c.id}/submit`, { method: 'POST' }), 'Claim submitted')}>
              Submit for approval
            </Button>
          </Space>
        )}
        {c.employee.id !== user!.id && ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(c.status) && (
          <DecisionButtons path={`/claims/${c.id}/decision`} onDone={claim.reload} />
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        {c.status === 'REJECTED' ? (
          <Typography.Text type="danger">Rejected: {c.rejectReason}</Typography.Text>
        ) : (
          <Steps
            size="small"
            current={step}
            items={[
              { title: 'Draft' },
              { title: 'Manager', description: c.managerName && `${c.managerName}, ${fmtDate(c.managerAt)}` },
              { title: 'Finance', description: c.financeName && `${c.financeName}, ${fmtDate(c.financeAt)}` },
              { title: 'Approved' },
              { title: 'Paid', description: c.paidAt && fmtDate(c.paidAt) },
            ]}
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={isOwnerDraft ? 16 : 24}>
          <Card title="Items" extra={<Typography.Text strong>Total {fmtMoney(c.totalAmount, c.currency)}</Typography.Text>}>
            <Descriptions size="small" column={{ xs: 1, sm: 3 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Employee">{c.employee.name} ({c.employee.empNo})</Descriptions.Item>
              <Descriptions.Item label="Department">{c.employee.department}</Descriptions.Item>
              <Descriptions.Item label="Submitted">{fmtDate(c.submittedAt)}</Descriptions.Item>
            </Descriptions>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={c.items}
              scroll={{ x: true }}
              columns={[
                { title: 'Date', render: (_, i) => fmtDate(i.date) },
                { title: 'Category', render: (_, i) => i.category.name },
                { title: 'Description', dataIndex: 'description' },
                { title: 'Amount', align: 'right', render: (_, i) => fmtMoney(i.amount, c.currency) },
                {
                  title: 'Receipt',
                  render: (_, i) => (
                    <Space>
                      {i.hasReceipt ? (
                        <Button size="small" type="link" icon={<PaperClipOutlined />} onClick={() => openFile(`/claims/items/${i.id}/receipt`).catch((e) => message.error(e.message))}>
                          {i.receiptName}
                        </Button>
                      ) : i.category.requiresReceipt ? (
                        <Tag color="red">Required</Tag>
                      ) : (
                        <Typography.Text type="secondary">—</Typography.Text>
                      )}
                      {isOwnerDraft && (
                        <Upload accept="image/*,.pdf" showUploadList={false} beforeUpload={(f) => upload(i, f)}>
                          <Button size="small" icon={<UploadOutlined />}>{i.hasReceipt ? 'Replace' : 'Upload'}</Button>
                        </Upload>
                      )}
                    </Space>
                  ),
                },
                ...(isOwnerDraft
                  ? [{
                      title: '',
                      render: (_: unknown, i: ClaimItem) => (
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => run(() => api<Claim>(`/claims/items/${i.id}`, { method: 'DELETE' }))} />
                      ),
                    }]
                  : []),
              ]}
            />
          </Card>
        </Col>

        {isOwnerDraft && (
          <Col xs={24} lg={8}>
            <Card title="Add item">
              <Form form={form} layout="vertical" onFinish={addItem} requiredMark={false}>
                <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
                  <Select
                    options={categories.data?.map((cat) => ({
                      value: cat.id,
                      label: `${cat.name}${cat.limitPerItem ? ` (max ${cat.limitPerItem})` : ''}${cat.requiresReceipt ? ' · receipt' : ''}`,
                    }))}
                  />
                </Form.Item>
                <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                </Form.Item>
                <Form.Item name="amount" label="Amount (MYR)" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} precision={2} />
                </Form.Item>
                <Form.Item name="description" label="Description" rules={[{ required: true, min: 3 }]}>
                  <Input />
                </Form.Item>
                <Button htmlType="submit" icon={<PlusOutlined />} block>Add item</Button>
              </Form>
            </Card>
          </Col>
        )}
      </Row>
    </>
  );
}
