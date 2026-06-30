import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import type { Melody, Note, SynthesizerConfig } from '../../types';

/**
 * Integration tests for API routes
 *
 * Tests the full CRUD lifecycle for melody API endpoints:
 * - GET /api/melodies - list paginated melodies
 * - POST /api/melodies - create a melody
 * - GET /api/melodies/[id] - get single melody
 * - PUT /api/melodies/[id] - update melody
 * - DELETE /api/melodies/[id] - delete melody
 *
 * Validates: Requirements 18.1, 19.1, 20.3, 21.4, 22.5
 */

// Mock the melodies data access module
vi.mock('../../lib/melodies', () => ({
  getMelodiesPaginated: vi.fn(),
  getMelodyById: vi.fn(),
  createMelody: vi.fn(),
  updateMelody: vi.fn(),
  deleteMelody: vi.fn(),
}));

// Import mocked functions
import {
  getMelodiesPaginated,
  getMelodyById,
  createMelody,
  updateMelody,
  deleteMelody,
} from '../../lib/melodies';

// Import route handlers after mocking
import { GET as getList, POST } from '../../app/api/melodies/route';
import { GET as getById, PUT, DELETE } from '../../app/api/melodies/[id]/route';

// Helper to create mock Note
const createMockNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1234-5678-90ab-cdef12345678',
  pitch: 60,
  start: 0,
  duration: 1,
  velocity: 0.8,
  ...overrides,
});

// Helper to create mock SynthesizerConfig
const createMockSynthConfig = (overrides: Partial<SynthesizerConfig> = {}): SynthesizerConfig => ({
  oscillatorType: 'sine',
  volume: 0.8,
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.5,
    release: 0.5,
  },
  filter: {
    enabled: false,
    type: 'lowpass',
    frequency: 1000,
  },
  effects: {
    reverb: { enabled: false, roomSize: 0.5, wetDry: 0.3 },
    delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
    chorus: { enabled: false, rate: 1.5, depth: 0.5, wetDry: 0.3 },
    flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
  },
  presetName: null,
  ...overrides,
});

// Helper to create mock Melody
const createMockMelody = (overrides: Partial<Melody> = {}): Melody => ({
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
  title: 'Test Melody',
  notes: [createMockNote()],
  tempo: 120,
  synth: createMockSynthConfig(),
  createdAt: new Date('2024-01-15T12:00:00.000Z'),
  ownerId: 'f1e2d3c4-b5a6-4987-8765-432109876543',
  ...overrides,
});

