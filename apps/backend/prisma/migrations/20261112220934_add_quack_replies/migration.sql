-- AlterTable
ALTER TABLE "quack" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "text" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "quack_parentId_createdAt_idx" ON "quack"("parentId", "createdAt");

-- AddForeignKey
ALTER TABLE "quack" ADD CONSTRAINT "quack_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "quack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: invariants Prisma can't express (docs/adr/0001-deleted-quacks-become-tombstones.md).
-- A tombstone has no text or mood; a live quack always has text.
ALTER TABLE "quack" ADD CONSTRAINT "quack_deleted_has_no_content"
  CHECK (("deletedAt" IS NULL) = ("text" IS NOT NULL) AND ("deletedAt" IS NULL OR "mood" IS NULL));

-- A reply has no mood, is never a tombstone, and doesn't answer itself.
ALTER TABLE "quack" ADD CONSTRAINT "quack_reply_shape"
  CHECK ("parentId" IS NULL OR ("mood" IS NULL AND "deletedAt" IS NULL AND "parentId" <> "id"));
