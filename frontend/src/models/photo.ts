export type Granularity = "year" | "month" | "week" | "day";

export type NavTab = "memories" | "albums" | "favorites" | "search";

export interface Album {
  id: string;
  name: string;
  createdAt: string;
  photoIds: string[];
}

export interface Photo {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  takenAt: string;
  location?: string;
  caption?: string;
  width: number;
  height: number;
  favorite: boolean;
  people?: string[];
  alt: string;
}

export interface TimelineGroup {
  key: string;
  label: string;
  sublabel: string;
  photos: Photo[];
}

export type SearchCategory = "places" | "years" | "favorites";

export interface SearchState {
  query: string;
  places: string[];
  years: string[];
  favoritesOnly: boolean;
  openCategory: SearchCategory | null;
}
