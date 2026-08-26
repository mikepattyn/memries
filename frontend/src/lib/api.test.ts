import { describe, expect, it } from 'vitest';
import { flattenPhotoPages, mapAlbum, mapPhoto, redirectForStatus, wallClockFromApi } from './api';
import type { Photo } from '../models/photo';

describe('api mapping', () => {
  it('maps Arango photos onto the UI model', () => {
    const photo = mapPhoto({
      _key: 'abc123',
      taken_at: '2024-08-25T18:30:01.123456789Z',
      taken_at_local: '2024-08-25T18:30:01',
      dims: { w: 4000, h: 3000 },
    });
    expect(photo).toEqual({
      id: 'abc123',
      imageUrl: '/api/original/abc123',
      thumbnailUrl: '/api/thumb/abc123?size=512',
      takenAt: '2024-08-25T18:30:01',
      width: 4000,
      height: 3000,
      favorite: false,
      alt: 'Photo',
    });
  });

  it('maps favorite true from the API', () => {
    const photo = mapPhoto({
      _key: 'fav1',
      favorite: true,
      taken_at_local: '2024-08-25T18:30:01',
    });
    expect(photo.favorite).toBe(true);
  });

  it('maps favorite false when omitted or explicitly false', () => {
    expect(mapPhoto({ _key: 'a' }).favorite).toBe(false);
    expect(mapPhoto({ _key: 'b', favorite: false }).favorite).toBe(false);
  });

  it('maps album views onto the UI model', () => {
    const album = mapAlbum({
      id: 'album-1',
      name: 'Trip',
      created_at: '2024-01-15T10:00:00Z',
      photo_count: 2,
      cover_photo_id: 'p1',
      photo_ids: ['p1', 'p2'],
    });
    expect(album).toEqual({
      id: 'album-1',
      name: 'Trip',
      createdAt: '2024-01-15T10:00:00Z',
      photoCount: 2,
      coverPhotoId: 'p1',
      photoIds: ['p1', 'p2'],
    });
  });

  it('falls back to a timezone-naive wall clock from taken_at', () => {
    expect(wallClockFromApi('2024-08-25T18:30:01Z')).toBe('2024-08-25T18:30:01');
  });

  it('flattens cursor pages without duplicating ids', () => {
    const a = { id: 'a' } as Photo;
    const b = { id: 'b' } as Photo;
    const pages = flattenPhotoPages([{ photos: [a, b] }, { photos: [b, { id: 'c' } as Photo] }]);
    expect(pages.map((photo) => photo.id)).toEqual(['a', 'b', 'c']);
  });

  it('sends unauthorized callers to login', () => {
    expect(redirectForStatus(401)).toBe('/oauth/login');
    expect(redirectForStatus(200)).toBeNull();
    expect(redirectForStatus(500)).toBeNull();
  });
});
