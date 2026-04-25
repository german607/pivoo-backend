-- CreateEnum
CREATE TYPE "matches"."ParticipantType" AS ENUM ('REGISTERED', 'GUEST');

-- AlterEnum: add INVITED to ParticipantStatus
ALTER TYPE "matches"."ParticipantStatus" ADD VALUE 'INVITED';

-- AlterTable: make user_id nullable, add guest fields and participant_type
ALTER TABLE "matches"."match_participants"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ADD COLUMN "participant_type" "matches"."ParticipantType" NOT NULL DEFAULT 'REGISTERED',
  ADD COLUMN "guest_first_name" TEXT,
  ADD COLUMN "guest_last_name"  TEXT;

-- Drop old composite unique constraint (was covering match_id + user_id)
ALTER TABLE "matches"."match_participants"
  DROP CONSTRAINT IF EXISTS "match_participants_match_id_user_id_key";

-- Partial unique index: one registered user per match (guests have user_id = NULL, excluded)
CREATE UNIQUE INDEX "match_participants_match_id_user_id_unique"
  ON "matches"."match_participants" ("match_id", "user_id")
  WHERE "user_id" IS NOT NULL;
