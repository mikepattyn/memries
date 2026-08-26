import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { testAlbum, testPhoto } from '../test/fixtures';
import { PhotoActionsMenu } from './PhotoActionsMenu';

describe('PhotoActionsMenu', () => {
  it('presents actions as a dialog, not a menu', () => {
    render(
      <PhotoActionsMenu
        photo={testPhoto()}
        albums={[testAlbum()]}
        onClose={() => {}}
        onToggleFavorite={() => {}}
        onAddToAlbum={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Photo actions' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Photo actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add to favorites' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
