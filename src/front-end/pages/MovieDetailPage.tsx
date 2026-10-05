import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { MovieDetails } from '../../back-end/schemas/MoviesTypes';

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const hasMissingId = !id;
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(!hasMissingId);
  const [error, setError] = useState<string | null>(
    hasMissingId ? 'Aucun identifiant de film fourni.' : null,
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    let isMounted = true;

    async function fetchMovieDetails() {
      try {
        const response = await fetch(`/api/movies/${id}`);

        if (!response.ok) {
          throw new Error('Impossible de charger les détails du film.');
        }

        const data = (await response.json()) as MovieDetails;

        if (isMounted) {
          setMovie(data);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Une erreur est survenue lors du chargement du film.',
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchMovieDetails();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <main className="app-shell movie-detail-page">
      <h1 className="movie-detail-title">Détails du film</h1>

      <Link className="movie-detail-backlink" to="/movies">
        ← Retour vers les films populaires
      </Link>

      {loading && <p className="status-message">Chargement du film...</p>}

      {error && (
        <p className="status-message" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && movie && (
        <article className="movie-detail-card">
          <div className="movie-detail-poster-panel">
            {movie.poster_path ? (
              <img
                className="movie-detail-poster"
                src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`}
                alt={`Affiche de ${movie.title}`}
              />
            ) : (
              <div className="movie-detail-poster movie-detail-poster--fallback" />
            )}
          </div>

          <div className="movie-detail-info">
            <p className="movie-detail-kicker">DÉTAILS DU FILM</p>
            <h2>{movie.title}</h2>
            {movie.tagline && (
              <p className="movie-detail-tagline">{movie.tagline}</p>
            )}

            <div className="movie-detail-badges">
              {movie.release_date && (
                <span>{`Année de sortie ${new Date(movie.release_date).getFullYear()}`}</span>
              )}
              <span>{`Note ${movie.vote_average.toFixed(1)}`}</span>
            </div>

            {movie.genres && movie.genres.length > 0 && (
              <>
                <h3>Genres</h3>
                <div className="movie-detail-genres">
                  {movie.genres.map((genre) => (
                    <span key={genre.id} className="movie-detail-genre">
                      {genre.name}
                    </span>
                  ))}
                </div>
              </>
            )}

            <h3>Résumé</h3>
            <p className="movie-detail-overview">
              {movie.overview || 'Aucun résumé disponible pour ce film.'}
            </p>
          </div>
        </article>
      )}
    </main>
  );
}
