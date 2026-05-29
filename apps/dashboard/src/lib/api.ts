'use client';

import axios from 'axios';
import type {
  Retailer,
  BeatPlan,
  Visit,
  Order,
  OrderItem,
  Payment,
  User,
} from '@salestrack/types';

// ─── Response shapes ──────────────────────────────────────────────────────────

interface ApiOk<T> {
  success: true;
  data: T;
}
interface ApiErr {
  success: false;
  error: string;
}
type ApiResponse<T> = ApiOk<T> | ApiErr;

// ─── Domain payload types ─────────────────────────────────────────────────────

export interface SignupPayload {
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  password: string;
}

export interface InviteAgentPayload {
  full_name: string;
  phone: string;
  email: string;
  role: 'agent' | 'manager';
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
    app_metadata: { org_id: string; role: string };
  };
}

export interface AgentActivity {
  agent_id: string;
  agent_name: string;
  visits_done: number;
  orders_count: number;
  orders_value: number;
  collections: number;
  status: 'active' | 'idle';
}

export interface DashboardAnalytics {
  date: string;
  visits: { planned: number; completed: number };
  orders: { value: number };
  collections: { total: number };
  active_agents: number;
}

export interface AgentStats {
  agent_id: string;
  period: { from: string; to: string };
  visits: { completed: number; total: number };
  orders: { count: number; value: number };
  payments: { collected: number };
}

// ─── Extended joined types (API includes related rows via select()) ────────────

export interface BeatPlanStop {
  id: string;
  sequence_order: number;
  is_visited: boolean;
  retailer_id: string;
  retailer: {
    id: string;
    name: string;
    owner_name: string;
    phone: string;
    area: string;
    city: string;
    outstanding_balance: number;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface BeatPlanWithDetail extends BeatPlan {
  assigned_agent: { id: string; full_name: string; phone: string };
  beat_plan_retailers: BeatPlanStop[];
}

export interface VisitWithRelations extends Visit {
  retailer: { id: string; name: string; phone: string; area: string };
  agent: { id: string; full_name: string };
}

export interface PaymentWithRelations extends Payment {
  retailer: { id: string; name: string; phone: string };
  agent: { id: string; full_name: string };
}

export interface OrderWithRelations extends Order {
  retailer: { id: string; name: string };
  agent: { id: string; full_name: string };
}

export interface OrderDetail extends Order {
  retailer: { id: string; name: string; phone: string };
  agent: { id: string; full_name: string };
  order_items: OrderItem[];
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('st_token');
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('st_token');
      localStorage.removeItem('st_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ─── Helper ───────────────────────────────────────────────────────────────────

async function request<T>(fn: () => Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await fn();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>(() => http.post('/api/auth/login', { email, password })),

    signup: (payload: SignupPayload) =>
      request<{ org_id: string; user_id: string; email: string }>(() =>
        http.post('/api/auth/signup', payload),
      ),

    logout: () =>
      request<void>(() => http.post('/api/auth/logout')),

    inviteAgent: (payload: InviteAgentPayload) =>
      request<{ message: string; user_id: string }>(() =>
        http.post('/api/auth/invite-agent', payload),
      ),

    users: (params?: { role?: string }) =>
      request<User[]>(() => http.get('/api/auth/users', { params })),
  },

  retailers: {
    list: (params?: { search?: string; area?: string }) =>
      request<Retailer[]>(() => http.get('/api/retailers', { params })),

    get: (id: string) =>
      request<Retailer>(() => http.get(`/api/retailers/${id}`)),

    create: (data: Partial<Retailer>) =>
      request<Retailer>(() => http.post('/api/retailers', data)),

    update: (id: string, data: Partial<Retailer>) =>
      request<Retailer>(() => http.put(`/api/retailers/${id}`, data)),

    remove: (id: string) =>
      request<void>(() => http.delete(`/api/retailers/${id}`)),
  },

  beatPlans: {
    list: (params?: { date?: string; agent_id?: string }) =>
      request<BeatPlan[]>(() => http.get('/api/beat-plans', { params })),

    get: (id: string) =>
      request<BeatPlanWithDetail>(() => http.get(`/api/beat-plans/${id}`)),

    create: (data: {
      name: string;
      assigned_agent_id: string;
      plan_date: string;
      retailer_ids: string[];
    }) => request<BeatPlan>(() => http.post('/api/beat-plans', data)),

    reorder: (id: string, retailer_ids: string[]) =>
      request<void>(() => http.put(`/api/beat-plans/${id}/reorder`, { retailer_ids })),

    updateStatus: (id: string, status: string) =>
      request<BeatPlan>(() => http.put(`/api/beat-plans/${id}`, { status })),
  },

  visits: {
    list: (params?: { agent_id?: string; date?: string }) =>
      request<VisitWithRelations[]>(() => http.get('/api/visits', { params })),

    today: () =>
      request<VisitWithRelations[]>(() => http.get('/api/visits/today')),
  },

  orders: {
    list: (params?: { agent_id?: string; retailer_id?: string; status?: string }) =>
      request<OrderWithRelations[]>(() => http.get('/api/orders', { params })),

    get: (id: string) =>
      request<OrderDetail>(() => http.get(`/api/orders/${id}`)),

    updateStatus: (id: string, status: 'confirmed' | 'cancelled') =>
      request<Order>(() => http.put(`/api/orders/${id}/status`, { status })),
  },

  payments: {
    list: (params?: {
      agent_id?: string;
      retailer_id?: string;
      status?: string;
      date?: string;
    }) =>
      request<PaymentWithRelations[]>(() => http.get('/api/payments', { params })),

    create: (data: {
      visit_id: string;
      retailer_id: string;
      amount: number;
      method: 'cash' | 'cheque' | 'upi';
      reference_number?: string;
    }) =>
      request<{ payment: Payment; whatsapp_link: string }>(() =>
        http.post('/api/payments', data),
      ),

    confirm: (id: string) =>
      request<Payment>(() => http.put(`/api/payments/${id}/confirm`, {})),
  },

  analytics: {
    dashboard: () =>
      request<DashboardAnalytics>(() => http.get('/api/analytics/dashboard')),

    agentStats: (id: string, params?: { from?: string; to?: string }) =>
      request<AgentStats>(() => http.get(`/api/analytics/agent/${id}`, { params })),
  },
};
