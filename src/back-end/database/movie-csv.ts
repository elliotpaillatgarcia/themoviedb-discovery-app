import type { DatabaseSync } from 'node:sqlite';
import { type MovieInput, upsertMovies } from './movie-repository';

const REQUIRED_HEADERS = [
  'id',
  'title',
  'original_title',
  'original_language',
  'overview',
  'release_date',
  'popularity',
  'vote_average',
  'vote_count',
  'poster_path',
  'backdrop_path',
  'runtime',
  'budget',
  'revenue',
];

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== '')) rows.push(row);
  }

  return rows;
}

function parseNullableNumber(value: string, field: string): number | null {
  if (value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid ${field} value: ${value}`);
  }
  return number;
}

function parseRequiredNumber(value: string, field: string): number {
  const number = parseNullableNumber(value, field);
  if (number === null) throw new Error(`${field} cannot be empty`);
  return number;
}

export function parseMoviesCsv(
  content: string,
  collectedAt = new Date().toISOString(),
): MovieInput[] {
  const rows = parseCsvRows(content);
  const headers = rows[0];
  if (
    !headers ||
    (headers.length !== REQUIRED_HEADERS.length &&
      headers.length !== REQUIRED_HEADERS.length + 2)
  ) {
    throw new Error(`CSV headers must contain: ${REQUIRED_HEADERS.join(',')}`);
  }

  for (const [index, header] of REQUIRED_HEADERS.entries()) {
    if (headers[index] !== header) {
      throw new Error(
        `CSV headers must contain: ${REQUIRED_HEADERS.join(',')}`,
      );
    }
  }

  return rows.slice(1).map((row, index) => {
    if (row.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has an invalid number of columns`);
    }

    const id = parseRequiredNumber(row[0]!, 'id');
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Invalid id value: ${row[0]}`);
    }

    return {
      id,
      title: row[1]!,
      original_title: row[2]!,
      original_language: row[3]!,
      overview: row[4]!,
      release_date: row[5] || null,
      popularity: parseNullableNumber(row[6]!, 'popularity'),
      vote_average: parseNullableNumber(row[7]!, 'vote_average'),
      vote_count: parseNullableNumber(row[8]!, 'vote_count'),
      poster_path: row[9] || null,
      backdrop_path: row[10] || null,
      runtime_minutes: parseNullableNumber(row[11]!, 'runtime'),
      budget: parseNullableNumber(row[12]!, 'budget'),
      revenue: parseNullableNumber(row[13]!, 'revenue'),
      collected_at: collectedAt,
    };
  });
}

export function importMoviesFromCsv(
  database: DatabaseSync,
  content: string,
  collectedAt?: string,
): number {
  const movies = parseMoviesCsv(content, collectedAt);
  upsertMovies(database, movies);
  return movies.length;
}
