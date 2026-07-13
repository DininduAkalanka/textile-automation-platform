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
  /** Depth capped at 2 (plan doc 06 §5.2) — null means top-level. */
  parentId?: string | null;
  _count?: {
    products: number;
    children?: number;
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
  fabricType?: string;
  color?: string;
  unit?: string;
  /** Nullable, never 0 — see the schema's own comment: unset means unknown
   *  margin, not zero cost. */
  costPrice?: number;
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
  /** BR3 — snapshotted at checkout, so it never drifts if the customer later
   *  edits their saved measurements. Present only for uniform/custom items. */
  measurements?: {
    personName: string;
    label?: string;
    values: Record<string, number>;
  } | null;
}

/**
 * One row of order_status_history. The customer tracking stepper (plan 7.1
 * task 3) is rendered FROM these timestamps — never from `order.status` alone,
 * which can say WHERE an order is but not WHEN it got there.
 */
export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string | null;
  /** Resolved name — present ONLY on an admin read; see orders.service.ts's
   *  resolveChangedByNames. "System" for a transition no one clicked a button
   *  for (production's floor-driven moves, a webhook confirming payment). */
  changedByName?: string;
  note: string | null;
  createdAt: string;
}

/** The production timeline widget's data (plan 7.1 task 1) — one row per item
 *  that entered the pipeline. Absent entirely on a fulfillment-only order. */
export interface OrderProductionTaskSummary {
  id: string;
  stage: 'CUTTING' | 'STITCHING' | 'FINISHING' | 'QUALITY_CHECK';
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  orderItemId: string;
  worker: { user: { firstName: string; lastName: string } } | null;
}

/**
 * The single source for the admin order-detail buttons (plan 7.1 tasks 2 and 5).
 * The server computes ALL FIVE, always, whether allowed or not — the frontend
 * never infers a reason, it only ever renders the one the server already wrote.
 */
export interface AdminOrderAction {
  action: 'confirm' | 'cancel' | 'advance' | 'deliver' | 'mark_collected';
  label: string;
  allowed: boolean;
  reason: string | null;
  requiresAcknowledgeRefund?: boolean;
  destructive?: boolean;
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
  /** Present on every detail read (GET /orders/:id) — absent on list rows. */
  statusHistory?: OrderStatusHistoryEntry[];
  productionTasks?: OrderProductionTaskSummary[];
  /** Present ONLY when the caller is an admin — see orders.service.ts's
   *  findById: a customer's own read of their own order never gets this. */
  adminActions?: AdminOrderAction[];
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
  /** The raw gateway payload (PayHere/Stripe webhook body) — the "webhook
   *  evidence" the admin order page shows. Null for COD, which has no gateway. */
  gatewayResponse?: Record<string, unknown> | null;
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
  /**
   * The same metrics over the previous window of equal length. `null` percentages
   * mean there was no prior data — the UI must say so rather than print "+100%",
   * because a first sale is not growth.
   */
  deltas: {
    previousRevenue: string;
    revenueChangePercent: number | null;
    previousPaidOrders: number;
    paidOrdersChangePercent: number | null;
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

/** The bell, for both navbars (plan 7.1 task 4). `type` is a free-form producer
 *  tag — "order.status_changed", "inventory.low_stock" — never branched on in
 *  the UI; only `title`/`body` are ever rendered. */
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
