import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import type { Melody, MelodySummary, Note, SynthesizerConfig } from '../types';

/**
 * Input data for creating a new melody.
 * Does not include id or createdAt as these are generated server-side.
 */
export interface CreateMelodyInput {
  title: string;
  notes: Note[];
  tempo: number;
  synth: SynthesizerConfig;
  ownerId: string;
}

/**
 * Input data for updating an existing melody.
 */
export interface UpdateMelodyInput {
  title: string;
  notes: Note[];
  tempo: number;
  synth: SynthesizerConfig;
}

/**
 * Paginated result for melody list queries.
 */
export interface PaginatedMelodies {
  melodies: MelodySummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Convert a database timestamp to a proper UTC Date.
 * PostgreSQL TIMESTAMP without timezone is stored as-is, but the Neon driver
 * interprets it in the local timezone when creating a Date object.
 * Since we know the database stores UTC times (via NOW() on a UTC server),
 * we need to treat the Date's local components as if they were UTC.
 */
function dbTimestampToUtcDate(timestamp: unknown): Date {
  if (timestamp instanceof Date) {
    // The driver gave us a Date, but interpreted the timestamp in local timezone.
    // We need to treat the local time components as UTC.
    // Get the local time components and create a UTC date from them.
    return new Date(Date.UTC(
      timestamp.getFullYear(),
      timestamp.getMonth(),
      timestamp.getDate(),
      timestamp.getHours(),
      timestamp.getMinutes(),
      timestamp.getSeconds(),
      timestamp.getMilliseconds()
    ));
  } else if (typeof timestamp === 'string') {
    // If it's a string, append Z to indicate UTC if not already present
    const isoString = timestamp.endsWith('Z') ? timestamp : `${timestamp.replace(' ', 'T')}Z`;
    return new Date(isoString);
  } else {
    // Fallback
    return new Date(String(timestamp));
  }
}

/**
 * Convert database row to Melody domain object.
 * Handles all fields including effects configuration and preset name
 * which are stored within the synth JSONB column.
 * Requirements: 36.7, 37.8, 37.9 - Effects and preset persistence
 */
function rowToMelody(row: Record<string, unknown>): Melody {
  return {
    id: row.id as string,
    title: row.title as string,
    notes: row.notes as Note[],
    tempo: row.tempo as number,
    synth: row.synth as SynthesizerConfig,
    createdAt: dbTimestampToUtcDate(row.created_at),
    ownerId: row.owner_id as string,
  };
}

/**
 * Convert database row to MelodySummary for feed display.
 * Uses dbTimestampToUtcDate to ensure proper UTC interpretation.
 */
function rowToMelodySummary(row: Record<string, unknown>): MelodySummary {
  return {
    id: row.id as string,
    title: row.title as string,
    createdAt: dbTimestampToUtcDate(row.created_at).toISOString(),
  };
}

/**
 * Create a new melody in the database.
 * Generates a UUID v4 for the melody id.
 * Uses transaction for atomic writes (Requirement 27.5).
 * The synth configuration includes effects and presetName (Requirements 36.7, 37.8, 37.9).
 * Validates: Requirements 27.4, 27.5, 36.7, 37.8, 37.9
 *
 * @param input - Melody data including title, notes, tempo, synth (with effects/preset), and ownerId
 * @returns The created melody with generated id and createdAt
 * @throws Error if database write fails
 */
export async function createMelody(input: CreateMelodyInput): Promise<Melody> {
  const sql = getDb();
  const id = uuidv4();

  // Use transaction for atomic writes (Requirement 27.5)
  // Neon serverless uses non-interactive transactions with array of queries
  const results = await sql.transaction((tx) => [
    tx`
      INSERT INTO melodies (id, title, notes, tempo, synth, owner_id)
      VALUES (
        ${id},
        ${input.title},
        ${JSON.stringify(input.notes)}::jsonb,
        ${input.tempo},
        ${JSON.stringify(input.synth)}::jsonb,
        ${input.ownerId}
      )
      RETURNING *
    `,
  ]);

  const rows = results[0];
  if (!rows || rows.length === 0) {
    throw new Error('Failed to create melody: no rows returned');
  }

  return rowToMelody(rows[0]);
}

/**
 * Get a melody by its id.
 * Returns the full melody data including synth configuration with effects and presetName.
 * Validates: Requirements 27.4, 36.7, 37.8, 37.9
 *
 * @param id - The melody UUID
 * @returns The melody if found (including effects config and preset), null otherwise
 */
export async function getMelodyById(id: string): Promise<Melody | null> {
  const sql = getDb();

  const rows = await sql`
    SELECT id, title, notes, tempo, synth, created_at, owner_id
    FROM melodies
    WHERE id = ${id}
  `;

  if (!rows || rows.length === 0) {
    return null;
  }

  return rowToMelody(rows[0]);
}

/**
 * Update an existing melody.
 * Uses transaction for atomic writes (Requirement 27.5).
 * The synth configuration includes effects and presetName (Requirements 36.7, 37.8, 37.9).
 *
 * @param id - The melody UUID to update
 * @param input - The updated melody data including synth config with effects/preset
 * @returns The updated melody if found and updated, null if not found
 * @throws Error if database write fails
 */
export async function updateMelody(id: string, input: UpdateMelodyInput): Promise<Melody | null> {
  const sql = getDb();

  // Use transaction for atomic writes (Requirement 27.5)
  const results = await sql.transaction((tx) => [
    tx`
      UPDATE melodies
      SET
        title = ${input.title},
        notes = ${JSON.stringify(input.notes)}::jsonb,
        tempo = ${input.tempo},
        synth = ${JSON.stringify(input.synth)}::jsonb
      WHERE id = ${id}
      RETURNING *
    `,
  ]);

  const rows = results[0];
  if (!rows || rows.length === 0) {
    return null;
  }

  return rowToMelody(rows[0]);
}

/**
 * Delete a melody by its id.
 * Uses transaction for atomic writes (Requirement 27.5).
 *
 * @param id - The melody UUID to delete
 * @returns true if the melody was deleted, false if not found
 * @throws Error if database write fails
 */
export async function deleteMelody(id: string): Promise<boolean> {
  const sql = getDb();

  // Use transaction for atomic writes (Requirement 27.5)
  const results = await sql.transaction((tx) => [
    tx`
      DELETE FROM melodies
      WHERE id = ${id}
      RETURNING id
    `,
  ]);

  const rows = results[0];
  return rows && rows.length > 0;
}

/**
 * Get paginated list of melodies, ordered by created_at DESC (newest first).
 * Validates: Requirement 22.1 (Feed Sorting)
 *
 * @param page - Page number (1-based, defaults to 1)
 * @param limit - Number of melodies per page (defaults to 20, max 100)
 * @returns Paginated list with melody summaries and pagination metadata
 */
export async function getMelodiesPaginated(
  page: number = 1,
  limit: number = 20
): Promise<PaginatedMelodies> {
  const sql = getDb();

  // Enforce limits
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const offset = (safePage - 1) * safeLimit;

  // Get total count for pagination
  const countResult = await sql`
    SELECT COUNT(*) as count FROM melodies
  `;
  const total = parseInt(countResult[0]?.count as string ?? '0', 10);

  // Get paginated melodies ordered by created_at DESC (newest first)
  const rows = await sql`
    SELECT id, title, created_at
    FROM melodies
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
    OFFSET ${offset}
  `;

  const melodies = rows.map(rowToMelodySummary);

  return {
    melodies,
    total,
    page: safePage,
    limit: safeLimit,
    hasMore: offset + melodies.length < total,
  };
}
