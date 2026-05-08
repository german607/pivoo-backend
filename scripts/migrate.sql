-- =============================================================
-- PIVOO — DB MIGRATION
-- Applies incremental changes on top of existing DB state.
-- Safe to run multiple times (idempotent).
--
-- Run with:
--   psql postgresql://pivoo:pivoo_dev@127.0.0.1:5432/pivoo -f scripts/migrate.sql
-- =============================================================

\set ON_ERROR_STOP on

-- =============================================================
-- 1. AUTH SCHEMA
-- =============================================================

-- Rename refresh_token → refresh_token_hash in auth_users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'auth_users' AND column_name = 'refresh_token'
  ) THEN
    ALTER TABLE auth.auth_users RENAME COLUMN refresh_token TO refresh_token_hash;
    RAISE NOTICE 'auth.auth_users: renamed refresh_token → refresh_token_hash';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'auth_users' AND column_name = 'refresh_token_hash'
  ) THEN
    ALTER TABLE auth.auth_users ADD COLUMN refresh_token_hash TEXT;
    RAISE NOTICE 'auth.auth_users: added refresh_token_hash column';
  ELSE
    RAISE NOTICE 'auth.auth_users: refresh_token_hash already exists, skipping';
  END IF;
END $$;

-- Create complex_accounts table
CREATE TABLE IF NOT EXISTS auth.complex_accounts (
  id                 TEXT        PRIMARY KEY,
  email              TEXT        UNIQUE NOT NULL,
  password_hash      TEXT        NOT NULL,
  complex_id         TEXT        NOT NULL,
  refresh_token_hash TEXT,
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 2. COMPLEXES SCHEMA — new enums
-- =============================================================

DO $$ BEGIN CREATE TYPE complexes."TournamentStatus"      AS ENUM ('DRAFT','REGISTRATION_OPEN','IN_PROGRESS','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."TournamentFormat"       AS ENUM ('SINGLE_ELIMINATION','ROUND_ROBIN');                                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."RegistrationStatus"     AS ENUM ('PENDING','APPROVED','REJECTED','WITHDRAWN');                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."TournamentMatchStatus"  AS ENUM ('PENDING','IN_PROGRESS','COMPLETED','BYE');                         EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- 3. COMPLEXES SCHEMA — new tables
-- =============================================================

CREATE TABLE IF NOT EXISTS complexes.tournaments (
  id                    TEXT                          PRIMARY KEY,
  complex_id            TEXT                          NOT NULL REFERENCES complexes.sport_complexes(id),
  name                  TEXT                          NOT NULL,
  sport_id              TEXT                          NOT NULL,
  format                complexes."TournamentFormat"  NOT NULL DEFAULT 'SINGLE_ELIMINATION',
  status                complexes."TournamentStatus"  NOT NULL DEFAULT 'DRAFT',
  max_participants      INT                           NOT NULL,
  registration_deadline TIMESTAMPTZ,
  start_date            TIMESTAMPTZ                   NOT NULL,
  description           TEXT,
  created_at            TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ                   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complexes.tournament_registrations (
  id            TEXT                           PRIMARY KEY,
  tournament_id TEXT                           NOT NULL REFERENCES complexes.tournaments(id) ON DELETE CASCADE,
  user_id       TEXT                           NOT NULL,
  status        complexes."RegistrationStatus" NOT NULL DEFAULT 'PENDING',
  seed          INT,
  registered_at TIMESTAMPTZ                    NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS complexes.tournament_matches (
  id            TEXT                                PRIMARY KEY,
  tournament_id TEXT                                NOT NULL REFERENCES complexes.tournaments(id) ON DELETE CASCADE,
  round         INT                                 NOT NULL,
  match_number  INT                                 NOT NULL,
  player1_id    TEXT,
  player2_id    TEXT,
  winner_id     TEXT,
  status        complexes."TournamentMatchStatus"   NOT NULL DEFAULT 'PENDING',
  sets          JSONB,
  court_id      TEXT,
  scheduled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  UNIQUE(tournament_id, round, match_number)
);

CREATE TABLE IF NOT EXISTS complexes.tournament_ranking_points (
  id            TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES complexes.tournaments(id) ON DELETE CASCADE,
  position      INT  NOT NULL,
  points        INT  NOT NULL,
  UNIQUE(tournament_id, position)
);

CREATE TABLE IF NOT EXISTS complexes.tournament_results (
  id            TEXT        PRIMARY KEY,
  tournament_id TEXT        NOT NULL REFERENCES complexes.tournaments(id) ON DELETE CASCADE,
  user_id       TEXT        NOT NULL,
  position      INT         NOT NULL,
  points        INT         NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- =============================================================
-- 4. AUTH SCHEMA — OAuth support (provider / provider_id)
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'auth_users' AND column_name = 'provider'
  ) THEN
    ALTER TABLE auth.auth_users ADD COLUMN provider TEXT;
    RAISE NOTICE 'auth.auth_users: added provider';
  ELSE
    RAISE NOTICE 'auth.auth_users: provider already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'auth_users' AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE auth.auth_users ADD COLUMN provider_id TEXT;
    RAISE NOTICE 'auth.auth_users: added provider_id';
  ELSE
    RAISE NOTICE 'auth.auth_users: provider_id already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'auth_users' AND column_name = 'password_hash'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE auth.auth_users ALTER COLUMN password_hash DROP NOT NULL;
    RAISE NOTICE 'auth.auth_users: password_hash is now nullable';
  ELSE
    RAISE NOTICE 'auth.auth_users: password_hash already nullable, skipping';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_provider_provider_id_idx
  ON auth.auth_users (provider, provider_id)
  WHERE provider IS NOT NULL AND provider_id IS NOT NULL;

-- =============================================================
-- 5. MATCHES SCHEMA — add missing columns to matches table
-- =============================================================

DO $$ BEGIN CREATE TYPE matches."SkillLevel" AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED','PROFESSIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."Category"   AS ENUM ('PRIMERA','SEGUNDA','TERCERA','CUARTA','QUINTA','SEXTA','SEPTIMA','OCTAVA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."Gender"     AS ENUM ('MASCULINO','FEMENINO','MIXTO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'required_level'
  ) THEN
    ALTER TABLE matches.matches ADD COLUMN required_level matches."SkillLevel";
    RAISE NOTICE 'matches.matches: added required_level';
  ELSE
    RAISE NOTICE 'matches.matches: required_level already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'required_category'
  ) THEN
    ALTER TABLE matches.matches ADD COLUMN required_category matches."Category";
    RAISE NOTICE 'matches.matches: added required_category';
  ELSE
    RAISE NOTICE 'matches.matches: required_category already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'gender'
  ) THEN
    ALTER TABLE matches.matches ADD COLUMN gender matches."Gender";
    RAISE NOTICE 'matches.matches: added gender';
  ELSE
    RAISE NOTICE 'matches.matches: gender already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'complex_name'
  ) THEN
    ALTER TABLE matches.matches ADD COLUMN complex_name TEXT;
    RAISE NOTICE 'matches.matches: added complex_name';
  ELSE
    RAISE NOTICE 'matches.matches: complex_name already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'complex_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE matches.matches ALTER COLUMN complex_id DROP NOT NULL;
    RAISE NOTICE 'matches.matches: complex_id is now nullable';
  ELSE
    RAISE NOTICE 'matches.matches: complex_id already nullable, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'court_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE matches.matches ALTER COLUMN court_id DROP NOT NULL;
    RAISE NOTICE 'matches.matches: court_id is now nullable';
  ELSE
    RAISE NOTICE 'matches.matches: court_id already nullable, skipping';
  END IF;
END $$;

-- =============================================================
-- 6. USERS SCHEMA — category column in user_sport_stats
-- =============================================================

DO $$ BEGIN CREATE TYPE users."Category" AS ENUM ('PRIMERA','SEGUNDA','TERCERA','CUARTA','QUINTA','SEXTA','SEPTIMA','OCTAVA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'users' AND table_name = 'user_sport_stats' AND column_name = 'category'
  ) THEN
    ALTER TABLE users.user_sport_stats ADD COLUMN category users."Category";
    RAISE NOTICE 'users.user_sport_stats: added category';
  ELSE
    RAISE NOTICE 'users.user_sport_stats: category already exists, skipping';
  END IF;
END $$;

-- =============================================================
-- 7. COMPLEXES SCHEMA — country column in sport_complexes
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'complexes' AND table_name = 'sport_complexes' AND column_name = 'country'
  ) THEN
    ALTER TABLE complexes.sport_complexes ADD COLUMN country TEXT;
    RAISE NOTICE 'complexes.sport_complexes: added country';
  ELSE
    RAISE NOTICE 'complexes.sport_complexes: country already exists, skipping';
  END IF;
