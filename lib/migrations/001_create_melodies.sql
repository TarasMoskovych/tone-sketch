-- Migration: 001_create_melodies
-- Description: Create the melodies table for storing user compositions
-- Requirements: 27.1, 36.7, 37.8, 37.9 - Database Schema from Design
--
-- Run this migration via:
-- 1. Neon Console SQL Editor: https://console.neon.tech
-- 2. psql command line: psql $DATABASE_URL -f lib/migrations/001_create_melodies.sql
-- 3. Any PostgreSQL client connected to your Neon database

-- Create the melodies table
CREATE TABLE IF NOT EXISTS melodies (
  -- Primary identifier (UUID v4 format)
  id TEXT PRIMARY KEY NOT NULL,

  -- Melody title with 200 character limit (Requirement 27.2)
  title TEXT NOT NULL CHECK (char_length(title) <= 200),

  -- Notes stored as JSONB array for flexible querying
  -- Each note has: id, pitch, start, duration, velocity
  notes JSONB NOT NULL,

  -- Tempo in beats per minute (integer)
  tempo INT NOT NULL,

  -- Synthesizer configuration stored as JSONB
  -- Contains: oscillatorType, volume, envelope (ADSR), filter, effects, presetName
  -- Effects configuration (Requirement 36.7): reverb, delay, chorus, flanger
  -- Preset name (Requirements 37.8, 37.9): currently selected preset or null for custom
  synth JSONB NOT NULL,

  -- Timestamp of melody creation
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Owner identifier for authorization (UUID v4 format)
  owner_id TEXT NOT NULL
);

-- Index for feed queries: order by newest first (Requirement 22.1)
CREATE INDEX IF NOT EXISTS idx_melodies_created_at ON melodies(created_at DESC);

-- Index for owner-based queries: lookup melodies by owner
CREATE INDEX IF NOT EXISTS idx_melodies_owner_id ON melodies(owner_id);

-- Add comments for documentation
COMMENT ON TABLE melodies IS 'Stores user-created melody compositions with notes, tempo, and synth settings';
COMMENT ON COLUMN melodies.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN melodies.title IS 'Melody title, max 200 characters';
COMMENT ON COLUMN melodies.notes IS 'Array of note objects with id, pitch, start, duration, velocity';
COMMENT ON COLUMN melodies.tempo IS 'Playback tempo in beats per minute';
COMMENT ON COLUMN melodies.synth IS 'Synthesizer configuration including oscillator, volume, ADSR, filter, effects (reverb/delay/chorus/flanger), and presetName';
COMMENT ON COLUMN melodies.created_at IS 'Timestamp when melody was created';
COMMENT ON COLUMN melodies.owner_id IS 'Owner identifier for authorization checks';
