import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatCompactDate, formatTime } from '../lib/formatDate';
import { photoViewerAlt } from '../lib/photoName';
import { testPhoto } from '../test/fixtures';
import { PhotoViewer } from './PhotoViewer';

const photo = testPhoto();

describe('PhotoViewer', () => {
  it('names the dialog from TakenAt and describes the Original', () => {
    render(
      <PhotoViewer
        photos={[photo]}
        activeId={photo.id}
        origin={null}
        onClose={() => {}}
        onChange={() => {}}
        onToggleFavorite={() => {}}
        albums={[]}
        onAddToAlbum={() => {}}
      />,
    );
    const title = `${formatCompactDate(photo.takenAt)} · ${formatTime(photo.takenAt)}`;
    expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeTruthy();
    expect(screen.getByRole('img')).toHaveAttribute('alt', photoViewerAlt(photo));
    expect(screen.getByRole('status')).toHaveTextContent('1 of 1');
    expect(screen.getByRole('button', { name: 'Close photo' })).toBeTruthy();
  });
});
