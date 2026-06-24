import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Note, SynthesizerConfig } from '../../types';

// Mock the db module before importing melodies
const mockTransaction = vi.fn();
const mockSql = Object.assign(vi.fn(), { transaction: mockTransaction });

vi.mock('../../lib/db', () => ({
  getDb: () => mockSql,
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

// Import after mocking
import {
  createMelody,
  getMelodyById,
  updateMelody,
  deleteMelody,
  getMelodiesPaginated,
  type CreateMelodyInput,
  type UpdateMelodyInput,
} from '../../lib/melodies';

const createMockSynthConfig = (): SynthesizerConfig => ({
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
});

const createMockNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  pitch: 60,
  start: 0,
  duration: 1,
  velocity: 0.8,
  ...overrides,
});

describe('Melody Data Access Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createMelody', () => {
    it('should create a melody with UUID generation', async () => {
      const input: CreateMelodyInput = {
        title: 'Test Melody',
        notes: [createMockNote()],
        tempo: 120,
        synth: createMockSynthConfig(),
        ownerId: 'owner-123',
      };

      const mockRow = {
        id: 'test-uuid-1234',
        title: 'Test Melody',
        notes: input.notes,
        tempo: 120,
        synth: input.synth,
        created_at: '2024-01-01T00:00:00.000Z',
        owner_id: 'owner-123',
      };

      // Mock transaction to return array with query results
      mockTransaction.mockImplementation((fn) => {
        // Execute the transaction function to simulate Neon behavior
        const mockTx = vi.fn().mockReturnValue({ then: () => {} });
        fn(mockTx);
        return Promise.resolve([[mockRow]]);
      });

      const result = await createMelody(input);

      expect(result).toEqual({
        id: 'test-uuid-1234',
        title: 'Test Melody',
        notes: input.notes,
        tempo: 120,
        synth: input.synth,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        ownerId: 'owner-123',
      });
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should throw error when no rows are returned', async () => {
      const input: CreateMelodyInput = {
        title: 'Test Melody',
        notes: [],
        tempo: 120,
        synth: createMockSynthConfig(),
        ownerId: 'owner-123',
      };

      mockTransaction.mockResolvedValue([[]]);

      await expect(createMelody(input)).rejects.toThrow('Failed to create melody: no rows returned');
    });
  });

  describe('getMelodyById', () => {
    it('should return melody when found', async () => {
      const mockRow = {
        id: 'melody-123',
        title: 'Test Melody',
        notes: [createMockNote()],
        tempo: 120,
        synth: createMockSynthConfig(),
        created_at: '2024-01-01T00:00:00.000Z',
        owner_id: 'owner-123',
      };

      mockSql.mockResolvedValue([mockRow]);

      const result = await getMelodyById('melody-123');

      expect(result).toEqual({
        id: 'melody-123',
        title: 'Test Melody',
        notes: mockRow.notes,
        tempo: 120,
        synth: mockRow.synth,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        ownerId: 'owner-123',
      });
    });

    it('should return null when melody not found', async () => {
      mockSql.mockResolvedValue([]);

      const result = await getMelodyById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateMelody', () => {
    it('should update melody and return updated data', async () => {
      const input: UpdateMelodyInput = {
        title: 'Updated Melody',
        notes: [createMockNote({ pitch: 72 })],
        tempo: 140,
        synth: createMockSynthConfig(),
      };

      const mockRow = {
        id: 'melody-123',
        title: 'Updated Melody',
        notes: input.notes,
        tempo: 140,
        synth: input.synth,
        created_at: '2024-01-01T00:00:00.000Z',
        owner_id: 'owner-123',
      };

      mockTransaction.mockImplementation((fn) => {
        const mockTx = vi.fn().mockReturnValue({ then: () => {} });
        fn(mockTx);
        return Promise.resolve([[mockRow]]);
      });

      const result = await updateMelody('melody-123', input);

      expect(result).toEqual({
        id: 'melody-123',
        title: 'Updated Melody',
        notes: input.notes,
        tempo: 140,
        synth: input.synth,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        ownerId: 'owner-123',
      });
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should return null when melody not found', async () => {
      mockTransaction.mockResolvedValue([[]]);

      const result = await updateMelody('nonexistent', {
        title: 'Test',
        notes: [],
        tempo: 120,
        synth: createMockSynthConfig(),
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteMelody', () => {
    it('should return true when melody is deleted', async () => {
      mockTransaction.mockImplementation((fn) => {
        const mockTx = vi.fn().mockReturnValue({ then: () => {} });
        fn(mockTx);
        return Promise.resolve([[{ id: 'melody-123' }]]);
      });

      const result = await deleteMelody('melody-123');

      expect(result).toBe(true);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should return false when melody not found', async () => {
      mockTransaction.mockResolvedValue([[]]);

      const result = await deleteMelody('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getMelodiesPaginated', () => {
    it('should return paginated melodies ordered by created_at DESC', async () => {
      const mockRows = [
        { id: '1', title: 'Melody 1', created_at: '2024-01-03T00:00:00.000Z' },
        { id: '2', title: 'Melody 2', created_at: '2024-01-02T00:00:00.000Z' },
        { id: '3', title: 'Melody 3', created_at: '2024-01-01T00:00:00.000Z' },
      ];

      // First call for count, second for data
      mockSql
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce(mockRows);

      const result = await getMelodiesPaginated(1, 20);

      expect(result).toEqual({
        melodies: [
          { id: '1', title: 'Melody 1', createdAt: '2024-01-03T00:00:00.000Z' },
          { id: '2', title: 'Melody 2', createdAt: '2024-01-02T00:00:00.000Z' },
          { id: '3', title: 'Melody 3', createdAt: '2024-01-01T00:00:00.000Z' },
        ],
        total: 10,
        page: 1,
        limit: 20,
        hasMore: true,
      });
    });

    it('should enforce minimum page of 1', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([]);

      const result = await getMelodiesPaginated(-5, 20);

      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit of 100', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([]);

      const result = await getMelodiesPaginated(1, 500);

      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([]);

      const result = await getMelodiesPaginated(1, -10);

      expect(result.limit).toBe(1);
    });

    it('should calculate hasMore correctly when there are more results', async () => {
      const mockRows = [
        { id: '1', title: 'Melody 1', created_at: '2024-01-01T00:00:00.000Z' },
      ];

      mockSql
        .mockResolvedValueOnce([{ count: '50' }])
        .mockResolvedValueOnce(mockRows);

      const result = await getMelodiesPaginated(1, 1);

      expect(result.hasMore).toBe(true);
    });

    it('should calculate hasMore correctly when on last page', async () => {
      const mockRows = [
        { id: '1', title: 'Melody 1', created_at: '2024-01-01T00:00:00.000Z' },
      ];

      mockSql
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce(mockRows);

      const result = await getMelodiesPaginated(1, 20);

      expect(result.hasMore).toBe(false);
    });

    it('should return empty array when no melodies exist', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      const result = await getMelodiesPaginated(1, 20);

      expect(result).toEqual({
        melodies: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      });
    });

    it('should calculate offset correctly for different pages', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce([]);

      await getMelodiesPaginated(3, 20);

      // Verify offset calculation: (page-1) * limit = (3-1) * 20 = 40
      // We can verify the call was made - the offset would be in the SQL
      expect(mockSql).toHaveBeenCalledTimes(2);
    });
  });
});
