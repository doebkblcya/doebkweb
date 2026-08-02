import type { UIStrings } from "../types/i18n";

export const ui: UIStrings = {
  site: {
    title: "doebkblcya",
    description:
      "Personal site — developer portfolio, tech docs, photo gallery & record shelf",
  },

  nav: {
    home: "Home",
    about: "About",
    docs: "Docs",
    music: "Music",
    photos: "Photos",
    github: "GitHub",
    menu: "Menu",
  },

  home: {
    quote: "Code is meant to be read by humans, and only incidentally for machines to execute.",
    welcome: "Hi, I'm doebkblcya",
    welcomeSub: "Full-Stack Engineer · Technical Writer",
  },

  about: {
    title: "About",
  },

  docs: {
    title: "Docs",
    emptyList: "No documents yet",
    published: "Published",
    updated: "Updated",
    toc: "Table of Contents",
    sortNewest: "Newest",
    sortOldest: "Oldest",
    searchPlaceholder: "Search docs…",
    searchLoading: "Searching…",
    searchNoResults: "No matching documents",
    searchEmptyHint: "Try different keywords",
    searchResultCount: (n: number) => `Found ${n} document${n !== 1 ? "s" : ""}`,
    searchKeyboard: "↑↓ Navigate  ↵ Open  Esc Close",
  },

  music: {
    title: "Music",
    emptyList: "No music yet",
    sortAlbum: "Album",
    sortArtist: "Artist",
    searchPlaceholder: "Search albums or tracks…",
    noResults: "No matching albums or tracks",
  },

  photos: {
    title: "Photos",
    emptyList: "No photos yet. Stay tuned.",
    noNote: "No notes yet",
  },

  notFound: {
    title: "Page Not Found",
    description:
      "The page you are looking for doesn't exist or has been moved.",
    backHome: "Back Home",
  },

  common: {
    skipToContent: "Skip to content",
    settings: "Settings",
  },
};
