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
