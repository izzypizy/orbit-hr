import { PrinterOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Divider, Modal, Row, Table, Typography } from 'antd';
import { useState } from 'react';
import { useApi } from '../api';
import { fmtMoney, fmtPeriod } from '../format';
import type { Payslip } from '../types';

/** Payslip breakdown used by employees (Payslips) and HR/Finance (Payroll). */
export function PayslipView({ p }: { p: Payslip }) {
  const line = (label: string, amount: number, negative = false) => (
    <Row justify="space-between" style={{ padding: '4px 0' }}>
      <Col>{label}</Col>
      <Col style={{ color: negative && amount ? '#cf1322' : undefined }}>{negative && amount ? '−' : ''}{fmtMoney(amount)}</Col>
    </Row>
  );

  return (
    <div className="payslip">
      <Typography.Title level={4} style={{ marginTop: 0 }}>Payslip · {fmtPeriod(p.period)}</Typography.Title>
      <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Employee">{p.employee.name}</Descriptions.Item>
        <Descriptions.Item label="Employee ID">{p.employee.empNo}</Descriptions.Item>
        <Descriptions.Item label="Position">{p.employee.position}</Descriptions.Item>
        <Descriptions.Item label="Department">{p.employee.department}</Descriptions.Item>
      </Descriptions>
      <Row gutter={32}>
        <Col xs={24} md={12}>
          <Divider orientation="left" plain>Earnings</Divider>
          {line('Basic salary', p.basic)}
          {line('Fixed allowance', p.allowance)}
          {line(`Overtime (${p.overtimeHours} h)`, p.overtimePay)}
          {p.bonus > 0 && line('Performance bonus', p.bonus)}
          {line(`Unpaid leave (${p.unpaidLeaveDays} d)`, p.unpaidLeaveDeduction, true)}
          <Divider style={{ margin: '8px 0' }} />
          <Row justify="space-between"><Col><b>Gross pay</b></Col><Col><b>{fmtMoney(p.grossPay)}</b></Col></Row>
        </Col>
        <Col xs={24} md={12}>
          <Divider orientation="left" plain>Deductions</Divider>
          {line(`EPF (employee 11%${p.bonus > 0 ? ', incl. bonus' : ''})`, p.epfEmployee, true)}
          {line('SOCSO', p.socso, true)}
          {line('EIS', p.eis, true)}
          <Divider orientation="left" plain>Reimbursements</Divider>
          {line('Approved claims', p.claimsReimbursed)}
        </Col>
      </Row>
      <Card size="small" style={{ marginTop: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
        <Row justify="space-between" align="middle">
          <Col><Typography.Text strong>Net pay</Typography.Text></Col>
          <Col><Typography.Title level={3} style={{ margin: 0 }}>{fmtMoney(p.netPay)}</Typography.Title></Col>
        </Row>
      </Card>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        Employer EPF contribution: {fmtMoney(p.epfEmployer)}. Demo figures with simplified statutory rates; PCB (income tax) is not calculated.
      </Typography.Paragraph>
    </div>
  );
}

export function PayslipModal({ payslip, onClose }: { payslip: Payslip | null; onClose: () => void }) {
  return (
    <Modal
      open={!!payslip}
      onCancel={onClose}
      width={760}
      footer={[
        <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>,
        <Button key="close" type="primary" onClick={onClose}>Close</Button>,
      ]}
    >
      {payslip && <PayslipView p={payslip} />}
    </Modal>
  );
}

export default function Payslips() {
  const payslips = useApi<Payslip[]>('/payroll/payslips');
  const [open, setOpen] = useState<Payslip | null>(null);

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>Payslips</Typography.Title>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Payslips appear here once HR or Finance publish the month's payroll." />
      <Card>
        <Table
          rowKey="id"
          loading={payslips.loading}
          dataSource={payslips.data}
          scroll={{ x: true }}
          onRow={(p) => ({ onClick: () => setOpen(p), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Month', render: (_, p) => fmtPeriod(p.period) },
            { title: 'Gross pay', align: 'right', render: (_, p) => fmtMoney(p.grossPay) },
            { title: 'Deductions', align: 'right', render: (_, p) => fmtMoney(p.epfEmployee + p.socso + p.eis) },
            { title: 'Claims', align: 'right', render: (_, p) => fmtMoney(p.claimsReimbursed) },
            { title: 'Net pay', align: 'right', render: (_, p) => <b>{fmtMoney(p.netPay)}</b> },
            { title: '', render: () => <Button size="small" type="link">View</Button> },
          ]}
        />
      </Card>
      <PayslipModal payslip={open} onClose={() => setOpen(null)} />
    </>
  );
}
