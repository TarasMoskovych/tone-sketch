import { type NextRequest } from 'next/server';
import { getMelodiesPaginated, createMelody } from '@/lib/melodies';
import { validateMelody } from '@/utils/validation';
import type { Note, SynthesizerConfig } from '@/types';

/**
 * GET /api/melodies
 *
 * Fetch paginated melody list for feed.
 *
 * Query Parameters:
 * - page: Page number (1-based, default: 1)
 * - limit: Number of melodies per page (default: 20, max: 100)
 *
 * Response:
 * {
 *   melodies: MelodySummary[],
 *   total: number,
 *   page: number,
 *   limit: number,
 *   hasMore: boolean
 * }
 *
 * Validates: Requirements 22.1, 22.5
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse pagination parameters
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return Response.json(
        {
          error: 'Validation failed',
          details: [{ field: 'page', reason: 'Page must be a positive integer' }],
        },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return Response.json(
        {
          error: 'Validation failed',
          details: [{ field: 'limit', reason: 'Limit must be between 1 and 100' }],
        },
        { status: 400 }
      );
    }

    // Fetch paginated melodies from database
    const result = await getMelodiesPaginated(page, limit);

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching melodies:', error);

    return Response.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/melodies
 *
 * Create a new melody.
 *
 * Request Body:
 * {
 *   title: string (1-200 chars),
 *   notes: Note[],
 *   tempo: number (positive integer),
 *   synth: SynthesizerConfig
 * }
 *
 * Response:
 * - 201: { id: string } - Successfully created
 * - 400: { error: string, details: FieldValidationError[] } - Validation failed
 * - 500: { error: string } - Server error
 *
 * Validates: Requirements 18.1, 18.3, 18.5, 18.6, 18.7, 27.2, 27.3, 27.4, 27.5, 28.1, 28.3, 28.4
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: 'Validation failed',
          details: [{ field: 'body', reason: 'Invalid JSON in request body' }],
        },
        { status: 400 }
      );
    }

    // Validate melody data
    const validationResult = validateMelody(body);
    if (!validationResult.valid) {
      return Response.json(
        {
          error: 'Validation failed',
          details: validationResult.errors,
        },
        { status: 400 }
      );
    }

    // Type assertion after validation passes
    const melodyData = body as {
      title: string;
      notes: Note[];
      tempo: number;
      synth: SynthesizerConfig;
      ownerId: string;
    };

    // Use the ownerId from the request (client's localStorage ID)
    // Fall back to generating a new one if not provided
    const ownerId = melodyData.ownerId || crypto.randomUUID();

    // Create the melody in the database
    const createdMelody = await createMelody({
      title: melodyData.title,
      notes: melodyData.notes,
      tempo: melodyData.tempo,
      synth: melodyData.synth,
      ownerId,
    });

    // Return 201 with the created melody id
    return Response.json({ id: createdMelody.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating melody:', error);

    // Return 500 with generic message (no internal details exposed)
    return Response.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
