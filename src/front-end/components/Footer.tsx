import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__content">
        <p className="footer__copyright">TMDB Discovery</p>

        <ul className="footer__links">
          <li>
            <a
              href="https://github.com/elliotpaillatgarcia/themoviedb-discovery-app"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </li>
          <li>
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noreferrer"
            >
              The Movie Database
            </a>
          </li>
          <li>Version {__APP_VERSION__}</li>
        </ul>
      </div>
    </footer>
  );
}
