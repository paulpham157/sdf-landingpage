# Software Decision Fabric

Marketing site for [softwaredecisionfabric.tech](https://softwaredecisionfabric.tech/).

SDF is the independent referee for coding agents. This site follows the draft v0 landing, pricing, and one-pager: vendor-neutral verification, evidence a team can re-run, and Cost per Accepted Outcome. It is written for the design-partner program. SDF runs live only on a toy fixture, so the pages do not show customer logos, testimonials, case studies, result metrics, or SDF dollar prices.

## Run locally

Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Production build

```bash
npm run build
npm run check:copy
npm run preview
```

`npm run build` writes a static site to `dist/`. `npm run check:copy` fails the build output if a page drifts into invented prices, customer proof, or a missing toy-fixture disclosure. Preview serves `dist/` at [http://localhost:4321](http://localhost:4321).

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing: hero, problem, four steps, three commitments, design-partner close |
| `/pricing` | Hosted Team and Enterprise. Amounts say “Not published.” OpenHands, Factory, and Ona figures are cited coding-agent list prices, not SDF prices |
| `/blog` | Blog index. Posts come from `src/content/blog` |
| `/blog/…` | One post. Drafts are not built |
| `/one-pager` | The same brief on one sheet. Use **Print or save as PDF** |
| `/sample-evidence-report` | A stylized mock Evidence Report. Labeled sample. Not a customer report |
| `/design-partners` | Design-partner contact. No backend |

## Publish a blog post

Add a Markdown or MDX file under [`src/content/blog/`](src/content/blog/). The filename becomes the URL: `src/content/blog/my-note.md` is published at `/blog/my-note`. Restart `npm run dev` if the new file does not show up.

Frontmatter:

```yaml
---
title: What the record is for
date: 2026-11-06
summary: One or two sentences. This is also the page description.
hero: ./my-note.svg          # optional, a file next to the post
heroAlt: Short description of the image
tags:
  - verification
sample: false                # true only for specimens, which show a Sample banner
draft: false                 # true keeps the file out of the index, the route, and the sitemap
---
```

`title`, `date`, and `summary` are required. `tags` can be omitted. Write the body in Markdown under the frontmatter. Link to other pages with root paths such as `/design-partners`.

Do not add customer logos, testimonials, case-study metrics, or SDF dollar prices. The product still runs live only on a toy fixture. If a post is a specimen rather than a piece you are actually publishing, set `sample: true`.

### Cite a social post

Use MDX (`.mdx`) when the post needs a citation. Import the card and pass the platform, the author, the date, and the permalink. The quoted text is the body of the component. The card does not call oEmbed or any other API. The quote, the name, and the link are always in the page.

```mdx
import SocialCitation from "../../components/SocialCitation.astro";

<SocialCitation
  platform="x"
  author="Ada Lovelace"
  handle="ada"
  date="2026-10-02"
  url="https://x.com/ada/status/1"
>
  The quoted text, in their words.
</SocialCitation>
```

`platform` is `x` (or `twitter`), `linkedin`, or `generic`.

- `x` / `twitter` must link to `x.com` or `twitter.com`.
- `linkedin` must link to `linkedin.com`.
- `generic` is the fallback for any other network or page. The card labels it with the site host and still links to the original URL.

`handle` is optional. `sample={true}` marks a specimen quotation that is not a live post. A missing permalink, a non-http URL, or an X/LinkedIn link on the wrong host fails the build instead of rendering an unattributed quote.

The same component can be imported into any `.astro` page. Two specimen posts ship with the repo: a plain Markdown note, and an MDX note that cites X, LinkedIn, and a generic URL. `draft-not-published.md` is `draft: true` and must not appear on the site.

## Contact

`design-partners@softwaredecisionfabric.tech` is the contact mailbox. It is defined once as `email` in [`src/data/site.ts`](src/data/site.ts). The form does not post to a server. It opens an email draft, and Copy address copies that same address.

## Deploy to softwaredecisionfabric.tech

The site is static HTML, CSS, and a small amount of page-specific JavaScript (the print button and the mailto form). Cloudflare Pages or Netlify can host it in front of the existing domain.

1. Connect this GitHub repository to the host.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Node version: 22
5. Add the custom domain `softwaredecisionfabric.tech`.
6. Redirect `www.softwaredecisionfabric.tech` to the apex.
7. Point DNS at the host: the host’s apex record (ALIAS, ANAME, or the addresses they publish) and a CNAME for `www` if you keep it.
8. The contact address is `email` in `src/data/site.ts`. Change that constant if the mailbox changes.
9. No analytics script is included.

`public/_headers` is copied into `dist/` and sets response headers on Cloudflare Pages and Netlify (`nosniff`, referrer policy, frame denial, a Content-Security-Policy, and an asset cache for `/_astro/*`).

The CSP is `default-src 'self'` with scripts, styles, images, and fonts limited to this origin. `form-action` allows this origin and `mailto:`. There is no `'unsafe-inline'` or `'unsafe-eval'`: Astro is configured not to inline stylesheets or script chunks. JSON-LD is a `application/ld+json` block, which browsers do not execute as script. `/llms.txt` and `/llms-full.txt` restate the public facts for answer engines. Draft posts are not built. `robots.txt` disallows `/404` and treats every crawler the same.

`public/robots.txt` allows crawling and points at the generated sitemap, `https://softwaredecisionfabric.tech/sitemap-index.xml`. Each page sets a title, description, canonical URL, and Open Graph / Twitter card tags. The default social image is `public/og.png`.

## What the copy will not claim

- SDF prices. Both tiers say the amount is not published. The shape (workspace fee, verified Attempts, Enterprise platform fee) is described without numbers.
- Market anchors. OpenHands, Factory, and Ona appear only on the pricing page, with links to the public pages the figures come from. They are coding-agent list prices, not SDF prices and not verification or evaluation prices. The hosted tier stays Hosted Team.
- The wedge metric. Public copy uses Cost per Accepted Outcome. It does not also say “cost per acceptable outcome,” “cost per accepted task,” or “cost of each accepted outcome.”
- Customers. There are no logos, testimonials, case studies, or performance metrics. The Evidence Report is a labeled mock (`SAMPLE-TOY-001` on workspace `toy-fixture`). Blog posts marked Sample are specimens, including the social quotations, which are not live posts.
- Social citations. A quoted post always shows the author and a permalink. It is not treated as a customer result.
- A company address, team photos, or a legal entity name. None of those were invented.
- A working form API. The contact path opens an email draft to the address in `src/data/site.ts`. It does not post to a server.

## Stack

[Astro](https://astro.build/) 7 renders the pages to static files. Type is set in `src/data/site.ts` and the components. Fraunces, Source Sans 3, and IBM Plex Mono are self-hosted through Fontsource (SIL Open Font License; see `licenses/`). There is no UI kit and no tracking.

GitHub Actions (`.github/workflows/build.yml`) runs `npm ci`, `npm run build`, and `npm run check:copy` on pushes and pull requests.
