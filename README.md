# doebkweb

Personal static tech site — developer portfolio & technical knowledge base.

Built with [Astro](https://astro.build), designed with Apple Design principles.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev        # Start dev server
pnpm build      # Production build → dist/
pnpm preview    # Preview production build
pnpm deploy     # Build (for verification before git push)
```

Deployment: push to `main` → [Cloudflare Pages](https://pages.cloudflare.com) auto-deploys.

## Tech Stack

- **Framework**: Astro (static output)
- **Animations**: Motion (spring-based, Apple Design)
- **Search**: Pagefind (to be integrated)
- **Hosting**: Cloudflare Pages + R2 (media assets)
- **CDN**: cdn.doebkblcya.com
