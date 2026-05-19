'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const schema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    business_name: z.string().min(2, 'Business name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

export default function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormData) => {
    setIsLoading(true);
    try {
      await api.auth.signup({
        full_name: values.full_name,
        business_name: values.business_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
      await useAuthStore.getState().login(values.email, values.password);
      router.push('/dashboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const fields: {
    id: keyof FormData;
    label: string;
    type?: string;
    placeholder: string;
  }[] = [
    { id: 'full_name', label: 'Full name', placeholder: 'Rahul Sharma' },
    { id: 'business_name', label: 'Business name', placeholder: 'Sharma Distributors' },
    { id: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
    { id: 'phone', label: 'Phone', placeholder: '9876543210' },
    { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    {
      id: 'confirm_password',
      label: 'Confirm password',
      type: 'password',
      placeholder: '••••••••',
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {fields.map(({ id, label, type = 'text', placeholder }) => (
            <div key={id} className="space-y-1.5">
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type={type}
                placeholder={placeholder}
                {...register(id)}
              />
              {errors[id] && (
                <p className="text-sm text-destructive">{errors[id]?.message}</p>
              )}
            </div>
          ))}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
