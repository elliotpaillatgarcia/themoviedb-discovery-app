import { useEffect, useState } from 'react';
import MovieItem from '../../components/MovieItem/MovieItem';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PAGE,
  DEFAULT_REGION,
} from '../../../back-end/utils/constants';
import type { Movie } from '../../../back-end/types/MoviesTypes';

export default function MoviesListPage() {
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const urlParams = new URLSearchParams(window.location.search);
    const language = urlParams.get('language') || DEFAULT_LANGUAGE;
    const page = urlParams.get('page') || DEFAULT_PAGE;
    const region = urlParams.get('region') || DEFAULT_REGION;

    async function fetchMovies() {
      try {
        const response = await fetch(
          `/api/movies/popular?language=${language}&page=${page}&region=${region}`,
        );
        const data = (await response.json()) as {
          results?: Movie[];
        };

        if (!response.ok || !Array.isArray(data.results)) {
          throw new Error('Movie request failed');
        }

        if (active) {
          setMovies(data.results);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }

    void fetchMovies();

    return () => {
      active = false;
    };
  }, [retryCount]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Films populaires</h1>
        <h2>
          Films tendances en France, d'après les données de{' '}
          <b>The Movie Database</b>
        </h2>
      </header>
      <section>
        {loading ? (
          <p className="status-message">Loading...</p>
        ) : error ? (
          <div className="status-message" role="alert">
            <p>
              Impossible de charger les films. Vérifiez la connexion à TMDB.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(false);
                setRetryCount((count) => count + 1);
              }}
            >
              Réessayer
            </button>
          </div>
        ) : movies?.length ? (
          <ul className="movie-grid">
            {movies.map((movie) => (
              <li key={movie.id}>
                <article>
                  <MovieItem movie={movie} />
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p className="status-message">Aucun film trouvé.</p>
        )}
      </section>
    </main>
  );
}
