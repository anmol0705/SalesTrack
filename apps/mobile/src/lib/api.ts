/*
 * IMPORTANT: On physical Android devices, localhost does not resolve to your
 * dev machine. Replace YOUR_LOCAL_IP in .env with your machine's local network
 * IP (run `ipconfig` on Windows, find IPv4 address under your WiFi adapter).
 * Example: EXPO_PUBLIC_API_URL=http://192.168.1.105:4000
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import type {
  Retailer,
  BeatPlan,
  BeatPlanRetailer,
  Visit,
  VisitOutcome,
  Order,
  OrderItem,
  Payment,
  User,
} from '@salestrack/types';

// ─── Response shapes ──────────────────────────────────────────────────────────

interface ApiOk<T> { success: true; data: T }
interface ApiErr { success: false; error: string }
type ApiResponse<T> = ApiOk<T> | ApiErr;

// ─── Extended joined types ────────────────────────────────────────────────────

export interface BeatPlanStop extends BeatPlanRetailer {
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

export interface BeatPlanWithStops extends BeatPlan {
  assigned_agent: { id: string; full_name: string; phone: string };
  beat_plan_retailers: BeatPlanStop[];
}

export interface VisitWithRetailer extends Visit {
  retailer: { id: string; name: string; phone: string; area: string };
}

export interface PaymentWithRetailer extends Payment {
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

// ─── Auth types ───────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
    app_metadata: { org_id: string; role: string };
    user_metadata: { full_name?: string };
  };
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const http = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
});

// Async request interceptor — SecureStore requires await
http.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('st_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('st_token').catch(() => undefined);
      await SecureStore.deleteItemAsync('st_user').catch(() => undefined);
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

    logout: () =>
      request<void>(() => http.post('/api/auth/logout')),
  },

  retailers: {
    list: (params?: { search?: string }) =>
      request<Retailer[]>(() => http.get('/api/retailers', { params })),
  },

  beatPlans: {
    list: (params?: { agent_id?: string; date?: string }) =>
      request<BeatPlan[]>(() => http.get('/api/beat-plans', { params })),

    get: (id: string) =>
      request<BeatPlanWithStops>(() => http.get(`/api/beat-plans/${id}`)),
  },

  visits: {
    today: () =>
      request<VisitWithRetailer[]>(() => http.get('/api/visits/today')),

    checkin: (payload: {
      beat_plan_retailer_id: string;
      retailer_id: string;
      check_in_lat: number;
      check_in_lng: number;
    }) => request<Visit>(() => http.post('/api/visits/checkin', payload)),

    checkout: (id: string, payload: {
      outcome: Exclude<VisitOutcome, 'pending'>;
      notes?: string;
    }) => request<Visit>(() => http.put(`/api/visits/${id}/checkout`, payload)),
  },

  orders: {
    list: (params?: { status?: string }) =>
      request<OrderWithRelations[]>(() => http.get('/api/orders', { params })),

    create: (payload: {
      visit_id: string;
      retailer_id: string;
      items: Array<{
        item_description: string;
        quantity: number;
        unit: string;
        unit_price: number;
      }>;
      notes?: string;
    }) => request<Order>(() => http.post('/api/orders', payload)),
  },

  payments: {
    list: (params?: { date?: string }) =>
      request<PaymentWithRetailer[]>(() => http.get('/api/payments', { params })),

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
  },
};
