// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DashboardPage from './DashboardPage';

afterEach(cleanup);

describe('DashboardPage', () => {
  it('renders the dashboard heading and overview without widgets', () => {
    // Arrange and act
    render(<DashboardPage />);

    // Assert
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Tableau de bord des films',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Vue d’ensemble des films, de leurs genres et de leurs pays de production.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
  });
});
