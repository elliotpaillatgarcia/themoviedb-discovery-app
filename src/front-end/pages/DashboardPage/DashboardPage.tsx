import './DashboardPage.css';

export default function DashboardPage() {
  return (
    <main className="app-shell dashboard-page">
      <header className="dashboard-page__header">
        <p className="dashboard-page__eyebrow">TMDB Discovery</p>
        <h1>Tableau de bord des films</h1>
        <p className="dashboard-page__intro">
          Vue d’ensemble des films, de leurs genres et de leurs pays de
          production.
        </p>
      </header>
    </main>
  );
}
