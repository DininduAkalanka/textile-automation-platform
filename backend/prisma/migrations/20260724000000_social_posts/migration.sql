-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "social_posts" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'PENDING',
    "caption" TEXT NOT NULL,
    "external_post_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_posts_product_id_created_at_idx" ON "social_posts"("product_id", "created_at");

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
