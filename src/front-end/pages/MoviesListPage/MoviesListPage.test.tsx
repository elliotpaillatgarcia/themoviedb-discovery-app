// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PAGE,
  DEFAULT_REGION,
} from '../../../back-end/utils/constants';
import type { Movie } from '../../../back-end/types/MoviesTypes';
import MoviesListPage from './MoviesListPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

const movie = {
  id: 123,
  title: 'Example Movie',
  release_date: '2024-05-10',
  vote_average: 7.456,
  poster_path: '/example-poster.jpg',
} as Movie;

function renderMoviesListPage() {
  return render(
    <MemoryRouter>
      <MoviesListPage />
    </MemoryRouter>,
  );
}

function mockMoviesResponse(results: Movie[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results }),
    }),
  );
}

describe('MoviesListPage', () => {
  it('shows the loading state and renders movies fetched with URL parameters', async () => {
    // Arrange: provide query parameters and a mocked API response.
    window.history.replaceState({}, '', '/?language=fr-FR&page=2&region=FR');
    mockMoviesResponse([movie]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act: render the page and wait for the fetched movie to appear.
    renderMoviesListPage();

    expect(screen.getByText('Loading...')).toBeTruthy();

    const movieHeading = await screen.findByRole('heading', {
      level: 2,
      name: movie.title,
    });

    // Assert: the request uses the URL parameters and the movie is displayed.
    expect(fetch).toHaveBeenCalledWith(
      '/api/movies/popular?language=fr-FR&page=2&region=FR',
    );
    expect(movieHeading).toBeTruthy();
    expect(
      screen
        .getByRole('img', { name: `Affiche de ${movie.title}` })
        .getAttribute('src'),
    ).toBe('https://image.tmdb.org/t/p/w185/example-poster.jpg');
    expect(
      screen
        .getByRole('link', { name: new RegExp(movie.title) })
        .getAttribute('href'),
    ).toBe(`/movies/${movie.id}`);
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('uses the default query parameters when none are provided in the URL', async () => {
    // Arrange: mock an empty API response with no URL query parameters.
    mockMoviesResponse([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act: render the page and wait for the request to be issued.
    renderMoviesListPage();

    await screen.findByRole('heading', {
      level: 1,
      name: 'Films populaires',
    });

    // Assert: the request uses the configured default values.
    expect(fetch).toHaveBeenCalledWith(
      `/api/movies/popular?language=${DEFAULT_LANGUAGE}&page=${DEFAULT_PAGE}&region=${DEFAULT_REGION}`,
    );
  });

  it('shows an empty state when the API returns no movies', async () => {
    // Arrange
    mockMoviesResponse([]);

    // Act
    renderMoviesListPage();

    // Assert
    expect(await screen.findByText('Aucun film trouvé.')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('shows an error when the API response does not contain movie results', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ error: 'Unexpected response' }),
      }),
    );

    // Act
    renderMoviesListPage();

    // Assert
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('ignores a request failure that arrives after the page unmounts', async () => {
    // Arrange
    let rejectFetch!: (error: Error) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectFetch = reject;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = renderMoviesListPage();

    // Act
    unmount();
    await act(async () => {
      rejectFetch(new Error('Network unavailable'));
    });

    // Assert
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('ignores a successful response that arrives after the page unmounts', async () => {
    // Arrange
    let resolveFetch!: (response: {
      ok: boolean;
      json: () => Promise<{ results: Movie[] }>;
    }) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<{
          ok: boolean;
          json: () => Promise<{ results: Movie[] }>;
        }>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = renderMoviesListPage();

    // Act
    unmount();
    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ results: [movie] }) });
    });

    // Assert
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('shows a useful error after request failures and retries successfully', async () => {
    // Arrange: simulate a backend 500, a network rejection, then a successful retry.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: vi
          .fn()
          .mockResolvedValue({ error: 'Failed to fetch popular movies' }),
      })
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [movie] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    // Act: render, then retry after each failure.
    renderMoviesListPage();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    // Assert: the successful retry displays the movie and clears the error state.
    expect(
      await screen.findByRole('heading', { level: 2, name: movie.title }),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
