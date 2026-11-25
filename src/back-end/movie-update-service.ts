import type { DatabaseSync } from 'node:sqlite';
import type {
  Country,
  Movie,
  MovieDetails,
  MoviesApiResponse,
} from './types/MoviesTypes';

export type MovieUpdateApi = {
  getMovies: () => Promise<Movie[]>;
  getMovieDetails: (id: number) => Promise<MovieDetails>;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Movie update API request failed with status ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

export function createMovieUpdateApi(
  baseUrl = 'http://localhost:3000',
): MovieUpdateApi {
  const apiUrl = baseUrl.replace(/\/$/, '');
  return {
    async getMovies() {
      const data = await getJson<MoviesApiResponse>(
        `${apiUrl}/api/movies/popular`,
      );
      return data.results;
    },
    getMovieDetails(id) {
      return getJson<MovieDetails>(`${apiUrl}/api/movies/${id}`);
    },
  };
}

function uniqueGenres(details: MovieDetails[]) {
  const genres = new Map<number, { id: number; name: string }>();
  for (const detail of details) {
    for (const genre of detail.genres) {
      genres.set(genre.id, genre);
    }
  }
  return [...genres.values()];
}

function uniqueCountries(details: MovieDetails[]): Country[] {
  const countries = new Map<string, Country>();
  for (const detail of details) {
    for (const country of detail.production_countries) {
      countries.set(country.iso_3166_1, {
        code: country.iso_3166_1,
        name: country.name,
      });
    }
  }
  return [...countries.values()];
}

function upsertCatalogues(
  database: DatabaseSync,
  details: MovieDetails[],
): void {
  const upsertGenre = database.prepare(`
    INSERT INTO genres (id, name) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `);
  for (const genre of uniqueGenres(details)) {
    upsertGenre.run(genre.id, genre.name);
  }

  const upsertCountry = database.prepare(`
    INSERT INTO countries (code, name) VALUES (?, ?)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name
  `);
  for (const country of uniqueCountries(details)) {
    upsertCountry.run(country.code, country.name);
  }
}

function upsertMovieDetails(
  database: DatabaseSync,
  details: MovieDetails[],
): void {
  const statement = database.prepare(`
    INSERT INTO movies (
      id, title, original_title, original_language, overview,
      release_date, popularity, vote_average, vote_count,
      poster_path, backdrop_path, runtime_minutes, budget, revenue, collected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      original_title = excluded.original_title,
      original_language = excluded.original_language,
      overview = excluded.overview,
      release_date = excluded.release_date,
      popularity = excluded.popularity,
      vote_average = excluded.vote_average,
      vote_count = excluded.vote_count,
      poster_path = excluded.poster_path,
      backdrop_path = excluded.backdrop_path,
      runtime_minutes = excluded.runtime_minutes,
      budget = excluded.budget,
      revenue = excluded.revenue,
      collected_at = excluded.collected_at
  `);
  const collectedAt = new Date().toISOString();

  for (const detail of details) {
    statement.run(
      detail.id,
      detail.title,
      detail.original_title,
      detail.original_language,
      detail.overview,
      detail.release_date || null,
      detail.popularity,
      detail.vote_average,
      detail.vote_count,
      detail.poster_path,
      detail.backdrop_path,
      detail.runtime && detail.runtime > 0 ? detail.runtime : null,
      detail.budget > 0 ? detail.budget : null,
      detail.revenue > 0 ? detail.revenue : null,
      collectedAt,
    );
  }
}

function updateAssociations(
  database: DatabaseSync,
  details: MovieDetails[],
): void {
  const deleteGenres = database.prepare(
    'DELETE FROM movie_genres WHERE movie_id = ?',
  );
  const insertGenre = database.prepare(
    'INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)',
  );
  const deleteCountries = database.prepare(
    'DELETE FROM production_countries WHERE movie_id = ?',
  );
  const insertCountry = database.prepare(
    'INSERT INTO production_countries (movie_id, country_code) VALUES (?, ?)',
  );

  for (const detail of details) {
    deleteGenres.run(detail.id);
    for (const genreId of new Set(detail.genres.map(({ id }) => id))) {
      insertGenre.run(detail.id, genreId);
    }

    deleteCountries.run(detail.id);
    for (const countryCode of new Set(
      detail.production_countries.map(({ iso_3166_1 }) => iso_3166_1),
    )) {
      insertCountry.run(detail.id, countryCode);
    }
  }
}

export async function updateMoviesFromApi(
  database: DatabaseSync,
  api: MovieUpdateApi,
): Promise<void> {
  const movies = await api.getMovies();
  if (movies.length === 0) return;

  const details = await Promise.all(
    movies.map(({ id }) => api.getMovieDetails(id)),
  );
  const hasOuterTransaction = database.isTransaction;
  const savepoint = 'update_movies_from_api';

  if (hasOuterTransaction) database.exec(`SAVEPOINT ${savepoint}`);
  else database.exec('BEGIN');

  try {
    upsertCatalogues(database, details);
    upsertMovieDetails(database, details);
    updateAssociations(database, details);
    if (hasOuterTransaction) database.exec(`RELEASE SAVEPOINT ${savepoint}`);
    else database.exec('COMMIT');
  } catch (error) {
    if (hasOuterTransaction) {
      database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      database.exec(`RELEASE SAVEPOINT ${savepoint}`);
    } else {
      database.exec('ROLLBACK');
    }
    throw error;
  }
}
