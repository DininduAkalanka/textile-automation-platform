// ─── Types ────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'ADMIN' | 'MANAGER' | 'CUSTOMER';
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  _count?: {
    products: number;
  };
}

export type ProductType =
  | 'FABRIC'
  | 'READY_MADE'
  | 'UNIFORM'
  | 'CUSTOM'
  | 'ACCESSORY';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  stockQuantity: number;
  sku: string;
  images: string[];
  attributes: Record<string, any>;
  categoryId?: string;
  category?: Category;
  isActive: boolean;
  /** Drives BR3 and the D8 production gate. */
  productType?: ProductType;
  requiresMeasurement?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedAttributes?: Record<string, any>;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  status: OrderStatus;
  shippingAddress: Address;
  billingAddress?: Address;
  notes?: string;
  items: OrderItem[];
  payment?: Payment;
  user?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'QUALITY_CHECK'
  | 'COMPLETED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Payment {
  id: string;
  orderId: string;
  transactionId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  method: 'STRIPE' | 'PAYHERE' | 'COD' | 'INSTALLMENT';
  paymentPlan: 'FULL' | 'INSTALLMENT';
  installmentCount?: number;
  paidAt?: string;
  createdAt: string;
  installments?: Installment[];
}

export interface Installment {
  id: string;
  paymentId?: string;
  installmentNo: number;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  stripePaymentId?: string;
  paidAt?: string;
  createdAt?: string;
}

export interface InstallmentSchedule {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  paymentPlan: 'FULL' | 'INSTALLMENT';
  installmentCount: number;
  overallStatus: string;
  installments: Installment[];
}

export interface PaymentIntentResponse {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  paymentPlan: 'FULL' | 'INSTALLMENT';
  clientSecret: string;
  installmentCount?: number;
  firstInstallmentAmount?: number;
  installments?: Installment[];
}

export interface PayhereCheckoutResponse {
  checkoutUrl: string;
  params: Record<string, string>;
}

export interface CodPaymentResponse {
  orderId: string;
  method: string;
  orderStatus: string;
  paymentStatus: string;
}

export interface AdminPayment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  method: 'STRIPE' | 'PAYHERE' | 'COD' | 'INSTALLMENT';
  paidAt?: string;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    user?: { firstName: string; lastName: string; email: string };
  };
}

export interface AdminPaymentsResponse {
  payments: AdminPayment[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * GET /admin/dashboard. Money arrives as a decimal string, never a number:
 * parsing it into a JS float is exactly the bug this endpoint replaced. Pass it
 * straight to formatLKR.
 */
export interface DashboardResponse {
  range: { from: string; to: string };
  totals: {
    /** Decimal string. COMPLETED payments only, aggregated in SQL. */
    revenue: string;
    ordersToday: number;
    pendingOrders: number;
    lowStockCount: number;
    totalOrders: number;
    totalProducts: number;
  };
  salesByDay: Array<{ date: string; revenue: string; orders: number }>;
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: string;
  }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    total: string;
    status: string;
    paymentStatus: string | null;
    createdAt: string;
  }>;
}

export interface Address {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

// ─── Cart Types ───────────────────────────────────────────

export interface CartItem {
  product: Product;
  quantity: number;
  /**
   * BR3. Present only for products whose type requires it (uniform/custom, or
   * requires_measurement). Snapshotted onto the order item at checkout so a later
   * edit to the customer's saved measurements never rewrites what was stitched.
   */
  measurements?: {
    personName: string;
    label?: string;
    values: Record<string, number>;
  };
}

// ─── API Response Types ───────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
