// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MoviesCountWidget from './MoviesCountWidget';
import * as stories from './MoviesCountWidget.stories';

afterEach(cleanup);

describe('MoviesCountWidget', () => {
  it('renders the nominal movie count from its Storybook story', () => {
    // Arrange and act
    render(<MoviesCountWidget {...stories.Nominal.args} />);

    // Assert
    expect(screen.getByRole('region', { name: 'Films en base' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Films en base' }),
    ).toBeTruthy();
    expect(screen.getByText('Effectif du catalogue')).toBeTruthy();
    expect(screen.getByText(/1\s*000/)).toBeTruthy();
    expect(screen.getByText('films')).toBeTruthy();
  });

  it('distinguishes zero films from unavailable data', () => {
    // Arrange, act, and assert
    const { unmount } = render(
      <MoviesCountWidget {...stories.ZeroFilm.args} />,
    );
    expect(screen.getByText(/^0$/)).toBeTruthy();
    expect(screen.getByText('films')).toBeTruthy();
    expect(screen.queryByText('Donnée indisponible')).toBeNull();
    unmount();

    render(<MoviesCountWidget {...stories.AbsenceDeDonnees.args} />);
    expect(screen.getByText('Donnée indisponible')).toBeTruthy();
  });

  it('renders the loading and error states from their Storybook stories', () => {
    // Arrange, act, and assert
    const { unmount } = render(
      <MoviesCountWidget {...stories.Chargement.args} />,
    );
    expect(screen.getByRole('status').textContent).toBe('Chargement…');
    unmount();

    render(<MoviesCountWidget {...stories.Erreur.args} />);
    expect(screen.getByRole('alert').textContent).toBe(
      'Impossible de charger le nombre de films.',
    );
  });

  it('does not display negative or non-finite counts as valid catalogue data', () => {
    // Arrange
    const { rerender } = render(<MoviesCountWidget count={-1} />);

    // Act and assert
    expect(screen.getByText('Donnée indisponible')).toBeTruthy();
    rerender(<MoviesCountWidget count={Number.NaN} />);
    expect(screen.getByText('Donnée indisponible')).toBeTruthy();
  });
});
