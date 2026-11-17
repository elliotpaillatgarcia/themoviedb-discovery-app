import type { Express, Request } from 'express';
import express from 'express';
import { tmdbAccessToken } from '../utils/config';
import { toSupportedMovie } from '../utils/converter';
import type {
  MoviesApiResponse,
  TmdbMoviesRawResponse,
} from '../types/MoviesTypes';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PAGE,
  DEFAULT_REGION,
} from '../utils/constants';

const INVALID_YEAR_MESSAGE =
  'Year must be a four-digit number between 1000 and 9999';

function createDiscoverQueryParams(query: Request['query']): URLSearchParams {
  const year = query.year;
  if (typeof year !== 'string' || !/^\d{4}$/.test(year)) {
    throw new Error(INVALID_YEAR_MESSAGE);
  }

  return new URLSearchParams({
    primary_release_year: year,
    language:
      typeof query.language === 'string' && query.language
        ? query.language
        : DEFAULT_LANGUAGE,
    page:
      typeof query.page === 'string' && query.page
        ? query.page
        : String(DEFAULT_PAGE),
    region:
      typeof query.region === 'string' && query.region
        ? query.region
        : DEFAULT_REGION,
  });
}

export function registerDiscoverApi(app: Express): void {
  app.get(
    '/api/discover/movies',
    async (req: express.Request, res: express.Response) => {
      let queryParams: URLSearchParams;
      try {
        queryParams = createDiscoverQueryParams(req.query);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : INVALID_YEAR_MESSAGE,
        });
        return;
      }

      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/discover/movie?${queryParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${tmdbAccessToken}`,
              'Content-Type': 'application/json;charset=utf-8',
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `TMDB API request failed with status ${response.status}`,
          );
        }

        const rawData = (await response.json()) as TmdbMoviesRawResponse;
        const data: MoviesApiResponse = {
          page: rawData.page,
          results: rawData.results.map(toSupportedMovie),
          total_pages: rawData.total_pages,
          total_results: rawData.total_results,
        };

        res.json(data);
      } catch (error) {
        console.error('Error discovering movies:', error);
        res.status(500).json({ error: 'Failed to discover movies' });
      }
    },
  );
}
