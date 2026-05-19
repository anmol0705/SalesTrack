'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@salestrack/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AgentActivity } from '@/lib/api';

function MetricCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: api.analytics.dashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Visits Today"
          value={`${data?.visits_completed ?? 0} / ${data?.visits_planned ?? 0}`}
          sub="completed of planned"
        />
        <MetricCard
          title="Orders Value"
          value={formatCurrency(data?.orders_value_today ?? 0)}
        />
        <MetricCard
          title="Collections"
          value={formatCurrency(data?.collections_today ?? 0)}
        />
        <MetricCard
          title="Active Agents"
          value={String(data?.active_agents_count ?? 0)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Activity Today</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data?.agents && data.agents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Visits Done</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agents.map((a: AgentActivity) => (
                  <TableRow key={a.agent_id}>
                    <TableCell className="font-medium">{a.agent_name}</TableCell>
                    <TableCell className="text-right">{a.visits_done}</TableCell>
                    <TableCell className="text-right">{a.orders_count}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(a.collections)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={a.status === 'active' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No agent activity today yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
