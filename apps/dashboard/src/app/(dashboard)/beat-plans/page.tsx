'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { PlusCircle, Eye, Map } from 'lucide-react';
import { formatDate } from '@salestrack/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EmptyState from '@/components/empty-state';
import type { BeatPlan, BeatPlanStatus } from '@salestrack/types';

const statusVariant: Record<BeatPlanStatus, 'secondary' | 'default' | 'outline'> = {
  draft: 'secondary',
  active: 'default',
  completed: 'outline',
};

export default function BeatPlansPage() {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  const { data: beatPlans = [], isLoading } = useQuery({
    queryKey: ['beat-plans', dateFilter, agentFilter],
    queryFn: () =>
      api.beatPlans.list({
        ...(dateFilter && { date: dateFilter }),
        ...(agentFilter && agentFilter !== 'all' && { agent_id: agentFilter }),
      }),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['users-agents'],
    queryFn: () => api.auth.users({ role: 'agent' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Beat Plans</h1>
        <Button onClick={() => router.push('/beat-plans/new')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Beat Plan
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-44"
          max={format(new Date(), 'yyyy-MM-dd')}
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

      {!isLoading && beatPlans.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No beat plans yet"
          description="Create your first beat plan to assign routes to agents"
          action={{ label: 'New Beat Plan', href: '/beat-plans/new' }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {beatPlans.map((plan: BeatPlan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {agents.find((a) => a.id === plan.assigned_agent_id)?.full_name ??
                    '—'}
                </TableCell>
                <TableCell>{formatDate(plan.plan_date)}</TableCell>
                <TableCell>
                  <Badge
                    variant={statusVariant[plan.status]}
                    className={
                      plan.status === 'completed'
                        ? 'text-green-600 border-green-600'
                        : ''
                    }
                  >
                    {plan.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/beat-plans/${plan.id}`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
