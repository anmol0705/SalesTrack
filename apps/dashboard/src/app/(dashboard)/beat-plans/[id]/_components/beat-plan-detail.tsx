'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, MoreHorizontal, RefreshCw } from 'lucide-react';
import { formatDate } from '@salestrack/utils';
import { api, type BeatPlanStop } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { BeatPlanStatus } from '@salestrack/types';
import { formatCurrency } from '@salestrack/utils';

const statusVariant: Record<BeatPlanStatus, 'secondary' | 'default' | 'outline'> = {
  draft: 'secondary',
  active: 'default',
  completed: 'outline',
};

export default function BeatPlanDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: plan, isLoading, refetch } = useQuery({
    queryKey: ['beat-plan', id],
    queryFn: () => api.beatPlans.get(id),
  });

  const handleStatusChange = async (status: string) => {
    try {
      await api.beatPlans.updateStatus(id, status);
      await queryClient.invalidateQueries({ queryKey: ['beat-plan', id] });
      await queryClient.invalidateQueries({ queryKey: ['beat-plans'] });
      toast.success(`Beat plan set to ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  if (isLoading || !plan) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const stops = plan.beat_plan_retailers ?? [];
  const visitedCount = stops.filter((s) => s.is_visited).length;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/beat-plans')}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Beat Plans
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{plan.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={statusVariant[plan.status]}
            className={
              plan.status === 'completed' ? 'text-green-600 border-green-600' : ''
            }
          >
            {plan.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <MoreHorizontal className="h-4 w-4" />
                Change Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleStatusChange('active')}
                disabled={plan.status === 'active'}
              >
                Set Active
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange('completed')}
                disabled={plan.status === 'completed'}
              >
                Mark Completed
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange('draft')}
                disabled={plan.status === 'draft'}
              >
                Revert to Draft
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {plan.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Assigned Agent</p>
            <p className="text-base font-semibold mt-1">
              {plan.assigned_agent?.full_name ?? '—'}
            </p>
            {plan.assigned_agent?.phone && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {plan.assigned_agent.phone}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Plan Date</p>
            <p className="text-base font-semibold mt-1">{formatDate(plan.plan_date)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="text-base font-semibold mt-1">
              {visitedCount} / {stops.length} visited
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Retailers sequence table */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          Retailers
        </h2>
        {stops.length === 0 ? (
          <p className="text-sm text-muted-foreground">No retailers in this plan.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Retailer</TableHead>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-center">Visited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stops.map((stop: BeatPlanStop) => (
                <TableRow key={stop.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {stop.sequence_order + 1}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{stop.retailer.name}</p>
                    {stop.retailer.owner_name && (
                      <p className="text-xs text-muted-foreground">
                        {stop.retailer.owner_name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {stop.retailer.area}{stop.retailer.city ? `, ${stop.retailer.city}` : ''}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {stop.retailer.outstanding_balance > 0 ? (
                      <span className="text-red-600 font-medium">
                        {formatCurrency(stop.retailer.outstanding_balance)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {stop.is_visited ? (
                      <span className="text-green-600 font-bold text-base">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
