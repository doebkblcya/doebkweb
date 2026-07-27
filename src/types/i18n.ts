/**
 * TypeScript type for all UI strings.
 *
 * Every key in `zh.ts` that needs translation must exist in `en.ts` with the
 * exact same structure — the type system enforces this.
 */

export interface SiteMeta {
  title: string;
  description: string;
}

export interface NavStrings {
  home: string;
  about: string;
  docs: string;
  music: string;
  photos: string;
  github: string;
}

export interface HomeStrings {
  quote: string;
  welcome: string;
  welcomeSub: string;
}

export interface AboutStrings {
  title: string;
  resumeDesc: string;
  downloadResume: string;
}

export interface DocStrings {
  title: string;
  emptyList: string;
  published: string;
  updated: string;
  readingTime: string;
  sortNewest: string;
  sortOldest: string;
  searchPlaceholder: string;
  searchLoading: string;
  searchNoResults: string;
  searchEmptyHint: string;
  searchResultCount: (n: number) => string;
  searchKeyboard: string;
}

export interface MusicStrings {
  title: string;
  emptyList: string;
  sortAlbum: string;
  sortArtist: string;
  searchPlaceholder: string;
  noResults: string;
}

export interface PhotosStrings {
  title: string;
  emptyList: string;
  noNote: string;
}

export interface NotFoundStrings {
  title: string;
  description: string;
  backHome: string;
}


export interface CommonStrings {
  skipToContent: string;
  settings: string;
}

export interface UIStrings {
  site: SiteMeta;
  nav: NavStrings;
  home: HomeStrings;
  about: AboutStrings;
  docs: DocStrings;
  music: MusicStrings;
  photos: PhotosStrings;
  notFound: NotFoundStrings;
  common: CommonStrings;
}
