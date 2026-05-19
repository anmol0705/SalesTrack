'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { GripVertical, X, Loader2 } from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvided,
  type DroppableProvided,
} from '@hello-pangea/dnd';
import { api } from '@/lib/api';
import { formatCurrency } from '@salestrack/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Retailer } from '@salestrack/types';

const LeafletMap = dynamic(() => import('@/components/leaflet-map'), { ssr: false });

const schema = z.object({
  name: z.string().min(1, 'Plan name required'),
  assigned_agent_id: z.string().min(1, 'Select an agent'),
  plan_date: z.string().min(1, 'Select a date'),
});

type FormData = z.infer<typeof schema>;

type SelectedRetailer = Pick<
  Retailer,
  'id' | 'name' | 'area' | 'outstanding_balance' | 'latitude' | 'longitude'
>;

export default function BeatPlanForm() {
  const router = useRouter();
  const [selectedRetailers, setSelectedRetailers] = useState<SelectedRetailer[]>([]);
  const [retailerSearch, setRetailerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Retailer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: agents = [] } = useQuery({
    queryKey: ['users-agents'],
    queryFn: () => api.auth.users({ role: 'agent' }),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Retailer search with 300ms debounce
  useEffect(() => {
    if (retailerSearch.length <= 1) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await api.retailers.list({ search: retailerSearch });
      setSearchResults(results);
      setShowResults(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [retailerSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const addRetailer = (retailer: Retailer) => {
    if (selectedRetailers.some((r) => r.id === retailer.id)) return;
    setSelectedRetailers((prev) => [
      ...prev,
      {
        id: retailer.id,
        name: retailer.name,
        area: retailer.area,
        outstanding_balance: retailer.outstanding_balance,
        latitude: retailer.latitude,
        longitude: retailer.longitude,
      },
    ]);
    setRetailerSearch('');
    setShowResults(false);
  };

  const removeRetailer = useCallback((id: string) => {
    setSelectedRetailers((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(selectedRetailers);
    const [moved] = items.splice(result.source.index, 1);
    if (moved) items.splice(result.destination.index, 0, moved);
    setSelectedRetailers(items);
  };

  const onSubmit = async (values: FormData) => {
    if (selectedRetailers.length === 0) return;
    setIsSubmitting(true);
    try {
      await api.beatPlans.create({
        name: values.name,
        assigned_agent_id: values.assigned_agent_id,
        plan_date: values.plan_date,
        retailer_ids: selectedRetailers.map((r) => r.id),
      });
      toast.success('Beat plan created!');
      router.push('/beat-plans');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create beat plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const mapRetailers = selectedRetailers
    .filter((r): r is SelectedRetailer & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null,
    )
    .map((r) => ({ name: r.name, latitude: r.latitude, longitude: r.longitude }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Plan details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Plan name</Label>
                <Input id="name" placeholder="Monday Route — North Zone" {...register('name')} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Agent</Label>
                <Select onValueChange={(v: string) => setValue('assigned_agent_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assigned_agent_id && (
                  <p className="text-sm text-destructive">
                    {errors.assigned_agent_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan_date">Plan date</Label>
                <Input
                  id="plan_date"
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  {...register('plan_date')}
                />
                {errors.plan_date && (
                  <p className="text-sm text-destructive">{errors.plan_date.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add retailers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Retailers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div ref={searchRef} className="relative">
                <Input
                  placeholder="Search retailers…"
                  value={retailerSearch}
                  onChange={(e) => setRetailerSearch(e.target.value)}
                />
                {showResults && searchResults.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-background border rounded-md shadow-md max-h-56 overflow-auto">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted text-sm"
                        onClick={() => addRetailer(r)}
                      >
                        <div className="text-left">
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.area}</p>
                        </div>
                        {r.outstanding_balance > 0 && (
                          <span className="text-red-500 text-xs font-medium ml-2 shrink-0">
                            {formatCurrency(r.outstanding_balance)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Route sequence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Route sequence ({selectedRetailers.length} retailers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedRetailers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Search and add retailers above
                </p>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="retailers">
                    {(provided: DroppableProvided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {selectedRetailers.map((r, index) => (
                          <Draggable key={r.id} draggableId={r.id} index={index}>
                            {(provided: DraggableProvided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="flex items-center gap-3 p-3 border rounded-md mb-2 bg-background"
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-muted-foreground text-sm w-6 text-center">
                                  {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{r.name}</p>
                                  <p className="text-xs text-muted-foreground">{r.area}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-7 w-7"
                                  onClick={() => removeRetailer(r.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — map */}
        <Card className="h-full min-h-96">
          <CardHeader>
            <CardTitle className="text-base">Route preview</CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)] min-h-72">
            <LeafletMap retailers={mapRetailers} />
          </CardContent>
        </Card>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={selectedRetailers.length === 0 || isSubmitting}
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Beat Plan
      </Button>
    </form>
  );
}
