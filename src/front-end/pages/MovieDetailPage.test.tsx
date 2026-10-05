import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MovieDetailPage from './MovieDetailPage';

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useParams: () => ({ id: '1' }),
}));

describe('MovieDetailPage', () => {
  it('renders the movie detail page shell', () => {
    const html = renderToStaticMarkup(<MovieDetailPage />);

    expect(html).toContain('Détails du film');
    expect(html).toContain('Retour vers les films populaires');
  });
});
