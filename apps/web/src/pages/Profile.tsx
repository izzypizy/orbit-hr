import { App, Button, Card, Col, Descriptions, Divider, Form, Input, Row, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api, useApi } from '../api';
import { fmtDate } from '../format';
import type { Employee } from '../types';

type ProfileForm = Pick<Employee, 'phone' | 'address' | 'emergencyContactName' | 'emergencyContactRelation' | 'emergencyContactPhone'>;

export default function Profile() {
  const { message } = App.useApp();
  const me = useApi<Employee>('/auth/me');
  const [form] = Form.useForm<ProfileForm>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me.data) form.setFieldsValue(me.data);
  }, [me.data, form]);

  const save = async (values: ProfileForm) => {
    setSaving(true);
    try {
      me.setData(await api<Employee>('/employees/me', { method: 'PATCH', body: values }));
      message.success('Profile updated');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const e = me.data;
  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>My Profile</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="Employment" loading={me.loading}>
            {e && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Name">{e.name}</Descriptions.Item>
                <Descriptions.Item label="Employee ID">{e.empNo}</Descriptions.Item>
                <Descriptions.Item label="Email">{e.email}</Descriptions.Item>
                <Descriptions.Item label="Position">{e.position}</Descriptions.Item>
                <Descriptions.Item label="Department">{e.department}</Descriptions.Item>
                <Descriptions.Item label="Reports to">{e.manager ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Joined">{fmtDate(e.joinDate)}</Descriptions.Item>
              </Descriptions>
            )}
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 12 }}>
              Contact HR to change employment details.
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="Contact details" loading={me.loading}>
            <Form form={form} layout="vertical" onFinish={save}>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Mobile number"><Input /></Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="address" label="Home address"><Input.TextArea rows={2} /></Form.Item>
                </Col>
              </Row>
              <Divider orientation="left" plain>Emergency contact</Divider>
              <Row gutter={12}>
                <Col xs={24} sm={10}>
                  <Form.Item name="emergencyContactName" label="Name"><Input /></Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item name="emergencyContactRelation" label="Relationship"><Input placeholder="e.g. Spouse" /></Form.Item>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Item name="emergencyContactPhone" label="Phone"><Input /></Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" loading={saving}>Save changes</Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </>
  );
}