// Helper to create mock NextRequest
const createMockRequest = (
  url: string,
  options: {
    method?: string;
    body?: unknown;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest => {
  const { method = 'GET', body, searchParams = {} } = options;
  const fullUrl = new URL(url, 'http://localhost:3000');
  Object.entries(searchParams).forEach(([key, value]) => {
    fullUrl.searchParams.set(key, value);
  });

  return {
    method,
    url: fullUrl.toString(),
    nextUrl: fullUrl,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as NextRequest;
};

describe('API Melodies Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/melodies - List Paginated Melodies', () => {
    it('should return paginated melodies with default parameters', async () => {
      const mockMelodies = [
        { id: '1', title: 'Melody 1', createdAt: '2024-01-15T12:00:00.000Z', durationSeconds: 0 },
        { id: '2', title: 'Melody 2', createdAt: '2024-01-14T12:00:00.000Z', durationSeconds: 0 },
      ];

      vi.mocked(getMelodiesPaginated).mockResolvedValue({
        melodies: mockMelodies,
        total: 50,
        page: 1,
        limit: 20,
        hasMore: true,
      });

      const request = createMockRequest('/api/melodies');
      const response = await getList(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.melodies).toEqual(mockMelodies);
      expect(data.total).toBe(50);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(20);
      expect(data.hasMore).toBe(true);
      expect(getMelodiesPaginated).toHaveBeenCalledWith(1, 20);
    });

    it('should return paginated melodies with custom page and limit', async () => {
      vi.mocked(getMelodiesPaginated).mockResolvedValue({
        melodies: [],
        total: 100,
        page: 3,
        limit: 10,
        hasMore: true,
      });

      const request = createMockRequest('/api/melodies', {
        searchParams: { page: '3', limit: '10' },
      });
      const response = await getList(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(3);
      expect(data.limit).toBe(10);
      expect(getMelodiesPaginated).toHaveBeenCalledWith(3, 10);
    });

    it('should return 400 for invalid page parameter', async () => {
      const request = createMockRequest('/api/melodies', {
        searchParams: { page: '-1' },
      });
      const response = await getList(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toContainEqual({
        field: 'page',
        reason: 'Page must be a positive integer',
      });
    });

    it('should return 400 for invalid limit parameter', async () => {
      const request = createMockRequest('/api/melodies', {
        searchParams: { limit: '150' },
      });
      const response = await getList(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toContainEqual({
        field: 'limit',
        reason: 'Limit must be between 1 and 100',
      });
    });

    it('should return empty array when no melodies exist', async () => {
      vi.mocked(getMelodiesPaginated).mockResolvedValue({
        melodies: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const request = createMockRequest('/api/melodies');
      const response = await getList(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.melodies).toEqual([]);
      expect(data.total).toBe(0);
      expect(data.hasMore).toBe(false);
    });
  });

  describe('POST /api/melodies - Create Melody', () => {
    it('should create a melody successfully', async () => {
      const mockCreatedMelody = createMockMelody();
      vi.mocked(createMelody).mockResolvedValue(mockCreatedMelody);

      const requestBody = {
        title: 'Test Melody',
        notes: [createMockNote()],
        tempo: 120,
        synth: createMockSynthConfig(),
      };

      const request = createMockRequest('/api/melodies', {
        method: 'POST',
        body: requestBody,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(createMelody).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Melody',
          notes: requestBody.notes,
          tempo: 120,
          synth: requestBody.synth,
          ownerId: expect.any(String),
        })
      );
    });

    it('should return 400 for invalid JSON body', async () => {
      const request = {
        method: 'POST',
        url: 'http://localhost:3000/api/melodies',
        nextUrl: new URL('http://localhost:3000/api/melodies'),
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toContainEqual({
        field: 'body',
        reason: 'Invalid JSON in request body',
      });
    });

    it('should return 400 for empty title', async () => {
      const requestBody = {
        title: '',
        notes: [],
        tempo: 120,
        synth: createMockSynthConfig(),
      };

      const request = createMockRequest('/api/melodies', {
        method: 'POST',
        body: requestBody,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'title',
        })
      );
    });

    it('should return 400 for title exceeding 200 characters', async () => {
      const requestBody = {
        title: 'A'.repeat(201),
        notes: [],
        tempo: 120,
        synth: createMockSynthConfig(),
      };

      const request = createMockRequest('/api/melodies', {
        method: 'POST',
        body: requestBody,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'title',
        })
      );
    });

    it('should return 400 for invalid note fields', async () => {
      const requestBody = {
        title: 'Test Melody',
        notes: [{ id: 'note-1', pitch: 200, start: -1, duration: 0, velocity: 2 }],
        tempo: 120,
        synth: createMockSynthConfig(),
      };

      const request = createMockRequest('/api/melodies', {
        method: 'POST',
        body: requestBody,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.details.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/melodies/[id] - Get Single Melody', () => {
    it('should return melody for valid ID', async () => {
      const mockMelody = createMockMelody();
      vi.mocked(getMelodyById).mockResolvedValue(mockMelody);

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5');
      const response = await getById(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockMelody.id);
      expect(data.title).toBe(mockMelody.title);
      expect(data.notes).toEqual(mockMelody.notes);
      expect(data.tempo).toBe(mockMelody.tempo);
      expect(data.synth).toEqual(mockMelody.synth);
      expect(data.createdAt).toBe(mockMelody.createdAt.toISOString());
      expect(data.ownerId).toBe(mockMelody.ownerId);
    });

    it('should return 400 for invalid UUID format', async () => {
      const request = createMockRequest('/api/melodies/invalid-id');
      const response = await getById(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid melody ID format');
      expect(data.details).toContainEqual({
        field: 'id',
        reason: 'ID must be a valid UUID v4 format',
      });
    });

    it('should return 404 for non-existent melody', async () => {
      vi.mocked(getMelodyById).mockResolvedValue(null);

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5');
      const response = await getById(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Melody not found');
      expect(data.id).toBe('a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5');
    });
  });

  describe('PUT /api/melodies/[id] - Update Melody', () => {
    it('should update melody successfully with valid owner', async () => {
      const existingMelody = createMockMelody();
      const updatedMelody = {
        ...existingMelody,
        title: 'Updated Melody',
      };

      vi.mocked(getMelodyById).mockResolvedValue(existingMelody);
      vi.mocked(updateMelody).mockResolvedValue(updatedMelody);

      const requestBody = {
        title: 'Updated Melody',
        notes: existingMelody.notes,
        tempo: 120,
        synth: existingMelody.synth,
        ownerId: existingMelody.ownerId,
      };

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'PUT',
        body: requestBody,
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Updated Melody');
      expect(updateMelody).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
        expect.objectContaining({
          title: 'Updated Melody',
        })
      );
    });

    it('should return 400 for invalid UUID format', async () => {
      const request = createMockRequest('/api/melodies/invalid-id', {
        method: 'PUT',
        body: { ownerId: 'f1e2d3c4-b5a6-4987-8765-432109876543' },
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid melody ID format');
    });

    it('should return 401 for missing ownerId', async () => {
      const requestBody = {
        title: 'Updated Melody',
        notes: [],
        tempo: 120,
        synth: createMockSynthConfig(),
      };

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'PUT',
        body: requestBody,
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 for wrong ownerId', async () => {
      const existingMelody = createMockMelody();
      vi.mocked(getMelodyById).mockResolvedValue(existingMelody);

      const requestBody = {
        title: 'Updated Melody',
        notes: existingMelody.notes,
        tempo: 120,
        synth: existingMelody.synth,
        ownerId: 'a1111111-b222-4333-8444-555555555555', // Different owner
      };

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'PUT',
        body: requestBody,
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('You do not have permission to perform this action');
    });

    it('should return 404 for non-existent melody', async () => {
      vi.mocked(getMelodyById).mockResolvedValue(null);

      const requestBody = {
        title: 'Updated Melody',
        notes: [],
        tempo: 120,
        synth: createMockSynthConfig(),
        ownerId: 'f1e2d3c4-b5a6-4987-8765-432109876543',
      };

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'PUT',
        body: requestBody,
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Melody not found');
    });

    it('should return 400 for validation errors', async () => {
      const existingMelody = createMockMelody();
      vi.mocked(getMelodyById).mockResolvedValue(existingMelody);

      const requestBody = {
        title: '', // Invalid: empty title
        notes: existingMelody.notes,
        tempo: 120,
        synth: existingMelody.synth,
        ownerId: existingMelody.ownerId,
      };

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'PUT',
        body: requestBody,
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'title',
        })
      );
    });
  });

  describe('DELETE /api/melodies/[id] - Delete Melody', () => {
    it('should delete melody successfully with valid owner', async () => {
      const existingMelody = createMockMelody();
      vi.mocked(getMelodyById).mockResolvedValue(existingMelody);
      vi.mocked(deleteMelody).mockResolvedValue(true);

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'DELETE',
        body: { ownerId: existingMelody.ownerId },
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });

      expect(response.status).toBe(204);
      expect(deleteMelody).toHaveBeenCalledWith('a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5');
    });

    it('should return 400 for invalid UUID format', async () => {
      const request = createMockRequest('/api/melodies/invalid-id', {
        method: 'DELETE',
        body: { ownerId: 'f1e2d3c4-b5a6-4987-8765-432109876543' },
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid melody ID format');
    });

    it('should return 401 for missing ownerId', async () => {
      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'DELETE',
        body: {},
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 for wrong ownerId', async () => {
      const existingMelody = createMockMelody();
      vi.mocked(getMelodyById).mockResolvedValue(existingMelody);

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'DELETE',
        body: { ownerId: 'a1111111-b222-4333-8444-555555555555' }, // Different owner
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('You do not have permission to perform this action');
    });

    it('should return 404 for non-existent melody', async () => {
      vi.mocked(getMelodyById).mockResolvedValue(null);

      const request = createMockRequest('/api/melodies/a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5', {
        method: 'DELETE',
        body: { ownerId: 'f1e2d3c4-b5a6-4987-8765-432109876543' },
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Melody not found');
    });
  });

  describe('Full CRUD Lifecycle', () => {
    it('should support complete melody lifecycle: create, read, update, delete', async () => {
      // 1. Create melody
      const createdMelody = createMockMelody({ id: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e' });
      vi.mocked(createMelody).mockResolvedValue(createdMelody);

      const createBody = {
        title: 'New Melody',
        notes: [createMockNote()],
        tempo: 120,
        synth: createMockSynthConfig(),
      };

      const createRequest = createMockRequest('/api/melodies', {
        method: 'POST',
        body: createBody,
      });
      const createResponse = await POST(createRequest);
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(createData.id).toBeDefined();

      // 2. Read the melody
      vi.mocked(getMelodyById).mockResolvedValue(createdMelody);

      const readRequest = createMockRequest(`/api/melodies/${createdMelody.id}`);
      const readResponse = await getById(readRequest, {
        params: Promise.resolve({ id: createdMelody.id }),
      });
      const readData = await readResponse.json();

      expect(readResponse.status).toBe(200);
      expect(readData.title).toBe(createdMelody.title);

      // 3. Update the melody
      const updatedMelody = { ...createdMelody, title: 'Updated Melody' };
      vi.mocked(updateMelody).mockResolvedValue(updatedMelody);

      const updateBody = {
        title: 'Updated Melody',
        notes: createdMelody.notes,
        tempo: 140,
        synth: createdMelody.synth,
        ownerId: createdMelody.ownerId,
      };

      const updateRequest = createMockRequest(`/api/melodies/${createdMelody.id}`, {
        method: 'PUT',
        body: updateBody,
      });
      const updateResponse = await PUT(updateRequest, {
        params: Promise.resolve({ id: createdMelody.id }),
      });
      const updateData = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(updateData.title).toBe('Updated Melody');

      // 4. Delete the melody
      vi.mocked(deleteMelody).mockResolvedValue(true);

      const deleteRequest = createMockRequest(`/api/melodies/${createdMelody.id}`, {
        method: 'DELETE',
        body: { ownerId: createdMelody.ownerId },
      });
      const deleteResponse = await DELETE(deleteRequest, {
        params: Promise.resolve({ id: createdMelody.id }),
      });

      expect(deleteResponse.status).toBe(204);
      expect(deleteMelody).toHaveBeenCalledWith(createdMelody.id);
    });
  });
});
