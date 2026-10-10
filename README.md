# Janhavi Jadhav — portfolio

A one-page portfolio for a software and UI engineer who paints: a live watercolour simulation (WebGL2)
that visitors paint into, a sliding wall of engineering projects and paintings, and smooth Lenis scrolling.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static export into ./out
```

## Content

All text, projects, artworks, experience and links live in `src/content/site.ts`.
Most of it is placeholder for now; each placeholder group has a flag (`placeholder`,
`WORKS_ARE_SAMPLES`, `PATH_IS_PLACEHOLDER`) that shows a small note on the site until set to `false`.

Real artwork images: put them in `public/works/` and set `image: "/works/<file>.jpg"` on each work.

## Deploy (Cloudflare Pages)

Connect this repo in Cloudflare → Workers & Pages → Create → Pages → Connect to Git, then:

- Framework preset: **None**
- Build command: `npm run build`
- Build output directory: `out`

`.node-version` pins Node 22; `public/_headers` sets caching and security headers.
