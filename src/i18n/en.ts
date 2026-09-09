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
    title: "Music",
    description: "Record shelf — vinyl-style music player and album collection",
    emptyList: "No music yet",
    sortAlbum: "Album",
    sortArtist: "Artist",
    searchPlaceholder: "Search albums or tracks…",
    noResults: "No matching albums or tracks",
  },

  photos: {
    title: "Photos",
    description: "Photo gallery — photo wall and shooting notes",
    emptyList: "No photos yet. Stay tuned.",
    noNote: "No notes yet",
    viewTimeline: "Timeline",
    viewWall: "Wall",
    searchPlaceholder: "Search photo notes…",
    noResults: "No results",
    loadError: "Failed to load image",
    viewLabel: "Photo view",
    close: "Close photo",
    previous: "Previous photo",
    next: "Next photo",
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

  player: {
    musicPlayer: "Music player",
    idle: "Nothing playing",
    previous: "Previous track",
    play: "Play",
    pause: "Pause",
    next: "Next track",
    playlist: "Track list",
    notes: "Notes",
    volume: "Mute or restore volume",
    volumeSlider: "Volume",
    shelf: "Record shelf",
  },

  common: {
    skipToContent: "Skip to content",
    settings: "Settings",
  },
};
