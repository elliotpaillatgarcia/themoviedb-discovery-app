import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeSchema } from './database/schema';
import {
  createMovieUpdateApi,
  updateMoviesFromApi,
  type MovieUpdateApi,
} from './movie-update-service';
import type { Movie, MovieDetails } from './types/MoviesTypes';

const movie: Movie = {
  backdrop_path: '/backdrop.jpg',
  genre_ids: [18],
  id: 1,
  original_language: 'en',
  original_title: 'Movie',
  overview: 'Overview',
  popularity: 12.5,
  poster_path: '/poster.jpg',
  release_date: '2020-01-01',
  title: 'Movie',
  vote_average: 7.2,
  vote_count: 100,
};

const details: MovieDetails = {
  ...movie,
  budget: 1000,
  genres: [{ id: 18, name: 'Drama' }],
  production_countries: [{ iso_3166_1: 'FR', name: 'France' }],
  revenue: 2000,
  runtime: 120,
  tagline: 'A tagline',
};

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  initializeSchema(database);
  return database;
}

function createApi(
  movies: Movie[] = [movie],
  movieDetails: MovieDetails[] = [details],
): MovieUpdateApi {
  return {
    getMovies: vi.fn().mockResolvedValue(movies),
    getMovieDetails: vi.fn().mockImplementation((id: number) => {
      const detail = movieDetails.find((candidate) => candidate.id === id);
      if (!detail) return Promise.reject(new Error(`Unknown movie ${id}`));
      return Promise.resolve(detail);
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('movie-update-service', () => {
  it('fetches popular movies and details from the local movie API', async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          page: 1,
          results: [movie],
          total_pages: 1,
          total_results: 1,
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => details });
    vi.stubGlobal('fetch', fetchMock);
    const api = createMovieUpdateApi('http://api.test/');

    // Act
    const movies = await api.getMovies();
    const movieDetails = await api.getMovieDetails(1);

    // Assert
    expect(movies).toEqual([movie]);
    expect(movieDetails).toEqual(details);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://api.test/api/movies/popular',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.test/api/movies/1',
    );
  });

  it('rejects API responses that are unsuccessful', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    const api = createMovieUpdateApi('http://api.test');

    // Act and Assert
    await expect(api.getMovies()).rejects.toThrow(
      'Movie update API request failed with status 503',
    );
  });

  it('updates movies, genres, countries, and associations idempotently', async () => {
    // Arrange
    const database = createDatabase();
    try {
      const api = createApi();
      await updateMoviesFromApi(database, api);
      await updateMoviesFromApi(database, api);

      expect(database.prepare('SELECT id, name FROM genres').all()).toEqual([
        { id: 18, name: 'Drama' },
      ]);
      expect(
        database.prepare('SELECT code, name FROM countries').all(),
      ).toEqual([{ code: 'FR', name: 'France' }]);
      expect(database.prepare('SELECT id, title FROM movies').all()).toEqual([
        { id: 1, title: 'Movie' },
      ]);
      expect(
        database.prepare('SELECT movie_id, genre_id FROM movie_genres').all(),
      ).toEqual([{ movie_id: 1, genre_id: 18 }]);
      expect(
        database
          .prepare('SELECT movie_id, country_code FROM production_countries')
          .all(),
      ).toEqual([{ movie_id: 1, country_code: 'FR' }]);

      const updatedMovie = { ...movie, title: 'Updated movie' };
      const updatedDetails: MovieDetails = {
        ...details,
        genres: [{ id: 35, name: 'Comedy' }],
        production_countries: [{ iso_3166_1: 'US', name: 'United States' }],
        title: 'Updated movie',
      };
      await updateMoviesFromApi(
        database,
        createApi([updatedMovie], [updatedDetails]),
      );

      expect(
        database.prepare('SELECT id, name FROM genres ORDER BY id').all(),
      ).toEqual([
        { id: 18, name: 'Drama' },
        { id: 35, name: 'Comedy' },
      ]);
      expect(
        database
          .prepare('SELECT code, name FROM countries ORDER BY code')
          .all(),
      ).toEqual([
        { code: 'FR', name: 'France' },
        { code: 'US', name: 'United States' },
      ]);
      expect(database.prepare('SELECT id, title FROM movies').all()).toEqual([
        { id: 1, title: 'Updated movie' },
      ]);
      expect(
        database.prepare('SELECT movie_id, genre_id FROM movie_genres').all(),
      ).toEqual([{ movie_id: 1, genre_id: 35 }]);
      expect(
        database
          .prepare('SELECT movie_id, country_code FROM production_countries')
          .all(),
      ).toEqual([{ movie_id: 1, country_code: 'US' }]);
    } finally {
      database.close();
    }
  });

  it('does not request details or modify the database when no movies are returned', async () => {
    // Arrange
    const database = createDatabase();
    try {
      const api = createApi([]);

      // Act
      await updateMoviesFromApi(database, api);

      // Assert
      expect(api.getMovieDetails).not.toHaveBeenCalled();
      expect(database.prepare('SELECT * FROM movies').all()).toEqual([]);
      expect(database.prepare('SELECT * FROM genres').all()).toEqual([]);
      expect(database.prepare('SELECT * FROM countries').all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('stores unknown release dates, runtime, budget, and revenue as null', async () => {
    // Arrange
    const database = createDatabase();
    const movieWithoutFinancialData: MovieDetails = {
      ...details,
      budget: 0,
      production_countries: [],
      release_date: '',
      revenue: 0,
      runtime: null,
    };

    try {
      // Act
      await updateMoviesFromApi(
        database,
        createApi([movie], [movieWithoutFinancialData]),
      );

      // Assert
      expect(
        database
          .prepare(
            'SELECT release_date, runtime_minutes, budget, revenue FROM movies',
          )
          .get(),
      ).toEqual({
        release_date: null,
        runtime_minutes: null,
        budget: null,
        revenue: null,
      });
    } finally {
      database.close();
    }
  });

  it('does not write any data when fetching movie details fails', async () => {
    // Arrange
    const database = createDatabase();
    const api = createApi();
    vi.mocked(api.getMovieDetails).mockRejectedValueOnce(
      new Error('API unavailable'),
    );

    try {
      // Act and Assert
      await expect(updateMoviesFromApi(database, api)).rejects.toThrow(
        'API unavailable',
      );
      expect(database.prepare('SELECT * FROM movies').all()).toEqual([]);
      expect(database.prepare('SELECT * FROM genres').all()).toEqual([]);
      expect(database.prepare('SELECT * FROM countries').all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('rolls back all catalog writes if storing an association fails', async () => {
    // Arrange
    const database = createDatabase();
    database.exec(`
      CREATE TRIGGER reject_production_country
      BEFORE INSERT ON production_countries
      BEGIN
        SELECT RAISE(ABORT, 'association failed');
      END
    `);

    try {
      // Act and Assert
      await expect(updateMoviesFromApi(database, createApi())).rejects.toThrow(
        'association failed',
      );
      expect(database.prepare('SELECT * FROM movies').all()).toEqual([]);
      expect(database.prepare('SELECT * FROM genres').all()).toEqual([]);
      expect(database.prepare('SELECT * FROM countries').all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('uses a savepoint without committing the caller transaction', async () => {
    // Arrange
    const database = createDatabase();
    try {
      database.exec('BEGIN');

      // Act
      await updateMoviesFromApi(database, createApi());

      // Assert
      expect(database.isTransaction).toBe(true);
      expect(database.prepare('SELECT id FROM movies').all()).toEqual([
        { id: 1 },
      ]);
      database.exec('ROLLBACK');
      expect(database.prepare('SELECT * FROM movies').all()).toEqual([]);
    } finally {
      if (database.isTransaction) database.exec('ROLLBACK');
      database.close();
    }
  });

  it('rolls back only its savepoint when an outer transaction update fails', async () => {
    // Arrange
    const database = createDatabase();
    database.exec(`
      CREATE TRIGGER reject_movie_update
      BEFORE INSERT ON movies
      BEGIN
        SELECT RAISE(ABORT, 'movie update failed');
      END
    `);

    try {
      database.exec('BEGIN');

      // Act and Assert
      await expect(updateMoviesFromApi(database, createApi())).rejects.toThrow(
        'movie update failed',
      );
      expect(database.isTransaction).toBe(true);
      expect(database.prepare('SELECT * FROM movies').all()).toEqual([]);
      expect(database.prepare('SELECT * FROM genres').all()).toEqual([]);
      expect(database.prepare('SELECT * FROM countries').all()).toEqual([]);
      database.exec('ROLLBACK');
    } finally {
      if (database.isTransaction) database.exec('ROLLBACK');
      database.close();
    }
  });
});
