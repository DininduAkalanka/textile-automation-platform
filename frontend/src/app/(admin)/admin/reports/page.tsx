'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, FileSpreadsheet, LineChart, Loader2 } from 'lucide-react';

import { http } from '@/services/http';

/**
 * Downloads a CSV through the axios client (so an expired access token is
 * refreshed and retried, unlike a raw <a download>), then saves the blob with
 * the server-supplied filename.
 */
async function downloadCsv(path: string, fallback: string): Promise<void> {
  const res = await http.get(path, { responseType: 'blob' });
  const blob = res.data as Blob;
  const cd = String(res.headers['content-disposition'] ?? '');
  const match = cd.match(/filename="([^"]+)"/);
  const name = match ? match[1] : fallback;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ReportCard({
  title,
  description,
  icon: Icon,
  onDownload,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onDownload: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await onDownload();
    } catch {
      setError('Could not generate the report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#EAE8E1] bg-white p-6 shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F3EF] text-[#6E6A5E]">
          <Icon size={17} />
        </span>
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-[#0F0F0F]">
            {title}
          </h2>
          <p className="text-[11px] text-[#928E82]">{description}</p>
        </div>
      </div>

      {children}

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0F0F0F] px-3.5 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {busy ? 'Preparing…' : 'Download CSV'}
      </button>
      {error && <p className="mt-2 text-[11px] text-[#A80000]">{error}</p>}
    </div>
  );
}

export default function AdminReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const salesPath = () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString();
    return `/admin/reports/sales.csv${q ? `?${q}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-[#0F0F0F]">
          Reports
        </h1>
        <p className="mt-1 text-[13px] text-[#928E82]">
          Download your sales and stock data as CSV for accounts or a spreadsheet.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportCard
          title="Sales report"
          description="Units sold and revenue per product (paid orders only)."
          icon={FileSpreadsheet}
          onDownload={() => downloadCsv(salesPath(), 'sales.csv')}
        >
          <div className="flex items-end gap-3">
            <label className="flex-1 text-[11px] font-medium text-[#6E6A5E]">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#EAE8E1] px-2.5 py-1.5 text-[12px] text-[#0F0F0F] outline-none focus:border-[#928E82]"
              />
            </label>
            <label className="flex-1 text-[11px] font-medium text-[#6E6A5E]">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#EAE8E1] px-2.5 py-1.5 text-[12px] text-[#0F0F0F] outline-none focus:border-[#928E82]"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-[#928E82]">
            Leave blank for the last 30 days.
          </p>
        </ReportCard>

        <ReportCard
          title="Inventory report"
          description="Current stock snapshot: available, reserved, sellable, low-stock flag."
          icon={FileSpreadsheet}
          onDownload={() => downloadCsv('/admin/reports/inventory.csv', 'inventory.csv')}
        />
      </div>

      <div className="rounded-2xl border border-[#EAE8E1] bg-white p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F3EF] text-[#6E6A5E]">
            <LineChart size={17} />
          </span>
          <div>
            <h2 className="text-[13px] font-semibold text-[#0F0F0F]">
              Looking for forecasts?
            </h2>
            <p className="text-[11px] text-[#928E82]">
              Demand predictions, trends and dead-stock live on the Analytics page.
            </p>
          </div>
          <Link
            href="/admin/analytics"
            className="ml-auto rounded-lg border border-[#EAE8E1] px-3 py-1.5 text-[12px] font-medium text-[#0F0F0F] hover:bg-[#FAF9F6]"
          >
            Open Analytics
          </Link>
        </div>
      </div>
    </div>
  );
}
