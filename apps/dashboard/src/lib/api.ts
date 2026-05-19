'use client';

import axios from 'axios';
import type {
  Retailer,
  BeatPlan,
  Visit,
  Order,
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
  visits_planned: number;
  visits_completed: number;
  orders_value_today: number;
  collections_today: number;
  active_agents_count: number;
  agents: AgentActivity[];
}

export interface AgentStats {
  agent: User;
  visits_count: number;
  orders_count: number;
  orders_value: number;
  collections: number;
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
      request<BeatPlan>(() => http.get(`/api/beat-plans/${id}`)),

    create: (data: {
      name: string;
      assigned_agent_id: string;
      plan_date: string;
      retailer_ids: string[];
    }) => request<BeatPlan>(() => http.post('/api/beat-plans', data)),

    reorder: (id: string, retailer_ids: string[]) =>
      request<void>(() => http.put(`/api/beat-plans/${id}/reorder`, { retailer_ids })),
  },

  visits: {
    list: (params?: { agent_id?: string; date?: string }) =>
      request<Visit[]>(() => http.get('/api/visits', { params })),

    today: () =>
      request<Visit[]>(() => http.get('/api/visits/today')),
  },

  orders: {
    list: (params?: { agent_id?: string; retailer_id?: string; status?: string }) =>
      request<Order[]>(() => http.get('/api/orders', { params })),
  },

  payments: {
    list: (params?: { agent_id?: string; retailer_id?: string }) =>
      request<Payment[]>(() => http.get('/api/payments', { params })),

    create: (data: {
      visit_id: string;
      retailer_id: string;
      amount: number;
      method: 'cash' | 'cheque' | 'upi';
      reference_number?: string;
    }) => request<Payment>(() => http.post('/api/payments', data)),
  },

  analytics: {
    dashboard: () =>
      request<DashboardAnalytics>(() => http.get('/api/analytics/dashboard')),

    agentStats: (id: string, params?: { from?: string; to?: string }) =>
      request<AgentStats>(() => http.get(`/api/analytics/agent/${id}`, { params })),
  },
};
