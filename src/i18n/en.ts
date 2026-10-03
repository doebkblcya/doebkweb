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
    music: "Records",
    photos: "Photos",
    github: "GitHub",
    menu: "Menu",
  },

  home: {
    quote: "Code is meant to be read by humans, and only incidentally for machines to execute.",
    welcome: "Hi, I'm doebkblcya",
  },

  about: {
    title: "About",
    description: "About doebkblcya — profile and tech notes",
  },

  docs: {
    title: "Docs",
    description: "Technical knowledge base — deployments, toolchains, and dev practices",
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
    title: "Records",
    description: "Record shelf — album collection and personal reviews",
    emptyList: "No albums yet. Stay tuned.",
    sortAlbum: "Album",
    sortArtist: "Artist",
    searchPlaceholder: "Search albums, artists or reviews…",
    noResults: "No matching albums",
    review: "Review",
    released: "Released",
    genres: "Genres",
    label: "Label",
    play: "Play",
    details: "View album and review",
    viewSelection: "Selections",
    viewShelf: "Record shelf",
    viewLabel: "Record view",
    sortLabel: "Sort by",
    emptySelection: "No album reviews yet.",
  },

  photos: {
    title: "Photos",
    description: "Photo exhibition and wall",
    emptyList: "No photos yet. Stay tuned.",
    viewExhibition: "Exhibition",
    viewWall: "Wall",
    searchPlaceholder: "Search notes…",
    noResults: "No results",
    loadError: "Failed to load image",
    viewLabel: "Photo view",
    sortName: "Filename",
    sortTime: "Capture time",
    sortLabel: "Sort by",
    noTime: "No capture time",
    focalLength: "Focal length",
    aperture: "Aperture",
    shutter: "Shutter",
    iso: "ISO",
  },

  notFound: {
    title: "Page Not Found",
    description:
      "The page you are looking for doesn't exist or has been moved.",
    backHome: "Back Home",
  },

  theme: {
    appearance: "Appearance",
    light: "Light",
    dark: "Dark",
    auto: "Auto",
  },

  common: {
    skipToContent: "Skip to content",
    settings: "Settings",
    language: "Language",
  },
};
