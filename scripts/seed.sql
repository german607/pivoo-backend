-- =============================================================
-- PIVOO — TEST DATA SEED
-- Password for all users/complex-accounts: password123
-- Hash: $2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny
--
-- Run with:
--   psql postgresql://postgres:admin123@127.0.0.1:5432/pivoo -f scripts/seed.sql
-- Safe to run multiple times (ON CONFLICT DO NOTHING everywhere)
-- =============================================================

\set ON_ERROR_STOP on

-- =============================================================
-- 1. SCHEMAS
-- =============================================================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS sports;
CREATE SCHEMA IF NOT EXISTS complexes;
CREATE SCHEMA IF NOT EXISTS matches;
CREATE SCHEMA IF NOT EXISTS teams;

-- =============================================================
-- 2. ENUMS
-- =============================================================
DO $$ BEGIN CREATE TYPE users."SkillLevel"            AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED','PROFESSIONAL');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sports."SportName"             AS ENUM ('TENNIS','PADEL');                                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."MatchStatus"          AS ENUM ('OPEN','FULL','IN_PROGRESS','COMPLETED','CANCELLED');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."ParticipantStatus"    AS ENUM ('PENDING','INVITED','APPROVED','REJECTED');              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."ParticipantType"      AS ENUM ('REGISTERED','GUEST');                                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."Team"                 AS ENUM ('TEAM_A','TEAM_B');                                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."SkillLevel"           AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED','PROFESSIONAL');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE teams."TeamInviteStatus"       AS ENUM ('PENDING','ACCEPTED','REJECTED');                        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."TournamentStatus"   AS ENUM ('DRAFT','REGISTRATION_OPEN','IN_PROGRESS','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."TournamentFormat"   AS ENUM ('SINGLE_ELIMINATION','ROUND_ROBIN');                     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."RegistrationStatus" AS ENUM ('PENDING','APPROVED','REJECTED','WITHDRAWN');            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complexes."TournamentMatchStatus" AS ENUM ('PENDING','IN_PROGRESS','COMPLETED','BYE');           EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE matches."ParticipantStatus" ADD VALUE IF NOT EXISTS 'INVITED'; EXCEPTION WHEN others THEN NULL; END $$;

-- =============================================================
-- 3. TABLES
-- =============================================================

-- ── auth ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.auth_users (
  id                 TEXT        PRIMARY KEY,
  email              TEXT        UNIQUE NOT NULL,
  password_hash      TEXT        NOT NULL,
  refresh_token_hash TEXT,
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- ── users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users.user_profiles (
  id         TEXT        PRIMARY KEY,
  email      TEXT        UNIQUE NOT NULL,
  username   TEXT        UNIQUE NOT NULL,
  name       TEXT        NOT NULL,
  avatar_url TEXT,
  bio        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users.user_sport_stats (
  id             TEXT               PRIMARY KEY,
  user_id        TEXT               NOT NULL REFERENCES users.user_profiles(id) ON DELETE CASCADE,
  sport_id       TEXT               NOT NULL,
  matches_played INT                NOT NULL DEFAULT 0,
  matches_won    INT                NOT NULL DEFAULT 0,
  ranking_points INT                NOT NULL DEFAULT 1000,
  level          users."SkillLevel" NOT NULL DEFAULT 'BEGINNER',
  updated_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sport_id)
);

-- ── sports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sports.sports (
  id          TEXT               PRIMARY KEY,
  name        sports."SportName" UNIQUE NOT NULL,
  min_players INT                NOT NULL,
  max_players INT                NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ── complexes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complexes.sport_complexes (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  address    TEXT        NOT NULL,
  city       TEXT        NOT NULL,
  latitude   DECIMAL(10,8),
  longitude  DECIMAL(11,8),
  phone      TEXT,
  website    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complexes.courts (
  id         TEXT    PRIMARY KEY,
  complex_id TEXT    NOT NULL REFERENCES complexes.sport_complexes(id) ON DELETE CASCADE,
  sport_id   TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  indoor     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS complexes.tournaments (
  id                    TEXT                        PRIMARY KEY,
  complex_id            TEXT                        NOT NULL REFERENCES complexes.sport_complexes(id),
  name                  TEXT                        NOT NULL,
  sport_id              TEXT                        NOT NULL,
  format                complexes."TournamentFormat"  NOT NULL DEFAULT 'SINGLE_ELIMINATION',
  status                complexes."TournamentStatus"  NOT NULL DEFAULT 'DRAFT',
  max_participants      INT                         NOT NULL,
  registration_deadline TIMESTAMPTZ,
  start_date            TIMESTAMPTZ                 NOT NULL,
  description           TEXT,
  created_at            TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complexes.tournament_registrations (
  id            TEXT                          PRIMARY KEY,
  tournament_id TEXT                          NOT NULL REFERENCES complexes.tournaments(id) ON DELETE CASCADE,
  user_id       TEXT                          NOT NULL,
  status        complexes."RegistrationStatus" NOT NULL DEFAULT 'PENDING',
  seed          INT,
  registered_at TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS complexes.tournament_matches (
  id            TEXT                             PRIMARY KEY,
  tournament_id TEXT                             NOT NULL REFERENCES complexes.tournaments(id) ON DELETE CASCADE,
  round         INT                              NOT NULL,
  match_number  INT                              NOT NULL,
  player1_id    TEXT,
  player2_id    TEXT,
  winner_id     TEXT,
  status        complexes."TournamentMatchStatus" NOT NULL DEFAULT 'PENDING',
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

-- ── matches ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches.matches (
  id             TEXT                  PRIMARY KEY,
  sport_id       TEXT                  NOT NULL,
  complex_id     TEXT                  NOT NULL,
  court_id       TEXT                  NOT NULL,
  admin_user_id  TEXT                  NOT NULL,
  scheduled_at   TIMESTAMPTZ           NOT NULL,
  max_players    INT                   NOT NULL,
  min_players    INT                   NOT NULL,
  required_level matches."SkillLevel",
  status         matches."MatchStatus" NOT NULL DEFAULT 'OPEN',
  description    TEXT,
  created_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches.match_participants (
  id               TEXT                        PRIMARY KEY,
  match_id         TEXT                        NOT NULL REFERENCES matches.matches(id) ON DELETE CASCADE,
  user_id          TEXT,
  participant_type matches."ParticipantType"    NOT NULL DEFAULT 'REGISTERED',
  guest_first_name TEXT,
  guest_last_name  TEXT,
  status           matches."ParticipantStatus" NOT NULL DEFAULT 'PENDING',
  team             matches."Team",
  joined_at        TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS match_participants_match_id_user_id_unique
  ON matches.match_participants (match_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS matches.match_results (
  id          TEXT           PRIMARY KEY,
  match_id    TEXT           UNIQUE NOT NULL REFERENCES matches.matches(id) ON DELETE CASCADE,
  sets        JSONB          NOT NULL,
  winner_team matches."Team" NOT NULL,
  recorded_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── teams ─────────────────────────────────────────────────────
-- Max 2 members per team (doubles pairs — tennis / padel)
-- Both members have equal rights: either can invite, edit, kick or disband
CREATE TABLE IF NOT EXISTS teams.teams (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  sport_id   TEXT,
  color      TEXT        NOT NULL DEFAULT '#14B8A6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams.team_members (
  id        TEXT        PRIMARY KEY,
  team_id   TEXT        NOT NULL REFERENCES teams.teams(id) ON DELETE CASCADE,
  user_id   TEXT        NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS teams.team_invitations (
  id                 TEXT                     PRIMARY KEY,
  team_id            TEXT                     NOT NULL REFERENCES teams.teams(id) ON DELETE CASCADE,
  invited_user_id    TEXT                     NOT NULL,
  invited_by_user_id TEXT                     NOT NULL,
  status             teams."TeamInviteStatus" NOT NULL DEFAULT 'PENDING',
  created_at         TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, invited_user_id)
);

-- =============================================================
-- 4. SEED DATA
-- =============================================================

-- ── Auth users (password: password123) ───────────────────────
-- updated_at is explicit because Prisma manages @updatedAt without DB-level DEFAULT
INSERT INTO auth.auth_users (id, email, password_hash, is_active, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@pivoo.com',  '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny', TRUE, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'bob@pivoo.com',    '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny', TRUE, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'carlos@pivoo.com', '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny', TRUE, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'diana@pivoo.com',  '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny', TRUE, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', 'elena@pivoo.com',  '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny', TRUE, NOW(), NOW()),
  ('66666666-6666-6666-6666-666666666666', 'frank@pivoo.com',  '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny', TRUE, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ── Complex accounts (password: password123) ─────────────────
-- One admin per complex. Login via POST /auth/complex/login
INSERT INTO auth.complex_accounts (id, email, password_hash, complex_id, is_active, created_at, updated_at) VALUES
  ('ca000001-0000-0000-0000-000000000001', 'admin@sportclublaspalmas.com', '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny', 'bb000001-0000-0000-0000-000000000001', TRUE, NOW(), NOW()),
  ('ca000002-0000-0000-0000-000000000002', 'admin@padelnorte.com',         '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny', 'bb000002-0000-0000-0000-000000000002', TRUE, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ── User profiles ─────────────────────────────────────────────
INSERT INTO users.user_profiles (id, email, username, name, bio, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@pivoo.com',  'alice',  'Alice García',    'Tenista apasionada. Jugando desde los 12 años.',        NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'bob@pivoo.com',    'bob',    'Bob Martínez',    'Padelero de los domingos, tenis los viernes.',           NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'carlos@pivoo.com', 'carlos', 'Carlos López',    'Polideportivo, juego cualquier cosa.',                   NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'diana@pivoo.com',  'diana',  'Diana Sánchez',   'Empezando en el tenis, me encanta el deporte.',          NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', 'elena@pivoo.com',  'elena',  'Elena Rodríguez', 'Padelera competitiva, top 50 ranking local.',            NOW(), NOW()),
  ('66666666-6666-6666-6666-666666666666', 'frank@pivoo.com',  'frank',  'Frank Jiménez',   'Ex-profesional de tenis. Ahora entreno y compito localmente.', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ── Sports ────────────────────────────────────────────────────
INSERT INTO sports.sports (id, name, min_players, max_players, description) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'TENNIS', 2, 4, 'Tenis individual o dobles'),
  ('aaaa0002-0000-0000-0000-000000000002', 'PADEL',  4, 4, 'Pádel dobles obligatorio')
ON CONFLICT DO NOTHING;

-- ── User sport stats ──────────────────────────────────────────
-- Updated to reflect tournament wins in addition to regular matches
INSERT INTO users.user_sport_stats (id, user_id, sport_id, matches_played, matches_won, ranking_points, level, updated_at) VALUES
  -- Tennis
  ('aa000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaa0001-0000-0000-0000-000000000001', 5, 5, 1420, 'ADVANCED',      NOW()),  -- alice:  ganó el torneo (3 partidos) + 2 amistosos
  ('aa000002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'aaaa0001-0000-0000-0000-000000000001', 3, 0,  840, 'INTERMEDIATE',  NOW()),  -- carlos: 3 jugados, 0 ganados
  ('aa000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'aaaa0001-0000-0000-0000-000000000001', 2, 0,  940, 'BEGINNER',      NOW()),  -- diana:  2 jugados, 0 ganados
  ('aa000004-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666666', 'aaaa0001-0000-0000-0000-000000000001', 5, 3, 1240, 'PROFESSIONAL',  NOW()),  -- frank:  llegó a la final del torneo
  -- Padel
  ('aa000005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'aaaa0002-0000-0000-0000-000000000002', 4, 3, 1200, 'INTERMEDIATE',  NOW()),  -- bob:    2 amistosos + 2 rondas de torneo ganadas
  ('aa000006-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'aaaa0002-0000-0000-0000-000000000002', 3, 0,  890, 'INTERMEDIATE',  NOW()),  -- carlos: 1 amistoso + 2 rondas torneo perdidas
  ('aa000007-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444', 'aaaa0002-0000-0000-0000-000000000002', 4, 0,  860, 'BEGINNER',      NOW()),  -- diana:  2 amistosos + 2 rondas torneo perdidas
  ('aa000008-0000-0000-0000-000000000008', '55555555-5555-5555-5555-555555555555', 'aaaa0002-0000-0000-0000-000000000002', 4, 4, 1300, 'ADVANCED',      NOW()),  -- elena:  2 amistosos + 2 rondas torneo ganadas
  ('aa000009-0000-0000-0000-000000000009', '66666666-6666-6666-6666-666666666666', 'aaaa0002-0000-0000-0000-000000000002', 1, 0,  950, 'INTERMEDIATE',  NOW())   -- frank:  1 amistoso, 0 ganados
ON CONFLICT DO NOTHING;

-- ── Complexes ─────────────────────────────────────────────────
INSERT INTO complexes.sport_complexes (id, name, address, city, latitude, longitude, phone, website, created_at, updated_at) VALUES
  ('bb000001-0000-0000-0000-000000000001', 'SportClub Las Palmas',  'Calle del Deporte 15', 'Madrid', 40.41650000, -3.70360000, '+34 91 234 5678', 'https://sportclublaspalmas.es', NOW(), NOW()),
  ('bb000002-0000-0000-0000-000000000002', 'Centro de Pádel Norte', 'Avenida Norte 88',     'Madrid', 40.46200000, -3.69150000, '+34 91 876 5432', NULL,                            NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ── Courts ────────────────────────────────────────────────────
INSERT INTO complexes.courts (id, complex_id, sport_id, name, indoor, is_active) VALUES
  ('cc000001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'Pista Tenis 1', TRUE,  TRUE),
  ('cc000002-0000-0000-0000-000000000002', 'bb000001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'Pista Tenis 2', FALSE, TRUE),
  ('cc000003-0000-0000-0000-000000000003', 'bb000002-0000-0000-0000-000000000002', 'aaaa0002-0000-0000-0000-000000000002', 'Pista Pádel 1', TRUE,  TRUE),
  ('cc000004-0000-0000-0000-000000000004', 'bb000002-0000-0000-0000-000000000002', 'aaaa0002-0000-0000-0000-000000000002', 'Pista Pádel 2', FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- =============================================================
-- TORNEO 1 — Copa Primavera de Tenis (COMPLETED)
-- Complex: SportClub Las Palmas
-- Format:  SINGLE_ELIMINATION, 4 jugadores
-- Bracket (seed pairs 4→ [0v3, 1v2]):
--   R1M1: alice (seed 1) vs diana  (seed 4) → alice gana 6-3 6-2
--   R1M2: frank (seed 2) vs carlos (seed 3) → frank gana 6-4 7-5
--   R2M1 (Final): alice vs frank            → alice gana 6-4 6-3
-- Ranking: 1º=100pts, 2º=60pts, 3º=30pts, 4º=15pts
-- =============================================================

INSERT INTO complexes.tournaments (id, complex_id, name, sport_id, format, status, max_participants, registration_deadline, start_date, description, created_at, updated_at) VALUES
  ('tt000001-0000-0000-0000-000000000001',
   'bb000001-0000-0000-0000-000000000001',
   'Copa Primavera de Tenis 2026',
   'aaaa0001-0000-0000-0000-000000000001',
   'SINGLE_ELIMINATION', 'COMPLETED', 8,
   '2026-03-25 23:59:00+00',
   '2026-04-05 09:00:00+00',
   'Torneo de tenis individual de primavera. Eliminación directa, 4 participantes.',
   NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO complexes.tournament_registrations (id, tournament_id, user_id, status, seed) VALUES
  ('tr000001-0000-0000-0000-000000000001', 'tt000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'APPROVED', 1),  -- alice
  ('tr000002-0000-0000-0000-000000000002', 'tt000001-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'APPROVED', 2),  -- frank
  ('tr000003-0000-0000-0000-000000000003', 'tt000001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'APPROVED', 3),  -- carlos
  ('tr000004-0000-0000-0000-000000000004', 'tt000001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'APPROVED', 4)   -- diana
ON CONFLICT DO NOTHING;

INSERT INTO complexes.tournament_matches (id, tournament_id, round, match_number, player1_id, player2_id, winner_id, status, sets, court_id, scheduled_at, completed_at) VALUES
  -- R1M1: alice vs diana → alice wins
  ('tm000001-0000-0000-0000-000000000001', 'tt000001-0000-0000-0000-000000000001', 1, 1,
   '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   '11111111-1111-1111-1111-111111111111', 'COMPLETED',
   '[{"player1": "6", "player2": "3"}, {"player1": "6", "player2": "2"}]',
   'cc000001-0000-0000-0000-000000000001', '2026-04-05 09:00:00+00', '2026-04-05 10:05:00+00'),
  -- R1M2: frank vs carlos → frank wins
  ('tm000002-0000-0000-0000-000000000002', 'tt000001-0000-0000-0000-000000000001', 1, 2,
   '66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333',
   '66666666-6666-6666-6666-666666666666', 'COMPLETED',
   '[{"player1": "6", "player2": "4"}, {"player1": "7", "player2": "5"}]',
   'cc000002-0000-0000-0000-000000000002', '2026-04-05 09:00:00+00', '2026-04-05 10:20:00+00'),
  -- R2M1 (Final): alice vs frank → alice wins
  ('tm000003-0000-0000-0000-000000000003', 'tt000001-0000-0000-0000-000000000001', 2, 1,
   '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666',
   '11111111-1111-1111-1111-111111111111', 'COMPLETED',
   '[{"player1": "6", "player2": "4"}, {"player1": "6", "player2": "3"}]',
   'cc000001-0000-0000-0000-000000000001', '2026-04-05 11:00:00+00', '2026-04-05 12:10:00+00')
ON CONFLICT DO NOTHING;

INSERT INTO complexes.tournament_ranking_points (id, tournament_id, position, points) VALUES
  ('tp000001-0000-0000-0000-000000000001', 'tt000001-0000-0000-0000-000000000001', 1, 100),
  ('tp000002-0000-0000-0000-000000000002', 'tt000001-0000-0000-0000-000000000001', 2,  60),
  ('tp000003-0000-0000-0000-000000000003', 'tt000001-0000-0000-0000-000000000001', 3,  30),
  ('tp000004-0000-0000-0000-000000000004', 'tt000001-0000-0000-0000-000000000001', 4,  15)
ON CONFLICT DO NOTHING;

INSERT INTO complexes.tournament_results (id, tournament_id, user_id, position, points) VALUES
  ('tres0001-0000-0000-0000-000000000001', 'tt000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 100),  -- alice  → 1°
  ('tres0002-0000-0000-0000-000000000002', 'tt000001-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 2,  60),  -- frank  → 2°
  ('tres0003-0000-0000-0000-000000000003', 'tt000001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 3,  30),  -- diana  → 3° (perdió en R1 vs alice)
  ('tres0004-0000-0000-0000-000000000004', 'tt000001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 4,  15)   -- carlos → 4° (perdió en R1 vs frank)
ON CONFLICT DO NOTHING;

-- =============================================================
-- TORNEO 2 — Torneo Pádel Verano (IN_PROGRESS)
-- Complex: Centro de Pádel Norte
-- Format:  ROUND_ROBIN, 4 jugadores
-- Rotation schedule (circle method, player[0] fixed):
--   R1M1: elena vs diana   R1M2: bob vs carlos
--   R2M1: elena vs carlos  R2M2: diana vs bob
--   R3M1: elena vs bob     R3M2: carlos vs diana  ← pendientes
-- Tras 2 rondas: elena 2W, bob 2W, carlos 0W, diana 0W
-- =============================================================

INSERT INTO complexes.tournaments (id, complex_id, name, sport_id, format, status, max_participants, registration_deadline, start_date, description, created_at, updated_at) VALUES
  ('tt000002-0000-0000-0000-000000000002',
   'bb000002-0000-0000-0000-000000000002',
   'Torneo Pádel Verano 2026',
   'aaaa0002-0000-0000-0000-000000000002',
   'ROUND_ROBIN', 'IN_PROGRESS', 8,
   '2026-05-01 23:59:00+00',
   '2026-05-10 10:00:00+00',
   'Torneo de pádel de verano en formato todos contra todos. 4 participantes, 3 rondas.',
   NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO complexes.tournament_registrations (id, tournament_id, user_id, status, seed) VALUES
  ('tr000005-0000-0000-0000-000000000005', 'tt000002-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'APPROVED', 1),  -- elena
  ('tr000006-0000-0000-0000-000000000006', 'tt000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'APPROVED', 2),  -- bob
  ('tr000007-0000-0000-0000-000000000007', 'tt000002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'APPROVED', 3),  -- carlos
  ('tr000008-0000-0000-0000-000000000008', 'tt000002-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'APPROVED', 4)   -- diana
ON CONFLICT DO NOTHING;

INSERT INTO complexes.tournament_matches (id, tournament_id, round, match_number, player1_id, player2_id, winner_id, status, sets, court_id, scheduled_at, completed_at) VALUES
  -- R1M1: elena vs diana → elena gana
  ('tm000004-0000-0000-0000-000000000004', 'tt000002-0000-0000-0000-000000000002', 1, 1,
   '55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
   '55555555-5555-5555-5555-555555555555', 'COMPLETED',
   '[{"player1": "6", "player2": "2"}, {"player1": "6", "player2": "1"}]',
   'cc000003-0000-0000-0000-000000000003', '2026-05-10 10:00:00+00', '2026-05-10 10:55:00+00'),
  -- R1M2: bob vs carlos → bob gana
  ('tm000005-0000-0000-0000-000000000005', 'tt000002-0000-0000-0000-000000000002', 1, 2,
   '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'COMPLETED',
   '[{"player1": "6", "player2": "4"}, {"player1": "7", "player2": "5"}]',
   'cc000004-0000-0000-0000-000000000004', '2026-05-10 10:00:00+00', '2026-05-10 11:15:00+00'),
  -- R2M1: elena vs carlos → elena gana
  ('tm000006-0000-0000-0000-000000000006', 'tt000002-0000-0000-0000-000000000002', 2, 1,
   '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555555', 'COMPLETED',
   '[{"player1": "6", "player2": "3"}, {"player1": "6", "player2": "4"}]',
   'cc000003-0000-0000-0000-000000000003', '2026-05-10 12:00:00+00', '2026-05-10 12:50:00+00'),
  -- R2M2: diana vs bob → bob gana
  ('tm000007-0000-0000-0000-000000000007', 'tt000002-0000-0000-0000-000000000002', 2, 2,
   '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', 'COMPLETED',
   '[{"player1": "0", "player2": "6"}, {"player1": "2", "player2": "6"}]',
   'cc000004-0000-0000-0000-000000000004', '2026-05-10 12:00:00+00', '2026-05-10 12:45:00+00'),
  -- R3M1: elena vs bob → PENDIENTE (la gran final de la liga)
  ('tm000008-0000-0000-0000-000000000008', 'tt000002-0000-0000-0000-000000000002', 3, 1,
   '55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222',
   NULL, 'PENDING', NULL,
   'cc000003-0000-0000-0000-000000000003', '2026-05-17 10:00:00+00', NULL),
  -- R3M2: carlos vs diana → PENDIENTE
  ('tm000009-0000-0000-0000-000000000009', 'tt000002-0000-0000-0000-000000000002', 3, 2,
   '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
   NULL, 'PENDING', NULL,
   'cc000004-0000-0000-0000-000000000004', '2026-05-17 10:00:00+00', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO complexes.tournament_ranking_points (id, tournament_id, position, points) VALUES
  ('tp000005-0000-0000-0000-000000000005', 'tt000002-0000-0000-0000-000000000002', 1, 150),
  ('tp000006-0000-0000-0000-000000000006', 'tt000002-0000-0000-0000-000000000002', 2,  90),
  ('tp000007-0000-0000-0000-000000000007', 'tt000002-0000-0000-0000-000000000002', 3,  40),
  ('tp000008-0000-0000-0000-000000000008', 'tt000002-0000-0000-0000-000000000002', 4,  10)
ON CONFLICT DO NOTHING;

-- =============================================================
-- TORNEO 3 — Open de Otoño (REGISTRATION_OPEN)
-- Complex: SportClub Las Palmas
-- Format:  SINGLE_ELIMINATION
-- Estado:  abierto a inscripciones — alice ya anotada, diana pendiente
-- =============================================================

INSERT INTO complexes.tournaments (id, complex_id, name, sport_id, format, status, max_participants, registration_deadline, start_date, description, created_at, updated_at) VALUES
  ('tt000003-0000-0000-0000-000000000003',
   'bb000001-0000-0000-0000-000000000001',
   'Open de Otoño de Tenis 2026',
   'aaaa0001-0000-0000-0000-000000000001',
   'SINGLE_ELIMINATION', 'REGISTRATION_OPEN', 8,
   '2026-09-20 23:59:00+00',
   '2026-09-27 09:00:00+00',
   'Torneo de otoño, hasta 8 jugadores. ¡Inscríbete!',
   NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO complexes.tournament_registrations (id, tournament_id, user_id, status, seed) VALUES
  ('tr000009-0000-0000-0000-000000000009', 'tt000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'APPROVED', NULL), -- alice: aprobada
  ('tr000010-0000-0000-0000-000000000010', 'tt000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'PENDING',  NULL)  -- diana: pendiente
ON CONFLICT DO NOTHING;

-- =============================================================
-- PARTIDOS AMISTOSOS
-- =============================================================

-- M1: Singles tenis — frank (A) vs alice (B) → gana alice (TEAM_B)
-- M2: Dobles tenis — alice+frank (A) vs carlos+diana (B) → gana TEAM_A
-- M3: Pádel — elena+bob (A) vs carlos+diana (B) → gana TEAM_A
-- M4: Dobles tenis — alice+frank (A) vs carlos+invitado (B) → gana TEAM_A
-- M5: Pádel — elena+bob (A) vs frank+diana (B) → gana TEAM_A
-- M6: OPEN tenis — frank busca compañeros (2026-05-05)
-- M7: OPEN pádel — elena busca cuatro (2026-05-08)

INSERT INTO matches.matches (id, sport_id, complex_id, court_id, admin_user_id, scheduled_at, max_players, min_players, status, description, created_at, updated_at) VALUES
  ('dd000001-0000-0000-0000-000000000001',
   'aaaa0001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001',
   '66666666-6666-6666-6666-666666666666', '2026-03-10 10:00:00+00', 2, 2, 'COMPLETED', 'Individuales de tenis',               NOW(), NOW()),
  ('dd000002-0000-0000-0000-000000000002',
   'aaaa0001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'cc000002-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', '2026-03-20 16:00:00+00', 4, 4, 'COMPLETED', 'Dobles tenis amistoso',               NOW(), NOW()),
  ('dd000003-0000-0000-0000-000000000003',
   'aaaa0002-0000-0000-0000-000000000002', 'bb000002-0000-0000-0000-000000000002', 'cc000003-0000-0000-0000-000000000003',
   '55555555-5555-5555-5555-555555555555', '2026-04-01 18:00:00+00', 4, 4, 'COMPLETED', 'Pádel dobles competitivo',            NOW(), NOW()),
  ('dd000004-0000-0000-0000-000000000004',
   'aaaa0001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', '2026-04-10 11:00:00+00', 4, 2, 'COMPLETED', 'Dobles tenis con jugador invitado',   NOW(), NOW()),
  ('dd000005-0000-0000-0000-000000000005',
   'aaaa0002-0000-0000-0000-000000000002', 'bb000002-0000-0000-0000-000000000002', 'cc000004-0000-0000-0000-000000000004',
   '55555555-5555-5555-5555-555555555555', '2026-04-15 17:00:00+00', 4, 4, 'COMPLETED', 'Revancha de pádel',                  NOW(), NOW()),
  ('dd000006-0000-0000-0000-000000000006',
   'aaaa0001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'cc000002-0000-0000-0000-000000000002',
   '66666666-6666-6666-6666-666666666666', '2026-05-05 09:00:00+00', 4, 2, 'OPEN',      'Buscando compañeros para dobles de tenis', NOW(), NOW()),
  ('dd000007-0000-0000-0000-000000000007',
   'aaaa0002-0000-0000-0000-000000000002', 'bb000002-0000-0000-0000-000000000002', 'cc000003-0000-0000-0000-000000000003',
   '55555555-5555-5555-5555-555555555555', '2026-05-08 19:00:00+00', 4, 4, 'OPEN',      'Pádel nocturno — nivel medio-alto',  NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ── Match participants ────────────────────────────────────────

-- M1: frank (TEAM_A) vs alice (TEAM_B)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000001-0000-0000-0000-000000000001', 'dd000001-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000002-0000-0000-0000-000000000002', 'dd000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'REGISTERED', 'APPROVED', 'TEAM_B')
ON CONFLICT DO NOTHING;

-- M2: alice+frank (TEAM_A) vs carlos+diana (TEAM_B)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000003-0000-0000-0000-000000000003', 'dd000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000004-0000-0000-0000-000000000004', 'dd000002-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666666', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000005-0000-0000-0000-000000000005', 'dd000002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'REGISTERED', 'APPROVED', 'TEAM_B'),
  ('pp000006-0000-0000-0000-000000000006', 'dd000002-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'REGISTERED', 'APPROVED', 'TEAM_B')
ON CONFLICT DO NOTHING;

-- M3: elena+bob (TEAM_A) vs carlos+diana (TEAM_B)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000007-0000-0000-0000-000000000007', 'dd000003-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000008-0000-0000-0000-000000000008', 'dd000003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000009-0000-0000-0000-000000000009', 'dd000003-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'REGISTERED', 'APPROVED', 'TEAM_B'),
  ('pp000010-0000-0000-0000-000000000010', 'dd000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'REGISTERED', 'APPROVED', 'TEAM_B')
ON CONFLICT DO NOTHING;

-- M4: alice+frank (TEAM_A) vs carlos+guest Javier Torres (TEAM_B)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000011-0000-0000-0000-000000000011', 'dd000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000012-0000-0000-0000-000000000012', 'dd000004-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666666', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000013-0000-0000-0000-000000000013', 'dd000004-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'REGISTERED', 'APPROVED', 'TEAM_B')
ON CONFLICT DO NOTHING;
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, guest_first_name, guest_last_name, status, team) VALUES
  ('pp000014-0000-0000-0000-000000000014', 'dd000004-0000-0000-0000-000000000004', NULL, 'GUEST', 'Javier', 'Torres', 'APPROVED', 'TEAM_B')
ON CONFLICT DO NOTHING;

-- M5: elena+bob (TEAM_A) vs frank+diana (TEAM_B)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000015-0000-0000-0000-000000000015', 'dd000005-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000016-0000-0000-0000-000000000016', 'dd000005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'REGISTERED', 'APPROVED', 'TEAM_A'),
  ('pp000017-0000-0000-0000-000000000017', 'dd000005-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666666', 'REGISTERED', 'APPROVED', 'TEAM_B'),
  ('pp000018-0000-0000-0000-000000000018', 'dd000005-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'REGISTERED', 'APPROVED', 'TEAM_B')
ON CONFLICT DO NOTHING;

-- M6: Open tenis — frank (admin/aprobado), bob (pendiente)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000019-0000-0000-0000-000000000019', 'dd000006-0000-0000-0000-000000000006', '66666666-6666-6666-6666-666666666666', 'REGISTERED', 'APPROVED', NULL),
  ('pp000020-0000-0000-0000-000000000020', 'dd000006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'REGISTERED', 'PENDING',  NULL)
ON CONFLICT DO NOTHING;

-- M7: Open pádel — elena (admin/aprobada), alice (pendiente)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000021-0000-0000-0000-000000000021', 'dd000007-0000-0000-0000-000000000007', '55555555-5555-5555-5555-555555555555', 'REGISTERED', 'APPROVED', NULL),
  ('pp000022-0000-0000-0000-000000000022', 'dd000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'REGISTERED', 'PENDING',  NULL)
ON CONFLICT DO NOTHING;

-- ── Match results ─────────────────────────────────────────────
INSERT INTO matches.match_results (id, match_id, sets, winner_team) VALUES
  ('rr000001-0000-0000-0000-000000000001', 'dd000001-0000-0000-0000-000000000001',
   '[{"teamA": 4, "teamB": 6}, {"teamA": 3, "teamB": 6}]', 'TEAM_B'),
  ('rr000002-0000-0000-0000-000000000002', 'dd000002-0000-0000-0000-000000000002',
   '[{"teamA": 6, "teamB": 2}, {"teamA": 6, "teamB": 4}]', 'TEAM_A'),
  ('rr000003-0000-0000-0000-000000000003', 'dd000003-0000-0000-0000-000000000003',
   '[{"teamA": 6, "teamB": 3}, {"teamA": 6, "teamB": 1}]', 'TEAM_A'),
  ('rr000004-0000-0000-0000-000000000004', 'dd000004-0000-0000-0000-000000000004',
   '[{"teamA": 7, "teamB": 5}, {"teamA": 6, "teamB": 3}]', 'TEAM_A'),
  ('rr000005-0000-0000-0000-000000000005', 'dd000005-0000-0000-0000-000000000005',
   '[{"teamA": 6, "teamB": 4}, {"teamA": 7, "teamB": 6}]', 'TEAM_A')
ON CONFLICT DO NOTHING;

-- ── Teams (max 2 miembros — parejas de dobles) ───────────────────
-- Los Ases: alice + frank (pareja de tenis)
-- Pádel Sharks: elena + bob (pareja de pádel)
-- Ases Solitarios: carlos solo (buscando compañero — 1 invite pendiente a diana)
INSERT INTO teams.teams (id, name, sport_id, color, created_at, updated_at) VALUES
  ('ee000001-0000-0000-0000-000000000001', 'Los Ases',        'aaaa0001-0000-0000-0000-000000000001', '#14B8A6', NOW(), NOW()),
  ('ee000002-0000-0000-0000-000000000002', 'Pádel Sharks',    'aaaa0002-0000-0000-0000-000000000002', '#F59E0B', NOW(), NOW()),
  ('ee000003-0000-0000-0000-000000000003', 'Ases Solitarios', 'aaaa0001-0000-0000-0000-000000000001', '#6366F1', NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO teams.team_members (id, team_id, user_id) VALUES
  -- Los Ases: alice + frank
  ('mm000001-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('mm000002-0000-0000-0000-000000000002', 'ee000001-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666'),
  -- Pádel Sharks: elena + bob
  ('mm000003-0000-0000-0000-000000000003', 'ee000002-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555'),
  ('mm000004-0000-0000-0000-000000000004', 'ee000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222'),
  -- Ases Solitarios: solo carlos
  ('mm000005-0000-0000-0000-000000000005', 'ee000003-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333')
ON CONFLICT DO NOTHING;

INSERT INTO teams.team_invitations (id, team_id, invited_user_id, invited_by_user_id, status) VALUES
  -- Los Ases invitó a diana, que rechazó
  ('ii000001-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'REJECTED'),
  -- Ases Solitarios invitó a diana (pendiente)
  ('ii000002-0000-0000-0000-000000000002', 'ee000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'PENDING')
ON CONFLICT DO NOTHING;

-- =============================================================
-- SUMMARY
-- =============================================================
DO $$
DECLARE
  n_users        INT; n_complex_accs INT; n_sports      INT;
  n_courts       INT; n_tournaments  INT; n_t_matches   INT;
  n_matches      INT; n_teams        INT; n_members     INT;
BEGIN
  SELECT COUNT(*) INTO n_users        FROM auth.auth_users;
  SELECT COUNT(*) INTO n_complex_accs FROM auth.complex_accounts;
  SELECT COUNT(*) INTO n_sports       FROM sports.sports;
  SELECT COUNT(*) INTO n_courts       FROM complexes.courts;
  SELECT COUNT(*) INTO n_tournaments  FROM complexes.tournaments;
  SELECT COUNT(*) INTO n_t_matches    FROM complexes.tournament_matches;
  SELECT COUNT(*) INTO n_matches      FROM matches.matches;
  SELECT COUNT(*) INTO n_teams        FROM teams.teams;
  SELECT COUNT(*) INTO n_members      FROM teams.team_members;
  RAISE NOTICE '✓ Seed completo — users: %, complex_accounts: %, sports: %, courts: %, tournaments: % (%  partidos), matches: %, teams: %, members: %',
    n_users, n_complex_accs, n_sports, n_courts, n_tournaments, n_t_matches, n_matches, n_teams, n_members;
END $$;
