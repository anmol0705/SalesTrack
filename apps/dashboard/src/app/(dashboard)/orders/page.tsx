'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShoppingCart, Eye } from 'lucide-react';
import { formatCurrency, formatDate } from '@salestrack/utils';
import { api, type OrderWithRelations } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EmptyState from '@/components/empty-state';
import type { OrderStatus, OrderItem } from '@salestrack/types';

const statusBadge: Record<
  OrderStatus,
  { variant: 'secondary' | 'outline' | 'destructive'; className: string }
> = {
  draft: { variant: 'secondary', className: '' },
  confirmed: { variant: 'outline', className: 'text-green-600 border-green-600' },
  cancelled: { variant: 'destructive', className: '' },
};

function OrderDetailPanel({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.orders.get(orderId),
    enabled: !!orderId,
  });

  const updateStatus = async (status: 'confirmed' | 'cancelled') => {
    try {
      await api.orders.updateStatus(orderId, status);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      toast.success(`Order ${status}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update order');
    }
  };

  return (
    <div className="space-y-4">
      {isLoading || !order ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Agent', value: order.agent.full_name },
              { label: 'Retailer', value: order.retailer.name },
              { label: 'Date', value: formatDate(order.created_at) },
              { label: 'Status', value: order.status },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium capitalize">{value}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-3">Items</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.order_items.map((item: OrderItem) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.item_description}</TableCell>
                    <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-sm">{item.unit}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(item.total_price)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="font-bold text-right border-t">
                    Total
                  </TableCell>
                  <TableCell className="font-bold text-right border-t">
                    {formatCurrency(order.total_amount)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {order.status === 'draft' && (
            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={() => updateStatus('confirmed')}>
                Confirm Order
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => updateStatus('cancelled')}
              >
                Cancel Order
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', statusFilter, agentFilter],
    queryFn: () =>
      api.orders.list({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(agentFilter !== 'all' ? { agent_id: agentFilter } : {}),
      }),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['users-agents'],
    queryFn: () => api.auth.users({ role: 'agent' }),
  });

  const totalOrders = orders.length;
  const confirmedValue = orders
    .filter((o) => o.status === 'confirmed')
    .reduce((s, o) => s + o.total_amount, 0);
  const pendingCount = orders.filter((o) => o.status === 'draft').length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Orders</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total orders</p>
            <p className="text-2xl font-bold mt-1">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Confirmed value</p>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {formatCurrency(confirmedValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending (draft)</p>
            <p className="text-2xl font-bold mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
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

      {!isLoading && orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="Orders placed by agents during visits appear here"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Retailer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order: OrderWithRelations) => {
              const { variant, className } = statusBadge[order.status];
              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell>{order.agent.full_name}</TableCell>
                  <TableCell className="font-medium">{order.retailer.name}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={variant} className={`capitalize ${className}`}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Sheet open={!!selectedOrderId} onOpenChange={(open: boolean) => !open && setSelectedOrderId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Order #{selectedOrderId?.slice(0, 8).toUpperCase()}
            </SheetTitle>
          </SheetHeader>
          {selectedOrderId && (
            <div className="mt-4">
              <OrderDetailPanel
                orderId={selectedOrderId}
                onClose={() => setSelectedOrderId(null)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
