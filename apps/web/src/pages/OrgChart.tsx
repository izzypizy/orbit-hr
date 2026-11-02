import { Avatar, Card, Space, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useApi } from '../api';
import type { DirectoryEntry } from '../types';

function buildTree(people: DirectoryEntry[], managerId: number | null): DataNode[] {
  return people
    .filter((p) => p.managerId === managerId)
    .map((p) => ({
      key: p.id,
      title: (
        <Space style={{ padding: '4px 0' }}>
          <Avatar size="small" style={{ background: '#1f6feb' }}>{p.name.charAt(0)}</Avatar>
          <span>
            <Typography.Text strong>{p.name}</Typography.Text>
            <Typography.Text type="secondary"> · {p.position} · {p.department}</Typography.Text>
          </span>
        </Space>
      ),
      children: buildTree(people, p.id),
    }));
}

export default function OrgChart() {
  const directory = useApi<DirectoryEntry[]>('/employees/directory');

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>Org Chart</Typography.Title>
      <Card loading={directory.loading}>
        {directory.data && (
          <Tree treeData={buildTree(directory.data, null)} defaultExpandAll showLine selectable={false} blockNode />
        )}
      </Card>
    </>
  );
}
