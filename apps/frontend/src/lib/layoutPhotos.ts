import type { Granularity, Photo } from '../models/photo';

export type LayoutRow =
  | { kind: 'thumbs'; photos: Photo[] }
  | { kind: 'feature'; photo: Photo }
  | { kind: 'landscape'; photo: Photo }
  | { kind: 'pair'; photos: Photo[] }
  | { kind: 'triple'; photos: Photo[] }
  | { kind: 'day'; photo: Photo };

function isLandscape(photo: Photo): boolean {
  return photo.width / photo.height >= 1.32;
}

export function layoutPhotos(photos: Photo[], granularity: Granularity): LayoutRow[] {
  if (photos.length === 0) return [];
  if (granularity === 'year') return [{ kind: 'thumbs', photos }];
  if (granularity === 'day') return photos.map((photo) => ({ kind: 'day', photo }));

  const rows: LayoutRow[] = [];
  let i = 0;
  let usedFeature = false;

  while (i < photos.length) {
    const photo = photos[i];

    if (granularity === 'week' && !usedFeature && i === 0) {
      rows.push({ kind: 'feature', photo });
      usedFeature = true;
      i += 1;
      continue;
    }

    if (isLandscape(photo)) {
      rows.push({ kind: granularity === 'month' && i === 0 ? 'feature' : 'landscape', photo });
      i += 1;
      continue;
    }

    const rest = photos.slice(i);
    const nextWideAt = rest.findIndex((item, idx) => idx > 0 && isLandscape(item));
    const run = nextWideAt === -1 ? rest.length : nextWideAt;

    if (run >= 3 && granularity === 'week') {
      rows.push({ kind: 'triple', photos: photos.slice(i, i + 3) });
      i += 3;
      continue;
    }

    if (run >= 3 && (i + photos.length) % 4 === 0) {
      rows.push({ kind: 'triple', photos: photos.slice(i, i + 3) });
      i += 3;
      continue;
    }

    if (run >= 2) {
      rows.push({ kind: 'pair', photos: photos.slice(i, i + 2) });
      i += 2;
      continue;
    }

    rows.push({ kind: 'feature', photo });
    i += 1;
  }

  return rows;
}
