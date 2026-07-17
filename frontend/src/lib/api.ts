import { ApiResponse, AuthResponse, ProductsResponse, Product, Order, Category, InstallmentSchedule, PayhereCheckoutResponse, CodPaymentResponse, AdminPaymentsResponse, DashboardResponse, Payment } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  private refreshing: Promise<string | null> | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    allowRefresh = true,
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // send/receive the httpOnly refresh cookie
    });

    // Access token expired -> single-flight refresh, then retry once.
    const isAuthEndpoint =
      endpoint === '/auth/refresh' ||
      endpoint === '/auth/login' ||
      endpoint === '/auth/register';
    if (response.status === 401 && allowRefresh && !isAuthEndpoint) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        return this.request<T>(endpoint, options, false);
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      const err = new Error(error.message || `HTTP ${response.status}`) as Error & {
        code?: string;
      };
      // Surface the machine-readable code (e.g. VERIFICATION_REQUIRED) so the
      // checkout flow can route to the verify page instead of showing prose.
      err.code = error.error?.code;
      throw err;
    }

    const data = await response.json();
    return data.data !== undefined ? data.data : data;
  }

  /** Single-flight refresh: concurrent 401s share one /auth/refresh call. */
  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh();
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<string | null> {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('refresh failed');
      const json = await res.json();
      const token: string | null = json?.data?.accessToken ?? json?.accessToken ?? null;
      if (token && typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }
      return token;
    } catch {
      if (typeof window !== 'undefined') localStorage.removeItem('token');
      return null;
    } finally {
      this.refreshing = null;
    }
  }

  // ─── Auth ─────────────────────────────────────────────

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      if (typeof window !== 'undefined') localStorage.removeItem('token');
    }
  }

  // ─── Products ─────────────────────────────────────────

  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    categorySlug?: string;
    subCategory?: string;
    collection?: string;
    offers?: string;
    tier?: string;
    period?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ProductsResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request<ProductsResponse>(`/products${query ? `?${query}` : ''}`);
  }

  async getProductBySlug(slug: string): Promise<Product> {
    return this.request<Product>(`/products/slug/${slug}`);
  }

  async getProductById(id: string): Promise<Product> {
    return this.request<Product>(`/products/${id}`);
  }

  // ─── Categories ───────────────────────────────────────
  // Admin mutations (create/update/delete product or category) live in
  // services/products.service.ts + services/categories.service.ts instead —
  // typed, and going through the axios `http` client's single-flight token
  // refresh rather than this class's separate fetch wrapper.

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  // ─── Orders ───────────────────────────────────────────

  async createOrder(data: {
    items: {
      productId: string;
      quantity: number;
      /** BR3 measurements, required for uniform/custom garments. */
      measurements?: {
        personName: string;
        label?: string;
        values: Record<string, number>;
      };
    }[];
    shippingAddress: any;
    billingAddress?: any;
    notes?: string;
  }): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Server-aggregated dashboard metrics. Revenue counts COMPLETED payments only
   * and is computed in SQL — never summed client-side over a page of orders.
   */
  async getAdminDashboard(from?: string, to?: string): Promise<DashboardResponse> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return this.request<DashboardResponse>(`/admin/dashboard${query ? `?${query}` : ''}`);
  }

  // ─── Payments ─────────────────────────────────────────

  async getStripeConfig(): Promise<{ publishableKey: string | null; isConfigured: boolean }> {
    return this.request('/payments/config');
  }

  async createPayherePayment(orderId: string): Promise<PayhereCheckoutResponse> {
    return this.request<PayhereCheckoutResponse>('/payments/payhere/create', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  }

  async createCodPayment(orderId: string): Promise<CodPaymentResponse> {
    return this.request<CodPaymentResponse>('/payments/cod', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  }

  // ─── Admin Payments ───────────────────────────────────

  async getAllPayments(page = 1, limit = 20, filters?: { method?: string; status?: string }): Promise<AdminPaymentsResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.method) params.set('method', filters.method);
    if (filters?.status) params.set('status', filters.status);
    return this.request<AdminPaymentsResponse>(`/payments/admin/all?${params}`);
  }

  async markPaymentPaid(orderId: string) {
    return this.request(`/payments/admin/${orderId}/mark-paid`, { method: 'POST' });
  }

  async rejectPayment(orderId: string) {
    return this.request(`/payments/admin/${orderId}/reject`, { method: 'POST' });
  }

  async getPayment(orderId: string): Promise<Payment> {
    return this.request<Payment>(`/payments/${orderId}`);
  }

  async getInstallmentSchedule(orderId: string): Promise<InstallmentSchedule> {
    return this.request<InstallmentSchedule>(`/payments/${orderId}/installments`);
  }
}

export const api = new ApiClient();

