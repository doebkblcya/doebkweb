/**
 * Shared `getStaticPaths` for [lang] pages.
 *
 * Generates one path per supported locale so Astro can pre-render
 * every page in both zh and en at build time.
 */

export function getStaticPaths() {
  return [
    { params: { lang: "zh" } },
    { params: { lang: "en" } },
  ];
}
