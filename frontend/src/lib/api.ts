import { ApiResponse, AuthResponse, ProductsResponse, Product, Order, Category, InstallmentSchedule, PayhereCheckoutResponse, CodPaymentResponse, AdminPaymentsResponse, DashboardResponse, Payment } from '@/types';
import { getToken, setToken, clearToken } from '@/lib/token-store';

const PRODUCTION_API_URL = 'https://textile-automation-platform.onrender.com/api/v1';
const LOCAL_API_URL = 'http://localhost:3001/api/v1';

export function getResolvedApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return LOCAL_API_URL;
    }
    return PRODUCTION_API_URL;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return PRODUCTION_API_URL;
  }
  return LOCAL_API_URL;
}

class ApiClient {
  private getToken(): string | null {
    return getToken(); // F-04: reads from in-memory store, not localStorage
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

    const currentApiUrl = getResolvedApiUrl();
    const response = await fetch(`${currentApiUrl}${endpoint}`, {
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
      const currentApiUrl = getResolvedApiUrl();
      const res = await fetch(`${currentApiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('refresh failed');
      const json = await res.json();
      const token: string | null = json?.data?.accessToken ?? json?.accessToken ?? null;
      if (token) setToken(token); // F-04: in-memory only
      return token;
    } catch {
      clearToken(); // F-04: clear in-memory token on failure
      return null;
    } finally {
      this.refreshing = null;
    }
  }

  /** Explicit public refresh — called by useAuthStore.loadUser() on page mount
   *  to re-hydrate the in-memory access token from the httpOnly refresh cookie.
   *  Must use direct fetch so unauthenticated visitors (who naturally have no cookie)
   *  silently return null instead of throwing an Error through this.request(). */
  async refresh(): Promise<AuthResponse | null> {
    try {
      const currentApiUrl = getResolvedApiUrl();
      const res = await fetch(`${currentApiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const json = await res.json();
      const payload = json?.data !== undefined ? json.data : json;
      const token: string | null = payload?.accessToken ?? null;
      if (token) setToken(token);
      return payload as AuthResponse;
    } catch {
      return null;
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

  async sendVerificationCode(channel: 'EMAIL' | 'SMS' = 'EMAIL') {
    return this.request('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  }

  async verifyContactCode(channel: 'EMAIL' | 'SMS', code: string) {
    return this.request<{ emailVerified: boolean; phoneVerified: boolean }>('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ channel, code }),
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      clearToken(); // F-04: clear in-memory token
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

  /** "Customers also bought" — market-basket recommendations for a product. */
  async getFrequentlyBoughtTogether(id: string, limit = 8): Promise<Product[]> {
    return this.request<Product[]>(
      `/products/${id}/frequently-bought-together?limit=${limit}`,
    );
  }

  /** "You may also like" — content-based related products. */
  async getRelatedProducts(id: string, limit = 8): Promise<Product[]> {
    return this.request<Product[]>(`/products/${id}/related?limit=${limit}`);
  }

  // ─── Categories ───────────────────────────────────────
  // Admin mutations (create/update/delete product or category) live in
  // services/products.service.ts + services/categories.service.ts instead —
  // typed, and going through the axios `http` client's single-flight token
  // refresh rather than this class's separate fetch wrapper.

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

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
   * Public Express / Guest Checkout endpoint.
   * Auto-provisions user account and creates order with session return.
   */
  async guestCheckout(data: {
    items: {
      productId: string;
      quantity: number;
      measurements?: {
        personName: string;
        label?: string;
        values: Record<string, number>;
      };
    }[];
    shippingAddress: any;
    billingAddress?: any;
    email: string;
    phone: string;
    fullName: string;
    paymentMethod: 'PAYHERE' | 'COD' | 'INSTALLMENT' | 'STRIPE';
    verificationCode?: string;
    password?: string;
    notes?: string;
  }): Promise<{ order: Order; session: { accessToken: string; refreshToken: string; user: any } }> {
    return this.request<{ order: Order; session: { accessToken: string; refreshToken: string; user: any } }>(
      '/orders/guest-checkout',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
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

  async createInstallmentPayment(orderId: string, installmentCount = 3): Promise<any> {
    return this.request('/payments/installments/create', {
      method: 'POST',
      body: JSON.stringify({ orderId, installmentCount }),
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

  /**
   * Fetch the order's PDF invoice as a Blob. Kept separate from request() (which
   * always parses JSON) because this returns binary; it mirrors the same
   * auth-header + single refresh-and-retry behaviour on a 401.
   */
  private async blob(endpoint: string, allowRefresh = true): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const currentApiUrl = getResolvedApiUrl();
    const response = await fetch(`${currentApiUrl}${endpoint}`, {
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && allowRefresh) {
      const newToken = await this.refreshAccessToken();
      if (newToken) return this.blob(endpoint, false);
    }
    if (!response.ok) {
      throw new Error(`Could not download file (HTTP ${response.status})`);
    }
    return response.blob();
  }

  /** Download the order invoice PDF and hand it to the browser as a save. */
  async downloadInvoice(orderId: string, orderNumber: string): Promise<void> {
    const pdf = await this.blob(`/orders/${orderId}/invoice.pdf`);
    const url = URL.createObjectURL(pdf);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so the click has consumed the URL first.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export const api = new ApiClient();

