import { formatDayLabel, formatTime } from "./formatDate";

export function photoWhen(photo: { takenAt: string }): string {
  return `${formatDayLabel(photo.takenAt)}, ${formatTime(photo.takenAt)}`;
}

export function photoOpenLabel(photo: { takenAt: string; favorite: boolean }): string {
  const when = photoWhen(photo);
  return photo.favorite ? `Open favorited photo, ${when}` : `Open photo, ${when}`;
}

export function photoViewerAlt(photo: { takenAt: string; favorite: boolean; alt?: string }): string {
  const name = photo.alt?.trim() ? photo.alt.trim() : "Photo";
  const when = photoWhen(photo);
  return photo.favorite ? `${name}, ${when}, favorited` : `${name}, ${when}`;
}
