import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { testAlbum } from '../test/fixtures';
import { AlbumsView } from './AlbumsView';

describe('AlbumsView', () => {
  it('uses a page heading and names Album cards', () => {
    render(
      <AlbumsView
        albums={[testAlbum({ name: 'Summer', photoCount: 2 })]}
        onCreate={() => {}}
        onOpen={() => {}}
        creating={false}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Albums' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New album' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open album Summer, 2 photos' })).toBeTruthy();
    expect(screen.getByRole('list')).toContainElement(
      screen.getByRole('button', { name: 'Open album Summer, 2 photos' }),
    );
  });

  it('announces when there are no Albums yet', () => {
    render(<AlbumsView albums={[]} onCreate={() => {}} onOpen={() => {}} creating={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('No albums yet.');
  });
});
