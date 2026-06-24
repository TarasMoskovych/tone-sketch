import { type NextRequest } from 'next/server';
import { getMelodyById, updateMelody, deleteMelody } from '@/lib/melodies';
import { validateMelody } from '@/utils/validation';
import type { SynthesizerConfig } from '@/types/synth';

/**
 * UUID v4 format validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a valid UUID v4 format
 */
function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * GET /api/melodies/[id]
 *
 * Fetch a single melody by ID.
 *
 * Response:
 * - 200: Melody found, returns full melody data
 * - 400: Invalid ID format (not a valid UUID)
 * - 404: Melody not found
 * - 500: Internal server error
 *
 * Validates: Requirements 19.1, 19.5, 28.1, 28.2, 28.4
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;

    // Validate ID is a valid UUID format
    if (!isValidUuid(id)) {
      return Response.json(
        {
          error: 'Invalid melody ID format',
          details: [{ field: 'id', reason: 'ID must be a valid UUID v4 format' }],
        },
        { status: 400 }
      );
    }

    // Fetch the melody from database
    const melody = await getMelodyById(id);

    // Return 404 if melody not found
    if (!melody) {
      return Response.json(
        {
          error: 'Melody not found',
          id,
        },
        { status: 404 }
      );
    }

    // Return the melody data
    // Convert Date to ISO string for JSON response
    return Response.json({
      id: melody.id,
      title: melody.title,
      notes: melody.notes,
      tempo: melody.tempo,
      synth: melody.synth,
      createdAt: melody.createdAt.toISOString(),
      ownerId: melody.ownerId,
    });
  } catch (error) {
    // Log the error for debugging (server-side only)
    console.error('Error fetching melody:', error);

    // Return generic error message without exposing internal details
    // Validates: Requirement 28.4
    return Response.json(
      {
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}


/**
 * PUT /api/melodies/[id]
 *
 * Update an existing melody.
 *
 * Request Body:
 * - title: string (1-200 characters)
 * - notes: Note[] (max 10000 notes)
 * - tempo: number (positive integer)
 * - synth: SynthesizerConfig
 * - ownerId: string (UUID v4, must match stored owner_id)
 *
 * Response:
 * - 200: Melody updated successfully, returns updated melody data
 * - 400: Invalid ID format or validation errors
 * - 403: Forbidden - ownerId missing or doesn't match
 * - 404: Melody not found
 * - 500: Internal server error
 *
 * Validates: Requirements 20.3, 20.6, 20.7, 26.3, 26.4, 26.5, 28.3, 28.5
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;

    // Validate ID is a valid UUID format
    if (!isValidUuid(id)) {
      return Response.json(
        {
          error: 'Invalid melody ID format',
          details: [{ field: 'id', reason: 'ID must be a valid UUID v4 format' }],
        },
        { status: 400 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: 'Invalid request body',
          details: [{ field: 'body', reason: 'Request body must be valid JSON' }],
        },
        { status: 400 }
      );
    }

    // Validate that body is an object
    if (typeof body !== 'object' || body === null) {
      return Response.json(
        {
          error: 'Invalid request body',
          details: [{ field: 'body', reason: 'Request body must be an object' }],
        },
        { status: 400 }
      );
    }

    const requestBody = body as Record<string, unknown>;

    // Check if ownerId is provided (Requirement 28.6)
    // Return 401 Unauthorized when owner_id is missing on update operations
    if (!requestBody.ownerId) {
      return Response.json(
        {
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Validate ownerId is a valid UUID
    if (typeof requestBody.ownerId !== 'string' || !isValidUuid(requestBody.ownerId)) {
      return Response.json(
        {
          error: 'Invalid owner ID format',
          details: [{ field: 'ownerId', reason: 'Owner ID must be a valid UUID v4 format' }],
        },
        { status: 400 }
      );
    }

    // Fetch existing melody to verify ownership
    const existingMelody = await getMelodyById(id);

    // Return 404 if melody not found
    if (!existingMelody) {
      return Response.json(
        {
          error: 'Melody not found',
          id,
        },
        { status: 404 }
      );
    }

    // Verify ownership (Requirements 26.3, 26.4)
    if (existingMelody.ownerId !== requestBody.ownerId) {
      return Response.json(
        {
          error: 'You do not have permission to perform this action',
        },
        { status: 403 }
      );
    }

    // Validate melody data
    const validationResult = validateMelody(requestBody);
    if (!validationResult.valid) {
      return Response.json(
        {
          error: 'Validation failed',
          details: validationResult.errors,
        },
        { status: 400 }
      );
    }

    // Update the melody atomically (Requirement 20.6)
    const updatedMelody = await updateMelody(id, {
      title: requestBody.title as string,
      notes: requestBody.notes as Array<{
        id: string;
        pitch: number;
        start: number;
        duration: number;
        velocity: number;
      }>,
      tempo: requestBody.tempo as number,
      synth: requestBody.synth as SynthesizerConfig,
    });

    // This shouldn't happen since we checked existence above, but handle it
    if (!updatedMelody) {
      return Response.json(
        {
          error: 'Melody not found',
          id,
        },
        { status: 404 }
      );
    }

    // Return the updated melody data
    return Response.json({
      id: updatedMelody.id,
      title: updatedMelody.title,
      notes: updatedMelody.notes,
      tempo: updatedMelody.tempo,
      synth: updatedMelody.synth,
      createdAt: updatedMelody.createdAt.toISOString(),
      ownerId: updatedMelody.ownerId,
    });
  } catch (error) {
    // Log the error for debugging (server-side only)
    console.error('Error updating melody:', error);

    // Return generic error message without exposing internal details
    // Validates: Requirement 28.4
    return Response.json(
      {
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/melodies/[id]
 *
 * Delete a melody.
 *
 * Request Body:
 * - ownerId: string (UUID v4, must match stored owner_id)
 *
 * Response:
 * - 204: Melody deleted successfully (No Content)
 * - 400: Invalid ID format
 * - 403: Forbidden - ownerId missing or doesn't match
 * - 404: Melody not found
 * - 500: Internal server error
 *
 * Validates: Requirements 21.4, 21.7, 26.3, 26.4, 26.5, 28.1, 28.2, 28.4, 28.5
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;

    // Validate ID is a valid UUID format
    if (!isValidUuid(id)) {
      return Response.json(
        {
          error: 'Invalid melody ID format',
          details: [{ field: 'id', reason: 'ID must be a valid UUID v4 format' }],
        },
        { status: 400 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: 'Invalid request body',
          details: [{ field: 'body', reason: 'Request body must be valid JSON' }],
        },
        { status: 400 }
      );
    }

    // Validate that body is an object
    if (typeof body !== 'object' || body === null) {
      return Response.json(
        {
          error: 'Invalid request body',
          details: [{ field: 'body', reason: 'Request body must be an object' }],
        },
        { status: 400 }
      );
    }

    const requestBody = body as Record<string, unknown>;

    // Check if ownerId is provided (Requirement 28.6)
    // Return 401 Unauthorized when owner_id is missing on delete operations
    if (!requestBody.ownerId) {
      return Response.json(
        {
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Validate ownerId is a valid UUID
    if (typeof requestBody.ownerId !== 'string' || !isValidUuid(requestBody.ownerId)) {
      return Response.json(
        {
          error: 'Invalid owner ID format',
          details: [{ field: 'ownerId', reason: 'Owner ID must be a valid UUID v4 format' }],
        },
        { status: 400 }
      );
    }

    // Fetch existing melody to verify ownership
    const existingMelody = await getMelodyById(id);

    // Return 404 if melody not found
    if (!existingMelody) {
      return Response.json(
        {
          error: 'Melody not found',
          id,
        },
        { status: 404 }
      );
    }

    // Verify ownership (Requirements 26.3, 26.4)
    if (existingMelody.ownerId !== requestBody.ownerId) {
      return Response.json(
        {
          error: 'You do not have permission to perform this action',
        },
        { status: 403 }
      );
    }

    // Delete the melody
    await deleteMelody(id);

    // Return 204 No Content on successful deletion
    return new Response(null, { status: 204 });
  } catch (error) {
    // Log the error for debugging (server-side only)
    console.error('Error deleting melody:', error);

    // Return generic error message without exposing internal details
    // Validates: Requirement 28.4
    return Response.json(
      {
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