END $$;

-- =============================================================
-- 8. USERS SCHEMA — identification fields in user_profiles
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'users' AND table_name = 'user_profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE users.user_profiles ADD COLUMN country TEXT;
    RAISE NOTICE 'users.user_profiles: added country';
  ELSE
    RAISE NOTICE 'users.user_profiles: country already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'users' AND table_name = 'user_profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE users.user_profiles ADD COLUMN city TEXT;
    RAISE NOTICE 'users.user_profiles: added city';
  ELSE
    RAISE NOTICE 'users.user_profiles: city already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'users' AND table_name = 'user_profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users.user_profiles ADD COLUMN phone TEXT;
    RAISE NOTICE 'users.user_profiles: added phone';
  ELSE
    RAISE NOTICE 'users.user_profiles: phone already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'users' AND table_name = 'user_profiles' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE users.user_profiles ADD COLUMN birth_date TIMESTAMPTZ;
    RAISE NOTICE 'users.user_profiles: added birth_date';
  ELSE
    RAISE NOTICE 'users.user_profiles: birth_date already exists, skipping';
  END IF;
END $$;

-- =============================================================
-- 9. COMPLEXES SCHEMA — level / category / gender in tournaments
-- =============================================================

DO $$ BEGIN CREATE TYPE complexes."SkillLevel" AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED','PROFESSIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."Category"   AS ENUM ('PRIMERA','SEGUNDA','TERCERA','CUARTA','QUINTA','SEXTA','SEPTIMA','OCTAVA');  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."Gender"     AS ENUM ('MASCULINO','FEMENINO','MIXTO');                                              EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'complexes' AND table_name = 'tournaments' AND column_name = 'level'
  ) THEN
    ALTER TABLE complexes.tournaments ADD COLUMN level complexes."SkillLevel";
    RAISE NOTICE 'complexes.tournaments: added level';
  ELSE
    RAISE NOTICE 'complexes.tournaments: level already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'complexes' AND table_name = 'tournaments' AND column_name = 'category'
  ) THEN
    ALTER TABLE complexes.tournaments ADD COLUMN category complexes."Category";
    RAISE NOTICE 'complexes.tournaments: added category';
  ELSE
    RAISE NOTICE 'complexes.tournaments: category already exists, skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'complexes' AND table_name = 'tournaments' AND column_name = 'gender'
  ) THEN
    ALTER TABLE complexes.tournaments ADD COLUMN gender complexes."Gender";
    RAISE NOTICE 'complexes.tournaments: added gender';
  ELSE
    RAISE NOTICE 'complexes.tournaments: gender already exists, skipping';
  END IF;
