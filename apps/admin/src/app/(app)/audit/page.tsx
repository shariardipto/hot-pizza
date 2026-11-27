'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Loading, PageHeader, Pagination, Table } from '@/components/ui';
import { get, qs } from '@/lib/api';
import { dateTime } from '@/lib/utils';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['audit', page],
    queryFn: () => get<{ items: { id: string; action: string; entityType: string; entityId: string | null; actorEmail: string | null; ipAddress: string | null; createdAt: string; data: unknown }[]; total: number; page: number; pageSize: number }>(`/audit${qs({ page })}`),
  });
  return (
    <>
      <PageHeader title="Audit log" description="Every change made in this dashboard, who made it and when." />
      <Card bodyClassName="p-0">
        {isLoading || !data ? (
          <Loading />
        ) : (
          <>
            <Table head={['When', 'Who', 'Action', 'Target', 'Details']} empty={!data.items.length}>
              {data.items.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-zinc-600">{dateTime(a.createdAt)}</td>
                  <td className="px-4 py-2.5">{a.actorEmail ?? 'system'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                    {a.entityType}
                    {a.entityId ? ` · ${a.entityId.slice(0, 12)}` : ''}
                  </td>
                  <td className="max-w-md truncate px-4 py-2.5 font-mono text-xs text-zinc-500">{a.data ? JSON.stringify(a.data) : ''}</td>
                </tr>
              ))}
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
