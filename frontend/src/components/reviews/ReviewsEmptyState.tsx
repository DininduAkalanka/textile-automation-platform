import { MessageSquareText } from 'lucide-react';

export function ReviewsEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200">
        <MessageSquareText className="h-5 w-5 text-neutral-400" aria-hidden />
      </div>
      <p className="text-base font-semibold text-neutral-900">
        {filtered ? 'No reviews match these filters' : 'No reviews yet'}
      </p>
      <p className="max-w-sm text-sm text-neutral-500">
        {filtered
          ? 'Try clearing a filter to see more reviews.'
          : 'Be the first customer to review this product after it arrives.'}
      </p>
    </div>
  );
}
