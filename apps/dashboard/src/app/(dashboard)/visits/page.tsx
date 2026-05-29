'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInMinutes } from 'date-fns';
import { MapPin } from 'lucide-react';
import { formatTime } from '@salestrack/utils';
import { api, type VisitWithRelations } from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EmptyState from '@/components/empty-state';
import type { VisitOutcome } from '@salestrack/types';

const outcomeBadge: Record<VisitOutcome, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  visited: { variant: 'default', label: 'Visited' },
  not_available: { variant: 'secondary', label: 'Not available' },
  refused: { variant: 'destructive', label: 'Refused' },
  pending: { variant: 'outline', label: 'Pending' },
};

function DurationCell({ visit }: { visit: VisitWithRelations }) {
  if (visit.check_out_time) {
    const mins = differenceInMinutes(
      new Date(visit.check_out_time),
      new Date(visit.check_in_time),
    );
    return <span>{mins} min</span>;
  }
  if (visit.outcome === 'pending') {
    return (
      <span className="flex items-center gap-1.5">
        <span className="animate-pulse inline-block h-2 w-2 rounded-full bg-green-500" />
        In progress
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

export default function VisitsPage() {
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [agentFilter, setAgentFilter] = useState('');

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['visits', dateFilter, agentFilter],
    queryFn: () =>
      api.visits.list({
        date: dateFilter,
        ...(agentFilter && agentFilter !== 'all' ? { agent_id: agentFilter } : {}),
      }),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['users-agents'],
    queryFn: () => api.auth.users({ role: 'agent' }),
  });

  const completed = visits.filter((v) => v.outcome === 'visited').length;
  const pending = visits.filter((v) => v.outcome === 'pending').length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Visits</h1>

      <div className="flex gap-3">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-44"
        />
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total visits</p>
            <p className="text-2xl font-bold mt-1">{visits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold mt-1">{pending}</p>
          </CardContent>
        </Card>
      </div>

      {!isLoading && visits.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No visits recorded"
          description="Visits appear here once agents check in on their beat plans"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Retailer</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.map((visit: VisitWithRelations) => {
              const { variant, label } = outcomeBadge[visit.outcome];
              return (
                <TableRow key={visit.id}>
                  <TableCell className="font-medium">{visit.agent.full_name}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{visit.retailer.name}</p>
                      <p className="text-xs text-muted-foreground">{visit.retailer.area}</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatTime(visit.check_in_time)}</TableCell>
                  <TableCell>
                    {visit.check_out_time
                      ? formatTime(visit.check_out_time)
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={variant}>{label}</Badge>
                  </TableCell>
                  <TableCell>
                    <DurationCell visit={visit} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {visit.notes ?? '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
