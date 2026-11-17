import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getMovieById,
  getMovies,
  upsertMovies,
  type MovieInput,
} from './movie-repository';
import { initializeSchema } from './schema';

const movie = (id: number, title: string): MovieInput => ({
  id,
  title,
  original_title: title,
  original_language: 'en',
  overview: `${title} overview`,
  release_date: '2024-01-15',
  popularity: 10,
  vote_average: 7.5,
  vote_count: 100,
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  runtime_minutes: 120,
  budget: 1_000_000,
  revenue: 2_000_000,
  collected_at: '2026-01-01T00:00:00Z',
});

describe('movie-repository', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    initializeSchema(database);
  });

  afterEach(() => {
    database.close();
  });

  it('returns an empty list and undefined for an unknown movie', () => {
    // Arrange
    const missingMovieId = 999;

    // Act and Assert
    expect(getMovies(database)).toEqual([]);
    expect(getMovieById(database, missingMovieId)).toBeUndefined();
  });

  it('inserts movies, retrieves them by id, and orders them by id', () => {
    // Arrange
    const movies = [movie(42, 'The Answer'), movie(7, 'Seven')];

    // Act
    upsertMovies(database, movies);

    // Assert
    expect(getMovieById(database, 42)).toMatchObject({
      id: 42,
      title: 'The Answer',
      release_year: 2024,
    });
    expect(getMovies(database).map(({ id }) => id)).toEqual([7, 42]);
  });

  it('updates an existing movie without creating a duplicate', () => {
    // Arrange
    upsertMovies(database, [movie(42, 'Original title')]);
    const updatedMovie = {
      ...movie(42, 'Updated title'),
      vote_average: 8.2,
    };

    // Act
    upsertMovies(database, [updatedMovie]);

    // Assert
    expect(getMovies(database)).toHaveLength(1);
    expect(getMovieById(database, 42)).toMatchObject({
      id: 42,
      title: 'Updated title',
      vote_average: 8.2,
    });
  });

  it('rolls back the complete batch when one movie violates the schema', () => {
    // Arrange
    const invalidMovie = { ...movie(7, 'Invalid'), title: null as never };

    // Act and Assert
    expect(() =>
      upsertMovies(database, [movie(42, 'Valid'), invalidMovie]),
    ).toThrow(/NOT NULL constraint failed/);
    expect(getMovies(database)).toEqual([]);
  });
});
