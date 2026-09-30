import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Movie } from '../../back-end/schemas/MoviesTypes';
import MovieItem from '../components/MovieItem';

export default function MoviesListPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPopularMovies() {
      try {
        const response = await fetch('/api/movies/popular');

        if (!response.ok) {
          throw new Error('Impossible de charger les films populaires.');
        }

        const data = (await response.json()) as { results?: Movie[] };

        if (!Array.isArray(data.results)) {
          throw new Error('Aucune donnée de films disponible.');
        }

        if (isMounted) {
          setMovies(data.results);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Une erreur est survenue lors du chargement.',
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPopularMovies();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Movies</h1>
        <h2>Popular movies</h2>
      </header>

      {loading && <p className="status-message">Chargement des films...</p>}

      {error && (
        <p className="status-message" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && movies.length === 0 && (
        <p className="status-message">Aucun film disponible pour le moment.</p>
      )}

      {!loading && !error && movies.length > 0 && (
        <ul className="movie-grid">
          {movies.map((movie) => (
            <li key={movie.id}>
              <Link className="movie-card-link" to={`/movies/${movie.id}`}>
                <MovieItem movie={movie} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
