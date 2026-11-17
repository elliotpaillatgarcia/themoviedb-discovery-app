import type { Express, Request, RequestHandler, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PAGE,
  DEFAULT_REGION,
} from '../utils/constants';
import { tmdbAccessToken } from '../utils/config';
import { registerDiscoverApi } from './discover-api';
import type { TmdbMoviesRawResponse } from '../types/MoviesTypes';

const { toSupportedMovieMock } = vi.hoisted(() => ({
  toSupportedMovieMock: vi.fn(),
}));

vi.mock('../utils/converter', () => ({
  toSupportedMovie: toSupportedMovieMock,
}));

vi.mock('../utils/config', () => ({
  tmdbAccessToken: 'test-access-token',
}));

type RouteHandler = (
  req: Request,
  res: Response,
  next: (error?: unknown) => void,
) => void | Promise<void>;

const handlers = new Map<string, RequestHandler>();
const app = {
  get: (path: string, handler: RequestHandler) => handlers.set(path, handler),
} as unknown as Express;

function getHandler(): RouteHandler {
  const handler = handlers.get('/api/discover/movies');
  if (!handler) throw new Error('Discover route was not registered');
  return handler as RouteHandler;
}

function createResponse() {
  const response = { json: vi.fn(), status: vi.fn() };
  response.status.mockReturnValue(response);
  return response as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
}

function tmdbResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe('discover API', () => {
  beforeEach(() => {
    handlers.clear();
    registerDiscoverApi(app);
    toSupportedMovieMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects missing, invalid, repeated, and structured years without calling TMDB', async () => {
    // Arrange
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const queries = [
      {},
      { year: '999' },
      { year: '10000' },
      { year: '20a0' },
      { year: ['2020', '2021'] },
      { year: { value: '2020' } },
    ];

    // Act and Assert
    for (const query of queries) {
      const response = createResponse();
      await getHandler()({ query } as unknown as Request, response, vi.fn());
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        error: 'Year must be a four-digit number between 1000 and 9999',
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('discovers movies with defaults and converts the returned results', async () => {
    // Arrange
    const rawMovie = { id: 1 };
    const supportedMovie = { id: 1, title: 'Movie' };
    const rawData = {
      page: 1,
      results: [rawMovie],
      total_pages: 2,
      total_results: 1,
    } as unknown as TmdbMoviesRawResponse;
    const fetchMock = vi.fn().mockResolvedValue(tmdbResponse(rawData));
    vi.stubGlobal('fetch', fetchMock);
    toSupportedMovieMock.mockReturnValue(supportedMovie);
    const response = createResponse();

    // Act
    await getHandler()(
      { query: { year: '2020' } } as unknown as Request,
      response,
      vi.fn(),
    );

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.themoviedb.org/3/discover/movie?primary_release_year=2020&language=${DEFAULT_LANGUAGE}&page=${DEFAULT_PAGE}&region=${DEFAULT_REGION}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${tmdbAccessToken}`,
        }),
      }),
    );
    expect(toSupportedMovieMock).toHaveBeenCalledWith(
      rawMovie,
      0,
      expect.arrayContaining([rawMovie]),
    );
    expect(response.json).toHaveBeenCalledWith({
      page: 1,
      results: [supportedMovie],
      total_pages: 2,
      total_results: 1,
    });
  });

  it('forwards custom options and preserves an empty result page', async () => {
    // Arrange
    const rawData = {
      page: 2,
      results: [],
      total_pages: 2,
      total_results: 0,
    } as TmdbMoviesRawResponse;
    const fetchMock = vi.fn().mockResolvedValue(tmdbResponse(rawData));
    vi.stubGlobal('fetch', fetchMock);
    const response = createResponse();

    // Act
    await getHandler()(
      {
        query: { year: '2020', language: 'en-US', page: '2', region: 'US' },
      } as unknown as Request,
      response,
      vi.fn(),
    );

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/discover/movie?primary_release_year=2020&language=en-US&page=2&region=US',
      expect.any(Object),
    );
    expect(response.json).toHaveBeenCalledWith(rawData);
  });

  it('returns a 500 error and logs unsuccessful, network, and JSON failures', async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tmdbResponse({}, false, 503))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
      });
    vi.stubGlobal('fetch', fetchMock);

    // Act
    const responses = [];
    for (let index = 0; index < 3; index += 1) {
      const response = createResponse();
      await getHandler()(
        { query: { year: '2020' } } as unknown as Request,
        response,
        vi.fn(),
      );
      responses.push(response);
    }

    // Assert
    for (const response of responses) {
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        error: 'Failed to discover movies',
      });
    }
    expect(console.error).toHaveBeenCalledTimes(3);
  });
});
