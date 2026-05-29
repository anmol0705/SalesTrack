'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CreditCard, MessageCircle } from 'lucide-react';
import { formatCurrency, formatTime } from '@salestrack/utils';
import { generateWhatsAppReceiptLink } from '@salestrack/utils';
import { api, type PaymentWithRelations } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import type { PaymentMethod, PaymentStatus } from '@salestrack/types';

const methodBadge: Record<PaymentMethod, 'outline' | 'secondary' | 'default'> = {
  cash: 'outline',
  cheque: 'secondary',
  upi: 'default',
};

const statusBadge: Record<
  PaymentStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  confirmed: { variant: 'outline', className: 'text-green-600 border-green-600' },
  pending: { variant: 'outline', className: 'text-yellow-600 border-yellow-600' },
  failed: { variant: 'destructive', className: '' },
};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', dateFilter, statusFilter],
    queryFn: () =>
      api.payments.list({
        date: dateFilter,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      }),
  });

  const totalValue = payments.reduce((s, p) => s + p.amount, 0);
  const confirmedValue = payments
    .filter((p) => p.status === 'confirmed')
    .reduce((s, p) => s + p.amount, 0);
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  const handleConfirm = async (id: string) => {
    try {
      await api.payments.confirm(id);
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment confirmed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to confirm payment');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Payments</h1>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total payments</p>
            <p className="text-2xl font-bold mt-1">{payments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total value</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Confirmed</p>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {formatCurrency(confirmedValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-44"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments recorded"
          description="Payments appear here once agents collect from retailers"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Retailer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p: PaymentWithRelations) => {
              const { variant: sv, className: sc } = statusBadge[p.status];
              const whatsappLink = generateWhatsAppReceiptLink(
                p.retailer.phone,
                p.amount,
                'SalesTrack',
                p.id,
              );
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.agent.full_name}</TableCell>
                  <TableCell className="font-medium">{p.retailer.name}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={methodBadge[p.method]} className="capitalize">
                      {p.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.reference_number ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={sv} className={`capitalize ${sc}`}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatTime(p.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'pending' && p.method !== 'cash' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfirm(p.id)}
                        >
                          Confirm
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Send receipt"
                        onClick={() => window.open(whatsappLink, '_blank')}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
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
