import { neon, NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Neon Postgres database connection singleton.
 * Uses the serverless driver optimized for edge/serverless environments.
 *
 * Connection is established lazily on first query.
 * The DATABASE_URL environment variable must be set.
 */

let sql: NeonQueryFunction<false, false> | null = null;

/**
 * Get the database connection instance.
 * Creates a new connection if one doesn't exist.
 *
 * @throws Error if DATABASE_URL environment variable is not set
 * @returns NeonQueryFunction for executing SQL queries
 */
export function getDb(): NeonQueryFunction<false, false> {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please configure your Neon Postgres connection string.'
      );
    }

    sql = neon(connectionString);
  }

  return sql;
}

/**
 * Execute a SQL query using the database connection.
 * This is a convenience wrapper around getDb().
 *
 * @example
 * // Simple query
 * const result = await query`SELECT * FROM melodies WHERE id = ${id}`;
 *
 * @example
 * // Insert with returning
 * const [melody] = await query`
 *   INSERT INTO melodies (id, title, notes, tempo, synth, owner_id)
 *   VALUES (${id}, ${title}, ${notes}, ${tempo}, ${synth}, ${ownerId})
 *   RETURNING *
 * `;
 */
export const query = getDb;

export default getDb;
