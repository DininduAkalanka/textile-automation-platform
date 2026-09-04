export default function ProductDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8 animate-pulse" aria-busy="true" aria-label="Loading product details">
      {/* Breadcrumb Skeleton */}
      <div className="mb-6 flex items-center gap-2">
        <div className="h-3.5 w-14 rounded bg-neutral-200" />
        <span className="text-neutral-300">/</span>
        <div className="h-3.5 w-20 rounded bg-neutral-200" />
        <span className="text-neutral-300">/</span>
        <div className="h-3.5 w-32 rounded bg-neutral-100" />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
        {/* Left: Gallery Shimmer */}
        <div className="space-y-4">
          <div className="aspect-[3/4] w-full rounded-lg bg-neutral-100 border border-neutral-200" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 w-16 rounded-md bg-neutral-100 border border-neutral-200" />
            ))}
          </div>
        </div>

        {/* Right: Info Shimmer */}
        <div className="flex flex-col space-y-5">
          {/* Category Tag */}
          <div className="h-3.5 w-24 rounded bg-neutral-200" />

          {/* Title */}
          <div className="space-y-2">
            <div className="h-8 w-3/4 rounded bg-neutral-200" />
            <div className="h-8 w-1/2 rounded bg-neutral-200" />
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 rounded bg-neutral-200" />
            <div className="h-4 w-16 rounded bg-neutral-100" />
          </div>

          {/* Price */}
          <div className="flex items-center gap-3 py-2">
            <div className="h-7 w-36 rounded bg-neutral-200" />
            <div className="h-5 w-24 rounded bg-neutral-100" />
          </div>

          {/* Description */}
          <div className="space-y-2 py-2">
            <div className="h-4 w-full rounded bg-neutral-100" />
            <div className="h-4 w-5/6 rounded bg-neutral-100" />
            <div className="h-4 w-4/6 rounded bg-neutral-100" />
          </div>

          {/* Specifications Box */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-12 rounded-lg bg-neutral-100" />
            <div className="h-12 rounded-lg bg-neutral-100" />
          </div>

          {/* Quantity & CTA */}
          <div className="flex gap-4 pt-4">
            <div className="h-12 w-32 rounded-lg bg-neutral-100" />
            <div className="h-12 flex-1 rounded-lg bg-neutral-200" />
          </div>

          {/* Trust Guarantee banner */}
          <div className="h-16 w-full rounded-lg bg-neutral-100 mt-4" />
        </div>
      </div>
    </div>
  );
}
