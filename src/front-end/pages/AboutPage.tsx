import './AboutPage.css';

const technologies = [
  ['TypeScript', 'Typage et fiabilité'],
  ['React', 'Interface composable'],
  ['Node.js + Express', 'API légère'],
  ['Vite', 'Développement rapide'],
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <header className="about-page__header">
        <p className="about-page__eyebrow">TMDB DISCOVERY</p>
        <h1>À propos de l&apos;application</h1>
        <p className="about-page__intro">
          Une application de découverte de films, pensée comme une expérience
          web claire, rapide et maintenable.
        </p>
      </header>

      <section className="about-page__section about-page__project">
        <div>
          <p className="about-page__eyebrow">LE PROJET</p>
          <h2>Découvrir, comparer, choisir</h2>
        </div>
        <p>
          Cette application utilise l&apos;API de The Movie Database pour rendre
          les films populaires faciles à explorer. Elle démontre la construction
          d&apos;une application complète, du front-end à l&apos;API.
        </p>
      </section>

      <section className="about-page__section about-page__stack">
        <div>
          <p className="about-page__eyebrow">FONDATIONS TECHNIQUES</p>
          <h2>Une stack volontairement simple</h2>
        </div>
        <ul className="about-page__technologies">
          {technologies.map(([name, description]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span>{description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-page__source">
        <div>
          <p className="about-page__eyebrow">CODE SOURCE</p>
          <h2>Voir la réalisation du projet</h2>
        </div>
        <a
          href="https://github.com/elliotpaillatgarcia/themoviedb-discovery-app"
          target="_blank"
          rel="noreferrer"
        >
          Ouvrir le dépôt GitHub
        </a>
      </section>
    </main>
  );
}
