import { describe, expect, it } from 'vitest';

import { toSupportedMovie } from './utils';

describe('toSupportedMovie', () => {
  it('maps a TMDB movie to the supported app shape and removes adult/video fields', () => {
    const rawMovie = {
      adult: true,
      backdrop_path: '/backdrop.jpg',
      genre_ids: [28, 12],
      id: 42,
      original_language: 'en',
      original_title: 'Original Title',
      overview: 'A great movie overview.',
      popularity: 99.9,
      poster_path: '/poster.jpg',
      release_date: '2024-01-15',
      title: 'My Movie',
      video: false,
      vote_average: 8.7,
      vote_count: 1234,
    };

    expect(toSupportedMovie(rawMovie)).toEqual({
      backdrop_path: '/backdrop.jpg',
      genre_ids: [28, 12],
      id: 42,
      original_language: 'en',
      original_title: 'Original Title',
      overview: 'A great movie overview.',
      popularity: 99.9,
      poster_path: '/poster.jpg',
      release_date: '2024-01-15',
      title: 'My Movie',
      vote_average: 8.7,
      vote_count: 1234,
    });

    const supportedMovie = toSupportedMovie(rawMovie);
    expect(supportedMovie).not.toHaveProperty('adult');
    expect(supportedMovie).not.toHaveProperty('video');
  });
});
