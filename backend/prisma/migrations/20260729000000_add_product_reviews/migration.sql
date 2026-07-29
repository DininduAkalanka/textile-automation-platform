-- CreateEnum
CREATE TYPE "ReviewSizeFeedback" AS ENUM ('RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- CreateTable
-- Named "product_reviews", not "reviews": an orphaned "reviews" table already
-- exists in this database from a past, never-committed feature (no migration
-- file, no application code references it) — this avoids colliding with it.
CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "fabric_rating" INTEGER NOT NULL,
    "color_accuracy_rating" INTEGER NOT NULL,
    "comfort_rating" INTEGER NOT NULL,
    "size_feedback" "ReviewSizeFeedback" NOT NULL,
    "would_recommend" BOOLEAN NOT NULL,
    "images" JSONB NOT NULL DEFAULT '[]',
    "has_images" BOOLEAN NOT NULL DEFAULT false,
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT true,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_helpful_votes" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_order_id_product_id_user_id_key" ON "product_reviews"("order_id", "product_id", "user_id");

-- CreateIndex
CREATE INDEX "product_reviews_product_id_status_idx" ON "product_reviews"("product_id", "status");

-- CreateIndex
CREATE INDEX "product_reviews_user_id_idx" ON "product_reviews"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_helpful_votes_review_id_user_id_key" ON "review_helpful_votes"("review_id", "user_id");

-- CreateIndex
CREATE INDEX "review_reports_review_id_idx" ON "review_reports"("review_id");

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "product_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "product_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
