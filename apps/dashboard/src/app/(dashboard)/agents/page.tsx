'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PlusCircle, Users } from 'lucide-react';
import { formatDate } from '@salestrack/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { User } from '@salestrack/types';

const schema = z.object({
  full_name: z.string().min(2, 'Full name required'),
  phone: z.string().regex(/^\d{10}$/, 'Must be 10 digits'),
  email: z.string().email('Enter a valid email'),
  role: z.enum(['agent', 'manager']),
});

type FormData = z.infer<typeof schema>;

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['users-agents'],
    queryFn: () => api.auth.users({ role: 'agent' }),
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'agent' },
  });

  const onInvite = async (values: FormData) => {
    try {
      await api.auth.inviteAgent(values);
      await queryClient.invalidateQueries({ queryKey: ['users-agents'] });
      toast.success(`Invite sent to ${values.email}`);
      setIsInviteOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send invite');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agents</h1>
        <Button onClick={() => setIsInviteOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Invite Agent
        </Button>
      </div>

      {!isLoading && agents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No agents yet"
          description="Invite your first field agent to get started"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent: User) => (
              <TableRow key={agent.id}>
                <TableCell className="font-medium">{agent.full_name}</TableCell>
                <TableCell>{agent.phone}</TableCell>
                <TableCell>
                  <Badge variant={agent.role === 'manager' ? 'default' : 'secondary'}>
                    {agent.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      agent.is_active
                        ? 'text-green-600 border-green-600'
                        : 'text-red-500 border-red-500'
                    }
                  >
                    {agent.is_active ? 'active' : 'inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(agent.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onInvite)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" placeholder="Rahul Sharma" {...register('full_name')} />
              {errors.full_name && (
                <p className="text-sm text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="9876543210" {...register('phone')} />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="agent@example.com" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                defaultValue="agent"
                onValueChange={(v: string) => setValue('role', v as 'agent' | 'manager')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send Invite'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
