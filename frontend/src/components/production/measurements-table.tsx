'use client';

import { TaskMeasurements } from '@/types/production';

/** cm keys → the words a tailor uses. Unknown keys fall back to the raw key. */
const FIELD_LABEL: Record<string, string> = {
  chest: 'Chest',
  waist: 'Waist',
  shoulder: 'Shoulder',
  sleeveLength: 'Sleeve length',
  shirtLength: 'Shirt length',
  trouserWaist: 'Trouser waist',
  hip: 'Hip',
  trouserLength: 'Trouser length',
};

/**
 * The BR3 measurements, rendered for someone standing at a cutting table.
 *
 * Big numbers, generous rows, units on every value — this is the one thing on
 * the card that must be readable at arm's length in bad light, because getting
 * it wrong means cutting the cloth twice.
 */
export function MeasurementsTable({
  measurements,
}: {
  measurements: TaskMeasurements | null;
}) {
  if (!measurements) {
    return (
      <p className="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-500">
        No measurements — this item is made to a standard size.
      </p>
    );
  }

  const entries = Object.entries(measurements.values ?? {});

  return (
    <div className="rounded-lg border border-neutral-200">
      <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <p className="text-sm font-semibold text-neutral-900">
          {measurements.personName}
        </p>
        {measurements.label && (
          <p className="text-xs text-neutral-500">{measurements.label}</p>
        )}
      </div>

      <dl className="divide-y divide-neutral-100">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between px-3 py-2"
          >
            <dt className="text-sm text-neutral-600">
              {FIELD_LABEL[key] ?? key}
            </dt>
            <dd className="font-mono text-base font-semibold tabular-nums text-neutral-900">
              {value}
              <span className="ml-1 text-xs font-normal text-neutral-400">
                cm
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
