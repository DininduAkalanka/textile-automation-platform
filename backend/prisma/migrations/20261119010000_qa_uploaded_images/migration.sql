-- QA remediation, Group 1 — P2-15: track every uploaded image.
--
-- Any signed-in customer could upload images without limit, and a review could
-- carry ANY URL as a "photo" (someone else's upload, or an outside site).
-- Each upload is now recorded with its uploader, so that:
--   * a review may only attach photos its own author uploaded;
--   * review uploads have a per-customer daily quota;
--   * review photos never attached to a review are removed after a day.
-- Purely additive: no existing table or row is changed.

CREATE TYPE "UploadPurpose" AS ENUM ('CATALOGUE', 'REVIEW');

CREATE TABLE "uploaded_images" (
    "id"             UUID NOT NULL,
    "filename"       TEXT NOT NULL,
    "uploaded_by_id" UUID,
    "purpose"        "UploadPurpose" NOT NULL,
    "size_bytes"     INTEGER NOT NULL,
    "attached_at"    TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uploaded_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uploaded_images_filename_key" ON "uploaded_images" ("filename");
CREATE INDEX "uploaded_images_uploaded_by_id_purpose_created_at_idx"
  ON "uploaded_images" ("uploaded_by_id", "purpose", "created_at");
CREATE INDEX "uploaded_images_purpose_attached_at_created_at_idx"
  ON "uploaded_images" ("purpose", "attached_at", "created_at");

ALTER TABLE "uploaded_images"
  ADD CONSTRAINT "uploaded_images_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
