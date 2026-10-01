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
  /** 移动端汉堡按钮的 aria-label */
  menu: string;
}

export interface HomeStrings {
  quote: string;
  welcome: string;
}

export interface AboutStrings {
  title: string;
  description: string;
}

export interface DocStrings {
  title: string;
  description: string;
  emptyList: string;
  published: string;
  updated: string;
  toc: string;
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
  description: string;
  emptyList: string;
  sortAlbum: string;
  sortArtist: string;
  searchPlaceholder: string;
  noResults: string;
  review: string;
  released: string;
  genres: string;
  label: string;
  play: string;
  details: string;
  viewSelection: string;
  viewShelf: string;
  viewLabel: string;
  sortLabel: string;
  emptySelection: string;
}

export interface PhotosStrings {
  title: string;
  description: string;
  emptyList: string;
  noNote: string;
  viewTimeline: string;
  viewWall: string;
  searchPlaceholder: string;
  noResults: string;
  loadError: string;
  viewLabel: string;
  previous: string;
  next: string;
}

export interface NotFoundStrings {
  title: string;
  description: string;
  backHome: string;
}


export interface ThemeStrings {
  /** 设置面板「外观」分段控件 section 标签 */
  appearance: string;
  light: string;
  dark: string;
  auto: string;
}

export interface CommonStrings {
  skipToContent: string;
  settings: string;
  language: string;
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
  theme: ThemeStrings;
  common: CommonStrings;
}
