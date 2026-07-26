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
  archive: string;
  emptyList: string;
  emptyCategory: string;
  emptyArchive: string;
  allCategories: string;
  viewArchive: string;
  backToDocs: string;
  category: string;
  published: string;
  updated: string;
  readingTime: string;
}

export interface MusicStrings {
  title: string;
  description: string;
  emptyList: string;
  tracks: string;
  lyrics: string;
  noLyrics: string;
}

export interface PhotosStrings {
  title: string;
  description: string;
  emptyList: string;
  loadMore: string;
}

export interface NotFoundStrings {
  title: string;
  description: string;
  backHome: string;
}

export interface ProfileStrings {
  name: string;
  bio: string;
  location: string;
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
  profile: ProfileStrings;
  notFound: NotFoundStrings;
  common: CommonStrings;
}
