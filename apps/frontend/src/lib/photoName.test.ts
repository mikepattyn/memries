import { describe, expect, it } from 'vitest';
import { formatDayLabel, formatTime } from './formatDate';
import { photoOpenLabel, photoViewerAlt, photoWhen } from './photoName';

const photo = { takenAt: '2026-08-26T10:00:00', favorite: false, alt: 'Photo' };

describe('photoName', () => {
  it('joins the capture day and time', () => {
    expect(photoWhen(photo)).toBe(`${formatDayLabel(photo.takenAt)}, ${formatTime(photo.takenAt)}`);
  });

  it('names a timeline Photo control from TakenAt', () => {
    expect(photoOpenLabel(photo)).toBe(`Open photo, ${photoWhen(photo)}`);
    expect(photoOpenLabel({ ...photo, favorite: true })).toBe(
      `Open favorited photo, ${photoWhen(photo)}`,
    );
  });

  it('describes the Original in the photo viewer', () => {
    expect(photoViewerAlt(photo)).toBe(`Photo, ${photoWhen(photo)}`);
    expect(photoViewerAlt({ ...photo, favorite: true })).toBe(
      `Photo, ${photoWhen(photo)}, favorited`,
    );
  });
});
