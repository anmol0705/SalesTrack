'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusCircle, Eye, Map, MoreHorizontal } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const queryClient = useQueryClient();
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

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.beatPlans.updateStatus(id, status);
      await queryClient.invalidateQueries({ queryKey: ['beat-plans'] });
      toast.success(`Beat plan set to ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

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
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {beatPlans.map((plan: BeatPlan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {agents.find((a) => a.id === plan.assigned_agent_id)?.full_name ?? '—'}
                </TableCell>
                <TableCell>{formatDate(plan.plan_date)}</TableCell>
                <TableCell>
                  <Badge
                    variant={statusVariant[plan.status]}
                    className={
                      plan.status === 'completed' ? 'text-green-600 border-green-600' : ''
                    }
                  >
                    {plan.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/beat-plans/${plan.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(plan.id, 'active')}
                          disabled={plan.status === 'active'}
                        >
                          Set Active
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(plan.id, 'completed')}
                          disabled={plan.status === 'completed'}
                        >
                          Mark Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(plan.id, 'draft')}
                          disabled={plan.status === 'draft'}
                        >
                          Revert to Draft
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
