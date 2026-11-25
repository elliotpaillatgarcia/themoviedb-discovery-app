import './MoviesCountWidget.css';

export type MoviesCountWidgetProps = {
  count?: number | null;
  loading?: boolean;
  error?: string | null;
};

export default function MoviesCountWidget({
  count,
  loading = false,
  error = null,
}: MoviesCountWidgetProps) {
  const hasValidCount =
    typeof count === 'number' && Number.isFinite(count) && count >= 0;

  return (
    <section className="movies-count-widget" aria-label="Films en base">
      <h2 className="movies-count-widget__title">Films en base</h2>
      <p className="movies-count-widget__subtitle">Effectif du catalogue</p>

      {loading ? (
        <p className="movies-count-widget__status" role="status">
          Chargement…
        </p>
      ) : error ? (
        <p
          className="movies-count-widget__status movies-count-widget__status--error"
          role="alert"
        >
          {error}
        </p>
      ) : hasValidCount ? (
        <p className="movies-count-widget__value">
          <span className="movies-count-widget__number">
            {new Intl.NumberFormat('fr-FR').format(count)}
          </span>{' '}
          <span className="movies-count-widget__unit">films</span>
        </p>
      ) : (
        <p className="movies-count-widget__status">Donnée indisponible</p>
      )}
    </section>
  );
}
