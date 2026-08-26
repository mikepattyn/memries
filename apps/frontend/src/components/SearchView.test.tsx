import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SearchState } from '../models/photo';
import { testPhoto } from '../test/fixtures';
import { SearchView } from './SearchView';

const emptySearch: SearchState = {
  query: '',
  years: [],
  favoritesOnly: false,
  openCategory: null,
};

describe('SearchView', () => {
  it('uses a page heading and names the search field', () => {
    render(
      <SearchView
        photos={[]}
        facetPhotos={[]}
        search={emptySearch}
        onSearchChange={() => {}}
        onOpen={() => {}}
        autoFocus={false}
        ready
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search memories' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Years' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('exposes year facets as a labelled group', () => {
    render(
      <SearchView
        photos={[testPhoto()]}
        facetPhotos={[testPhoto()]}
        search={{ ...emptySearch, openCategory: 'years' }}
        onSearchChange={() => {}}
        onOpen={() => {}}
        autoFocus={false}
        ready
      />,
    );
    const yearsToggle = screen.getByRole('button', { name: 'Years', expanded: true });
    expect(yearsToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Years' })).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('1 result');
  });
});
