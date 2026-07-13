'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Package,
  Scissors,
  ShoppingCart,
  Sparkles,
  Store,
} from 'lucide-react';

import { useLowStock } from '@/hooks/use-inventory';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Not built yet — shown, but honestly marked. Hiding it would hide the roadmap. */
  soon?: boolean;
  /** Renders the live low-stock count. Only Inventory carries one today. */
  alertCount?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/ai-insights', label: 'AI Insights', icon: Sparkles },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/admin/production', label: 'Production', icon: Scissors },
      { href: '/admin/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    section: 'Catalogue',
    items: [
      { href: '/admin/products', label: 'Products', icon: Package },
      { href: '/admin/categories', label: 'Categories', icon: FolderTree },
      { href: '/admin/inventory', label: 'Inventory', icon: Boxes, alertCount: true },
    ],
  },
  {
    section: 'Business',
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, soon: true },
      { href: '/admin/reports', label: 'Reports', icon: FileText, soon: true },
    ],
  },
];

/**
 * The admin shell's sidebar (plan Session 1.2, task 4).
 *
 * Obsidian, not indigo. The brand is crimson-on-black; an admin panel in a
 * different palette reads as a different product bolted on. The crimson is used
 * ONLY for the active state and for danger — a red that appears everywhere stops
 * meaning anything.
 *
 * Unbuilt sections are listed and marked "soon" rather than hidden. An owner
 * looking at this should be able to see the shape of the whole system, not just
 * the parts that happen to exist today.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Polled, so the badge appears while the owner is sitting on the dashboard —
  // the moment a sale takes something under its reorder level, without them
  // having to navigate anywhere to find out. Every stock mutation also
  // invalidates this key, so an admin's own adjustment updates it instantly.
  const { data: lowStock } = useLowStock();
  const lowCount = lowStock?.count ?? 0;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#0A0A0A] lg:flex">
      {/* A single gold thread down the right edge. One hairline, the width of the
          sidebar — the whole luxury signal in one pixel. Crimson could not carry
          this on its own, and gold used anywhere else would cheapen it. */}
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#D4AF37]/25 to-transparent"
      />

      {/* Brand */}
      <div className="relative flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#E60000] to-[#A80000] text-sm font-bold text-white shadow-[0_2px_8px_-2px_rgba(204,0,0,0.6)]">
          N
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold tracking-wide text-white">
            Nandana
          </p>
          <p className="text-[9px] uppercase tracking-[0.22em] text-[#D4AF37]/50">
            Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              {group.section}
            </p>

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));
                const Icon = item.icon;

                if (item.soon) {
                  return (
                    <li key={item.href}>
                      <span
                        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-white/25"
                        title="Coming in a later phase"
                      >
                        <Icon size={16} aria-hidden />
                        {item.label}
                        <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/30">
                          Soon
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                        active
                          ? // Not a flat crimson block. A dark tinted surface with
                            // a crimson bar at the leading edge: it marks position
                            // without turning a nav item into a shouting button.
                            'bg-[#CC0000]/[0.14] font-medium text-white'
                          : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[#E60000] shadow-[0_0_8px_rgba(230,0,0,0.7)]"
                        />
                      )}
                      <Icon
                        size={15}
                        strokeWidth={active ? 2 : 1.75}
                        className={active ? 'text-[#FF3333]' : ''}
                        aria-hidden
                      />
                      {item.label}

                      {/* The count is the alert. No bell, no dot, no separate
                          notification centre to go and check — the number that
                          needs reordering sits on the thing you would click to
                          reorder it. It is absent when there is nothing to say,
                          which is what makes it worth looking at when it appears. */}
                      {item.alertCount && lowCount > 0 && (
                        <span
                          className="ml-auto rounded-full bg-[#CC0000] px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none text-white shadow-[0_0_10px_-1px_rgba(204,0,0,0.8)]"
                          aria-label={`${lowCount} products need reordering`}
                        >
                          {lowCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <Link
          href="/"
          className="mb-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Store size={16} aria-hidden />
          View storefront
        </Link>

        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
            {user?.firstName?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium text-white">
              {user?.firstName ?? 'Admin'}
            </p>
            <p className="truncate text-[10px] text-white/40">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
