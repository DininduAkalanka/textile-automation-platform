'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Order, Product } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatLKR } from '@/lib/format';

/** Server-computed. Revenue is a decimal string and is never parsed to a float here. */
const EMPTY_TOTALS = {
  revenue: '0.00',
  ordersToday: 0,
  pendingOrders: 0,
  lowStockCount: 0,
  totalOrders: 0,
  totalProducts: 0,
};

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  // Metrics via TanStack Query (doc 05 §3.4): caching, loading and error states
  // are handled by the hook rather than three useState flags.
  const { data: dashboard, isLoading: metricsLoading } = useDashboard();
  const totals = dashboard?.totals ?? EMPTY_TOTALS;

  // The two tables below still use the legacy client; they are migrated with the
  // admin catalog UI in Session 2.2.
  useEffect(() => {
    if (!isAdmin) {
      setListsLoading(false);
      return;
    }

    Promise.all([api.getAllOrders(1, 10), api.getProducts({ limit: 100 })])
      .then(([ordersRes, productsRes]) => {
        setOrders(ordersRes.orders || []);
        setProducts(productsRes.products || []);
      })
      .catch(() => toast.error('Could not load orders and products'))
      .finally(() => setListsLoading(false));
  }, [isAdmin]);

  const loading = metricsLoading || listsLoading;

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Admin Access Required</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Please sign in with an admin account</p>
        <Link href="/login" className="btn btn-primary">Sign In</Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    PENDING: 'badge-warning',
    CONFIRMED: 'badge-info',
    IN_PRODUCTION: 'badge-info',
    QUALITY_CHECK: 'badge-info',
    COMPLETED: 'badge-success',
    DELIVERED: 'badge-success',
    CANCELLED: 'badge-danger',
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      const updated = await api.getAllOrders(1, 10);
      setOrders(updated.orders || []);
      toast.success(`Order moved to ${newStatus}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update status',
      );
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 0 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700 }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Welcome back, {user?.firstName}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/admin/ai-insights" className="btn btn-outline btn-sm">✨ AI Insights</Link>
          <Link href="/admin/production" className="btn btn-outline btn-sm">🧵 Production</Link>
          <Link href="/admin/payments" className="btn btn-outline btn-sm">💳 Payments</Link>
          <Link href="/" className="btn btn-outline btn-sm">← Back to Shop</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Total Orders', value: totals.totalOrders, icon: '📦', color: '#eff6ff' },
          { label: 'Revenue (paid)', value: formatLKR(totals.revenue), icon: '💰', color: '#ecfdf5' },
          { label: 'Products', value: totals.totalProducts, icon: '🧵', color: '#fef3cd' },
          { label: 'Low Stock', value: totals.lowStockCount, icon: '⚠️', color: '#fce7f3' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card"
            style={{ padding: '1.5rem', background: stat.color, border: 'none' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{stat.label}</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{stat.value}</p>
              </div>
              <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card" style={{ marginBottom: '2rem', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Recent Orders</h2>
        </div>
        {loading ? (
          <div style={{ padding: '2rem' }}><div className="skeleton" style={{ height: '200px' }} /></div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No orders yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  {['Order', 'Customer', 'Items', 'Total', 'Status', 'Date', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>#{order.orderNumber}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{order.user?.firstName} {order.user?.lastName}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{order.items?.length || 0}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{formatLKR(order.total)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`badge ${statusColors[order.status] || 'badge-info'}`}>{order.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleStatusUpdate(order.id, e.target.value);
                        }}
                        className="input"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                      >
                        <option value="">Update...</option>
                        {['CONFIRMED', 'IN_PRODUCTION', 'QUALITY_CHECK', 'COMPLETED', 'DELIVERED', 'CANCELLED'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Products</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                {['Product', 'SKU', 'Price', 'Stock', 'Category', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8125rem' }}>{p.sku}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{formatLKR(p.price)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`badge ${p.stockQuantity > 10 ? 'badge-success' : p.stockQuantity > 0 ? 'badge-warning' : 'badge-danger'}`}>
                      {p.stockQuantity}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{p.category?.name || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`badge ${p.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
