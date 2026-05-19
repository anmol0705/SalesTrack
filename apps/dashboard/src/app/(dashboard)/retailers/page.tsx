'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PlusCircle, Store } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@salestrack/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EmptyState from '@/components/empty-state';
import type { Retailer } from '@salestrack/types';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  owner_name: z.string().min(1, 'Required'),
  phone: z.string().regex(/^\d{10}$/, 'Must be 10 digits'),
  address: z.string().min(1, 'Required'),
  area: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const formFields: {
  id: keyof FormValues;
  label: string;
  placeholder: string;
  type?: string;
}[] = [
  { id: 'name', label: 'Business name', placeholder: 'Sharma General Store' },
  { id: 'owner_name', label: 'Owner name', placeholder: 'Ravi Sharma' },
  { id: 'phone', label: 'Phone', placeholder: '9876543210' },
  { id: 'address', label: 'Address', placeholder: '12, MG Road' },
  { id: 'area', label: 'Area', placeholder: 'Connaught Place' },
  { id: 'city', label: 'City', placeholder: 'Delhi' },
  { id: 'latitude', label: 'Latitude (optional)', placeholder: '28.6139', type: 'number' },
  { id: 'longitude', label: 'Longitude (optional)', placeholder: '77.2090', type: 'number' },
];

export default function RetailersPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: retailers = [], isLoading } = useQuery({
    queryKey: ['retailers'],
    queryFn: () => api.retailers.list(),
  });

  const filtered = retailers.filter(
    (r: Retailer) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.city.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await api.retailers.create({
        name: values.name,
        owner_name: values.owner_name,
        phone: values.phone,
        address: values.address,
        area: values.area,
        city: values.city,
        latitude: values.latitude ? Number(values.latitude) : null,
        longitude: values.longitude ? Number(values.longitude) : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['retailers'] });
      toast.success('Retailer added');
      setIsDialogOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add retailer');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Retailers</h1>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Retailer
        </Button>
      </div>

      <Input
        placeholder="Search by name, area or city…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No retailers yet"
          description="Add your first retailer to start managing your route"
          action={{ label: 'Add Retailer', href: '#' }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r: Retailer) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.owner_name}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell className="text-muted-foreground">{r.area}</TableCell>
                <TableCell className="text-right">
                  {r.outstanding_balance > 0 ? (
                    <span className="text-red-500 font-medium">
                      {formatCurrency(r.outstanding_balance)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Clear</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Retailer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            {formFields.map(({ id, label, placeholder, type = 'text' }) => (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  type={type}
                  placeholder={placeholder}
                  step={type === 'number' ? 'any' : undefined}
                  {...register(id)}
                />
                {errors[id] && (
                  <p className="text-sm text-destructive">{errors[id]?.message}</p>
                )}
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add Retailer'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
