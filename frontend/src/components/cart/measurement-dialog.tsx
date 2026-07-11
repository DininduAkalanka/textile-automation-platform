'use client';

import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { MeasurementSet, fieldsFor } from '@/lib/measurements';
import { Product } from '@/types';

interface MeasurementDialogProps {
  product: Product | null;
  existing?: MeasurementSet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (measurements: MeasurementSet) => void;
}

/**
 * BR3 measurement capture (plan Session 3.1, task 3).
 *
 * The field set is generated from the product's type via fieldsFor(), not
 * hardcoded — so a uniform asks for eight measurements and a custom shirt asks
 * for five, and adding a garment type later means editing one config, not this
 * component.
 *
 * Values are held as strings and converted on submit. Binding a number input
 * directly to a number breaks mid-typing (a lone "-" or "" is not a number), so
 * the input owns the text and the form owns the meaning.
 */
export function MeasurementDialog({
  product,
  existing,
  open,
  onOpenChange,
  onSave,
}: MeasurementDialogProps) {
  const fields = fieldsFor(product?.productType);

  type FormValues = {
    personName: string;
    label: string;
    values: Record<string, string>;
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    values: {
      personName: existing?.personName ?? '',
      label: existing?.label ?? '',
      values: Object.fromEntries(
        fields.map((field) => [
          field.key,
          existing?.values?.[field.key] !== undefined
            ? String(existing.values[field.key])
            : '',
        ]),
      ),
    },
  });

  if (!product) return null;

  const onSubmit = (form: FormValues) => {
    const values: Record<string, number> = {};

    for (const field of fields) {
      const raw = form.values?.[field.key];
      const parsed = Number(raw);

      if (raw === '' || Number.isNaN(parsed)) {
        toast.error(`${field.label} is required`);
        return;
      }
      if (parsed < field.min || parsed > field.max) {
        toast.error(
          `${field.label} must be between ${field.min} and ${field.max} cm`,
        );
        return;
      }
      values[field.key] = parsed;
    }

    onSave({
      personName: form.personName.trim(),
      label: form.label?.trim() || undefined,
      values,
    });

    toast.success(`Measurements saved for ${form.personName.trim()}`);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div>
          <DialogTitle>Measurements — {product.name}</DialogTitle>
          <DialogDescription className="mt-1">
            All measurements in centimetres. We stitch to these exactly, so please
            double-check them.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            label="Who is this for?"
            placeholder="e.g. Nimal Perera"
            error={errors.personName?.message}
            {...register('personName', { required: 'A name is required' })}
          />

          <FormField
            label="Label (optional)"
            placeholder="e.g. Son — Grade 5"
            {...register('label')}
          />

          <div className="grid grid-cols-2 gap-3">
            {fields.map((field) => (
              <FormField
                key={field.key}
                label={`${field.label} (cm)`}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={field.min}
                max={field.max}
                placeholder={`${field.min}–${field.max}`}
                {...register(`values.${field.key}` as const)}
              />
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save measurements
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
