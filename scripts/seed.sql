-- =============================================================
-- PIVOO — TEST DATA SEED
-- Password for all users: password123
-- Run with: psql postgresql://postgres:admin123@127.0.0.1:5432/pivoo -f scripts/seed.sql
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING / IF NOT EXISTS)
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
DO $$ BEGIN CREATE TYPE users."SkillLevel"          AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED','PROFESSIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sports."SportName"           AS ENUM ('TENNIS','PADEL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."MatchStatus"        AS ENUM ('OPEN','FULL','IN_PROGRESS','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."ParticipantStatus"  AS ENUM ('PENDING','INVITED','APPROVED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."ParticipantType"    AS ENUM ('REGISTERED','GUEST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."Team"               AS ENUM ('TEAM_A','TEAM_B'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matches."SkillLevel"         AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED','PROFESSIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE teams."TeamMemberRole"       AS ENUM ('ADMIN','MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE teams."TeamInviteStatus"     AS ENUM ('PENDING','ACCEPTED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add INVITED to ParticipantStatus if it was created before the migration ran
DO $$ BEGIN ALTER TYPE matches."ParticipantStatus" ADD VALUE IF NOT EXISTS 'INVITED'; EXCEPTION WHEN others THEN NULL; END $$;

-- =============================================================
-- 3. TABLES (safe CREATE IF NOT EXISTS)
-- =============================================================

-- auth
CREATE TABLE IF NOT EXISTS auth.auth_users (
  id            TEXT        PRIMARY KEY,
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  refresh_token TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users
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

-- sports
CREATE TABLE IF NOT EXISTS sports.sports (
  id          TEXT               PRIMARY KEY,
  name        sports."SportName" UNIQUE NOT NULL,
  min_players INT                NOT NULL,
  max_players INT                NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- complexes
CREATE TABLE IF NOT EXISTS complexes.sport_complexes (
  id         TEXT          PRIMARY KEY,
  name       TEXT          NOT NULL,
  address    TEXT          NOT NULL,
  city       TEXT          NOT NULL,
  latitude   DECIMAL(10,8),
  longitude  DECIMAL(11,8),
  phone      TEXT,
  website    TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complexes.courts (
  id         TEXT    PRIMARY KEY,
  complex_id TEXT    NOT NULL REFERENCES complexes.sport_complexes(id) ON DELETE CASCADE,
  sport_id   TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  indoor     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- matches
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
  id          TEXT            PRIMARY KEY,
  match_id    TEXT            UNIQUE NOT NULL REFERENCES matches.matches(id) ON DELETE CASCADE,
  sets        JSONB           NOT NULL,
  winner_team matches."Team"  NOT NULL,
  recorded_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- teams
CREATE TABLE IF NOT EXISTS teams.teams (
  id            TEXT        PRIMARY KEY,
  name          TEXT        NOT NULL,
  sport_id      TEXT,
  admin_user_id TEXT        NOT NULL,
  color         TEXT        NOT NULL DEFAULT '#14B8A6',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams.team_members (
  id        TEXT                   PRIMARY KEY,
  team_id   TEXT                   NOT NULL REFERENCES teams.teams(id) ON DELETE CASCADE,
  user_id   TEXT                   NOT NULL,
  role      teams."TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
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
-- All passwords: password123
-- Hash: $2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny
-- =============================================================

-- ---- AUTH USERS ----
INSERT INTO auth.auth_users (id, email, password_hash) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@pivoo.com',  '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny'),
  ('22222222-2222-2222-2222-222222222222', 'bob@pivoo.com',    '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny'),
  ('33333333-3333-3333-3333-333333333333', 'carlos@pivoo.com', '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny'),
  ('44444444-4444-4444-4444-444444444444', 'diana@pivoo.com',  '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny'),
  ('55555555-5555-5555-5555-555555555555', 'elena@pivoo.com',  '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny'),
  ('66666666-6666-6666-6666-666666666666', 'frank@pivoo.com',  '$2a$10$FU.17fYVAWC5dOiWkC64xuwKGBGPoKZNbyaj5lwaB1PnsxwBnr5ny')
ON CONFLICT DO NOTHING;

-- ---- USER PROFILES ----
INSERT INTO users.user_profiles (id, email, username, name, bio) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@pivoo.com',  'alice',  'Alice García',     'Tenista apasionada. Jugando desde los 12 años.'),
  ('22222222-2222-2222-2222-222222222222', 'bob@pivoo.com',    'bob',    'Bob Martínez',     'Padelero de los domingos, tenis los viernes.'),
  ('33333333-3333-3333-3333-333333333333', 'carlos@pivoo.com', 'carlos', 'Carlos López',     'Polideportivo, juego cualquier cosa.'),
  ('44444444-4444-4444-4444-444444444444', 'diana@pivoo.com',  'diana',  'Diana Sánchez',    'Empezando en el tenis, me encanta el deporte.'),
  ('55555555-5555-5555-5555-555555555555', 'elena@pivoo.com',  'elena',  'Elena Rodríguez',  'Padelera competitiva, top 50 ranking local.'),
  ('66666666-6666-6666-6666-666666666666', 'frank@pivoo.com',  'frank',  'Frank Jiménez',    'Ex-profesional de tenis. Ahora entreno y compito localmente.')
ON CONFLICT DO NOTHING;

-- ---- SPORTS ----
INSERT INTO sports.sports (id, name, min_players, max_players, description) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'TENNIS', 2, 4, 'Tenis individual o dobles'),
  ('aaaa0002-0000-0000-0000-000000000002', 'PADEL',  4, 4, 'Pádel dobles obligatorio')
ON CONFLICT DO NOTHING;

-- ---- USER SPORT STATS ----
-- Derived from the completed matches below (manual calculation for realism)
INSERT INTO users.user_sport_stats (id, user_id, sport_id, matches_played, matches_won, ranking_points, level) VALUES
  -- Tennis
  ('aa000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaa0001-0000-0000-0000-000000000001', 3, 3, 1320, 'ADVANCED'),      -- alice:  3 jugados, 3 ganados
  ('aa000002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'aaaa0001-0000-0000-0000-000000000001', 2, 0,  840, 'INTERMEDIATE'),   -- carlos: 2 jugados, 0 ganados
  ('aa000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'aaaa0001-0000-0000-0000-000000000001', 1, 0,  960, 'BEGINNER'),       -- diana:  1 jugado,  0 ganados
  ('aa000004-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666666', 'aaaa0001-0000-0000-0000-000000000001', 3, 2, 1180, 'PROFESSIONAL'),   -- frank:  3 jugados, 2 ganados
  -- Padel
  ('aa000005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'aaaa0002-0000-0000-0000-000000000002', 2, 2, 1160, 'INTERMEDIATE'),   -- bob:    2 jugados, 2 ganados
  ('aa000006-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'aaaa0002-0000-0000-0000-000000000002', 1, 0,  930, 'INTERMEDIATE'),   -- carlos: 1 jugado,  0 ganados
  ('aa000007-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444', 'aaaa0002-0000-0000-0000-000000000002', 2, 0,  890, 'BEGINNER'),       -- diana:  2 jugados, 0 ganados
  ('aa000008-0000-0000-0000-000000000008', '55555555-5555-5555-5555-555555555555', 'aaaa0002-0000-0000-0000-000000000002', 2, 2, 1240, 'ADVANCED'),       -- elena:  2 jugados, 2 ganados
  ('aa000009-0000-0000-0000-000000000009', '66666666-6666-6666-6666-666666666666', 'aaaa0002-0000-0000-0000-000000000002', 1, 0,  950, 'INTERMEDIATE')    -- frank:  1 jugado,  0 ganados
ON CONFLICT DO NOTHING;

-- ---- COMPLEXES ----
INSERT INTO complexes.sport_complexes (id, name, address, city, latitude, longitude, phone) VALUES
  ('bb000001-0000-0000-0000-000000000001', 'SportClub Las Palmas',   'Calle del Deporte 15', 'Madrid', 40.41650000, -3.70360000, '+34 91 234 5678'),
  ('bb000002-0000-0000-0000-000000000002', 'Centro de Pádel Norte',  'Avenida Norte 88',     'Madrid', 40.46200000, -3.69150000, '+34 91 876 5432')
ON CONFLICT DO NOTHING;

-- ---- COURTS ----
INSERT INTO complexes.courts (id, complex_id, sport_id, name, indoor, is_active) VALUES
  ('cc000001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'Pista Tenis 1',  TRUE,  TRUE),
  ('cc000002-0000-0000-0000-000000000002', 'bb000001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'Pista Tenis 2',  FALSE, TRUE),
  ('cc000003-0000-0000-0000-000000000003', 'bb000002-0000-0000-0000-000000000002', 'aaaa0002-0000-0000-0000-000000000002', 'Pista Pádel 1',  TRUE,  TRUE),
  ('cc000004-0000-0000-0000-000000000004', 'bb000002-0000-0000-0000-000000000002', 'aaaa0002-0000-0000-0000-000000000002', 'Pista Pádel 2',  FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- ---- MATCHES ----
-- M1: Singles tenis – frank (A) vs alice (B) → gana TEAM_B (alice)
-- M2: Dobles tenis – alice+frank (A) vs carlos+diana (B) → gana TEAM_A  ← stats "Los Ases" #1
-- M3: Pádel – elena+bob (A) vs carlos+diana (B) → gana TEAM_A           ← stats "Pádel Sharks" #1
-- M4: Dobles tenis – alice+frank (A) vs carlos+guest (B) → gana TEAM_A  ← stats "Los Ases" #2
-- M5: Pádel – elena+bob (A) vs frank+diana (B) → gana TEAM_A            ← stats "Pádel Sharks" #2
-- M6: OPEN tenis – frank busca compañeros
-- M7: OPEN pádel – elena busca cuatro

INSERT INTO matches.matches (id, sport_id, complex_id, court_id, admin_user_id, scheduled_at, max_players, min_players, status, description) VALUES
  ('dd000001-0000-0000-0000-000000000001',
   'aaaa0001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001',
   '66666666-6666-6666-6666-666666666666', '2026-03-10 10:00:00+00', 2, 2, 'COMPLETED', 'Individuales de tenis'),
  ('dd000002-0000-0000-0000-000000000002',
   'aaaa0001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'cc000002-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', '2026-03-20 16:00:00+00', 4, 4, 'COMPLETED', 'Dobles tenis amistoso'),
  ('dd000003-0000-0000-0000-000000000003',
   'aaaa0002-0000-0000-0000-000000000002', 'bb000002-0000-0000-0000-000000000002', 'cc000003-0000-0000-0000-000000000003',
   '55555555-5555-5555-5555-555555555555', '2026-04-01 18:00:00+00', 4, 4, 'COMPLETED', 'Pádel dobles competitivo'),
  ('dd000004-0000-0000-0000-000000000004',
   'aaaa0001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', '2026-04-10 11:00:00+00', 4, 2, 'COMPLETED', 'Dobles tenis con jugador invitado'),
  ('dd000005-0000-0000-0000-000000000005',
   'aaaa0002-0000-0000-0000-000000000002', 'bb000002-0000-0000-0000-000000000002', 'cc000004-0000-0000-0000-000000000004',
   '55555555-5555-5555-5555-555555555555', '2026-04-15 17:00:00+00', 4, 4, 'COMPLETED', 'Revancha de pádel'),
  ('dd000006-0000-0000-0000-000000000006',
   'aaaa0001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'cc000002-0000-0000-0000-000000000002',
   '66666666-6666-6666-6666-666666666666', '2026-05-05 09:00:00+00', 4, 2, 'OPEN',      'Buscando compañeros para dobles de tenis'),
  ('dd000007-0000-0000-0000-000000000007',
   'aaaa0002-0000-0000-0000-000000000002', 'bb000002-0000-0000-0000-000000000002', 'cc000003-0000-0000-0000-000000000003',
   '55555555-5555-5555-5555-555555555555', '2026-05-08 19:00:00+00', 4, 4, 'OPEN',      'Pádel nocturno — nivel medio-alto')
ON CONFLICT DO NOTHING;

-- ---- MATCH PARTICIPANTS ----

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

-- M6: Open tenis — frank (approved/admin), bob (pending)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000019-0000-0000-0000-000000000019', 'dd000006-0000-0000-0000-000000000006', '66666666-6666-6666-6666-666666666666', 'REGISTERED', 'APPROVED', NULL),
  ('pp000020-0000-0000-0000-000000000020', 'dd000006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'REGISTERED', 'PENDING',  NULL)
ON CONFLICT DO NOTHING;

-- M7: Open pádel — elena (approved/admin), alice (pending)
INSERT INTO matches.match_participants (id, match_id, user_id, participant_type, status, team) VALUES
  ('pp000021-0000-0000-0000-000000000021', 'dd000007-0000-0000-0000-000000000007', '55555555-5555-5555-5555-555555555555', 'REGISTERED', 'APPROVED', NULL),
  ('pp000022-0000-0000-0000-000000000022', 'dd000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'REGISTERED', 'PENDING',  NULL)
ON CONFLICT DO NOTHING;

-- ---- MATCH RESULTS ----
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

-- ---- TEAMS ----
INSERT INTO teams.teams (id, name, sport_id, admin_user_id, color) VALUES
  ('ee000001-0000-0000-0000-000000000001', 'Los Ases',     'aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '#14B8A6'),
  ('ee000002-0000-0000-0000-000000000002', 'Pádel Sharks', 'aaaa0002-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', '#F59E0B')
ON CONFLICT DO NOTHING;

-- ---- TEAM MEMBERS ----
INSERT INTO teams.team_members (id, team_id, user_id, role) VALUES
  -- Los Ases: alice (admin), frank (member)
  ('mm000001-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ADMIN'),
  ('mm000002-0000-0000-0000-000000000002', 'ee000001-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'MEMBER'),
  -- Pádel Sharks: elena (admin), bob (member), carlos (member)
  ('mm000003-0000-0000-0000-000000000003', 'ee000002-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'ADMIN'),
  ('mm000004-0000-0000-0000-000000000004', 'ee000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'MEMBER'),
  ('mm000005-0000-0000-0000-000000000005', 'ee000002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'MEMBER')
ON CONFLICT DO NOTHING;

-- ---- TEAM INVITATIONS ----
INSERT INTO teams.team_invitations (id, team_id, invited_user_id, invited_by_user_id, status) VALUES
  -- Los Ases invited diana (pending)
  ('ii000001-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'PENDING'),
  -- Pádel Sharks invited diana (pending)
  ('ii000002-0000-0000-0000-000000000002', 'ee000002-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', 'PENDING')
ON CONFLICT DO NOTHING;

-- =============================================================
-- SUMMARY
-- =============================================================
DO $$
DECLARE
  n_users    INT; n_sports INT; n_courts   INT;
  n_matches  INT; n_teams  INT; n_members  INT;
BEGIN
  SELECT COUNT(*) INTO n_users   FROM auth.auth_users;
  SELECT COUNT(*) INTO n_sports  FROM sports.sports;
  SELECT COUNT(*) INTO n_courts  FROM complexes.courts;
  SELECT COUNT(*) INTO n_matches FROM matches.matches;
  SELECT COUNT(*) INTO n_teams   FROM teams.teams;
  SELECT COUNT(*) INTO n_members FROM teams.team_members;
  RAISE NOTICE '✓ Seed complete — users: %, sports: %, courts: %, matches: %, teams: %, members: %',
    n_users, n_sports, n_courts, n_matches, n_teams, n_members;
END $$;
