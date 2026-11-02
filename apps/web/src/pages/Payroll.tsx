import { App, Button, Card, DatePicker, Popconfirm, Space, Table, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api, useApi } from '../api';
import { StatusTag, fmtMoney, fmtPeriod } from '../format';
import type { Payslip, PayrollRun } from '../types';
import { PayslipModal } from './Payslips';

export default function Payroll() {
  const { message } = App.useApp();
  const runs = useApi<PayrollRun[]>('/payroll/runs');
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [selected, setSelected] = useState<string>();
  const slips = useApi<Payslip[]>(selected ? `/payroll/runs/${selected}` : null);
  const [open, setOpen] = useState<Payslip | null>(null);

  const action = async (path: 'run' | 'publish', period: string) => {
    try {
      await api(`/payroll/${path}`, { body: { period } });
      message.success(path === 'run' ? `Payroll calculated for ${fmtPeriod(period)}` : `${fmtPeriod(period)} published to employees`);
      runs.reload();
      setSelected(period);
      slips.reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>Payroll</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Typography.Text>Run payroll for</Typography.Text>
          <DatePicker picker="month" value={month} onChange={(m) => m && setMonth(m)} allowClear={false} format="MMM YYYY" />
          <Button type="primary" onClick={() => action('run', month.format('YYYY-MM'))}>Calculate</Button>
          <Typography.Text type="secondary">
            Includes approved overtime, approved unpaid leave and claims paid in that month. Re-run any time until published.
          </Typography.Text>
        </Space>
      </Card>

      <Card title="Payroll runs" style={{ marginBottom: 16 }}>
        <Table
          rowKey="period"
          loading={runs.loading}
          dataSource={runs.data}
          pagination={false}
          scroll={{ x: true }}
          rowClassName={(r) => (r.period === selected ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({ onClick: () => setSelected(r.period), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Month', render: (_, r) => fmtPeriod(r.period) },
            { title: 'Status', render: (_, r) => <StatusTag status={r.status} /> },
            { title: 'Employees', dataIndex: 'employees' },
            { title: 'Gross', align: 'right', render: (_, r) => fmtMoney(r.grossPay) },
            { title: 'Net', align: 'right', render: (_, r) => fmtMoney(r.netPay) },
            { title: 'Employer EPF', align: 'right', render: (_, r) => fmtMoney(r.epfEmployer) },
            {
              title: '',
              render: (_, r) => r.status === 'DRAFT' && (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Button size="small" onClick={() => action('run', r.period)}>Recalculate</Button>
                  <Popconfirm title={`Publish ${fmtPeriod(r.period)}? Employees will see their payslips and it can't be recalculated.`} onConfirm={() => action('publish', r.period)}>
                    <Button size="small" type="primary">Publish</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {selected && (
        <Card title={`Payslips · ${fmtPeriod(selected)}`}>
          <Table
            rowKey="id"
            loading={slips.loading}
            dataSource={slips.data}
            pagination={false}
            scroll={{ x: true }}
            onRow={(p) => ({ onClick: () => setOpen(p), style: { cursor: 'pointer' } })}
            columns={[
              { title: 'Employee', render: (_, p) => p.employee.name },
              { title: 'Basic', align: 'right', render: (_, p) => fmtMoney(p.basic) },
              { title: 'Overtime', align: 'right', render: (_, p) => fmtMoney(p.overtimePay) },
              { title: 'Unpaid leave', align: 'right', render: (_, p) => fmtMoney(p.unpaidLeaveDeduction) },
              { title: 'Gross', align: 'right', render: (_, p) => fmtMoney(p.grossPay) },
              { title: 'EPF/SOCSO/EIS', align: 'right', render: (_, p) => fmtMoney(p.epfEmployee + p.socso + p.eis) },
              { title: 'Claims', align: 'right', render: (_, p) => fmtMoney(p.claimsReimbursed) },
              { title: 'Net', align: 'right', render: (_, p) => <b>{fmtMoney(p.netPay)}</b> },
            ]}
          />
        </Card>
      )}
      <PayslipModal payslip={open} onClose={() => setOpen(null)} />
    </>
  );
}