END $$;

-- =============================================================
-- 10. MATCHES SCHEMA — country column in matches
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'country'
  ) THEN
    ALTER TABLE matches.matches ADD COLUMN country TEXT;
    RAISE NOTICE 'matches.matches: added country';
  ELSE
    RAISE NOTICE 'matches.matches: country already exists, skipping';
  END IF;
END $$;

-- Backfill country from the linked complex for existing rows
UPDATE matches.matches m
SET country = c.country
FROM complexes.sport_complexes c
WHERE m.complex_id = c.id AND m.country IS NULL;

-- =============================================================
-- 11. USERS SCHEMA — gender column in user_profiles
-- =============================================================

DO $$ BEGIN
  CREATE TYPE users."Gender" AS ENUM ('MASCULINO', 'FEMENINO', 'NO_ESPECIFICADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE users."Gender" ADD VALUE IF NOT EXISTS 'NO_ESPECIFICADO';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'users' AND table_name = 'user_profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE users.user_profiles ADD COLUMN gender users."Gender";
    RAISE NOTICE 'users.user_profiles: added gender';
  ELSE
    RAISE NOTICE 'users.user_profiles: gender already exists, skipping';
  END IF;
END $$;

-- =============================================================
-- SUMMARY
-- =============================================================
DO $$
DECLARE
  has_rth        BOOLEAN;
  has_complex_ac BOOLEAN;
  has_tourns     BOOLEAN;
  has_req_cat    BOOLEAN;
  has_gender     BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'auth_users' AND column_name = 'refresh_token_hash'
  ) INTO has_rth;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'complex_accounts'
  ) INTO has_complex_ac;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'complexes' AND table_name = 'tournaments'
  ) INTO has_tourns;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'required_category'
  ) INTO has_req_cat;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'matches' AND table_name = 'matches' AND column_name = 'gender'
  ) INTO has_gender;
  RAISE NOTICE '✓ Migration done — auth_users.refresh_token_hash: %, complex_accounts: %, tournaments: %, matches.required_category: %, matches.gender: %',
    has_rth, has_complex_ac, has_tourns, has_req_cat, has_gender;
END $$;
