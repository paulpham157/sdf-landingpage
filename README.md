# Software Decision Fabric

Marketing site for [softwaredecisionfabric.tech](https://softwaredecisionfabric.tech/).

SDF is the independent referee for coding agents. This site follows the draft v0 landing, pricing, and one-pager: vendor-neutral verification, evidence a team can re-run, and Cost per Accepted Outcome. It is written for the design-partner program. SDF runs live only on a toy fixture, so the pages do not show customer logos, testimonials, case studies, result metrics, or SDF dollar prices.

## Đưa site lên Pages

Một lần, trong terminal của bạn. Node.js 22. Không cần AWS, R2, hay Terraform. Đừng chạy lệnh tạo project từ một agent.

```bash
npm ci
npm exec wrangler -- login
npm exec wrangler -- pages project create sdf-landing --production-branch main
```

`npm ci` cài Wrangler 4.158.0 đã ghim trong `package-lock.json`. `wrangler login` mở trình duyệt và giữ phiên trên máy, ngoài git. Không commit token. Login chỉ thấy một account thì Wrangler dùng account đó. Thấy nhiều account thì đặt `CLOUDFLARE_ACCOUNT_ID` trong shell: id 32 ký tự hex trên dashboard, không phải token. Dùng token thay login thì thêm `CLOUDFLARE_API_TOKEN`, quyền Account → Cloudflare Pages → Edit. Hai biến chỉ ở môi trường.

Lệnh `pages project create` ở terminal thường tạo project Pages Direct Upload và đặt production branch `main`. Wrangler 4.158.0, khi nhận ra phiên agent và project Pages chưa có, có thể tạo Worker thay vì Pages. Repo này không chạy lệnh create. Dashboard cũng tạo được project Direct Upload: Workers & Pages → Create application → Get started → Drag and drop your files, tên `sdf-landing`. Dashboard không có chỗ chọn production branch cho Direct Upload.

Mỗi lần sau, khi `sdf-landing` đã có trong account:

```bash
npm run deploy
```

Lệnh gọi `pages project list --json`. Không thấy project thì dừng, không build và không upload. Thấy project thì build, chạy `check:copy` và `check:jsonld`, rồi `pages deploy` vào đúng project đó. Check lỗi thì không upload. Nhánh git `main` sạch là production. Nhánh khác là preview; lệnh không đổi nhánh thành `main`. `main` còn thay đổi chưa commit thì dừng trước upload. Wrangler in URL `pages.dev`. Lệnh không gắn `softwaredecisionfabric.tech`.

One-time, in your own terminal: `npm ci`, `npm exec wrangler -- login`, then `npm exec wrangler -- pages project create sdf-landing --production-branch main`. That create command stays on Pages in a normal terminal. In an agent session, Wrangler 4.158.0 can create a Worker instead when the Pages project is missing. `npm run deploy` never runs it. Deploy lists Pages projects and uploads only when `sdf-landing` already exists. A clean `main` checkout is production; any other branch is a preview. The first URL is the project's `pages.dev` host.

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

## Headers, then an optional custom domain

The site is static HTML, CSS, and a small amount of page-specific JavaScript (the print button and the mailto form). `npm run deploy` only uploads files. The first hostname is the project's `pages.dev` URL. Attaching `softwaredecisionfabric.tech` is later, and this command does not do it.

Terraform in [`infra/cloudflare`](infra/cloudflare/README.md) is optional. Publishing does not need it, and does not need AWS or R2. GitHub Actions validates that Terraform and does not apply it, create the project, or change DNS. It also does not run `npm run deploy`. The default Terraform project is Direct Upload. Cloudflare does not let a Direct Upload project become a Git project, or the reverse. After a matching baseline is in state, flipping the mode plans a replacement that `prevent_destroy` rejects. An import is not locked until that baseline exists: the first plan must not change `source`. The other mode is a new Pages project name and a reviewed domain move. Custom domains and DNS stay off until someone opts in. There is no Wrangler config file, so the upload does not reconcile those settings.

Build command: `npm run build`. Output directory: `dist`. Node version: 22. The apex to attach, when that opt-in is reviewed, is `softwaredecisionfabric.tech`. Redirecting `www.softwaredecisionfabric.tech` to the apex is still required and is not created by the Terraform, because a zone redirect ruleset would take over existing redirect rules. The contact address is `email` in `src/data/site.ts`. Change that constant if the mailbox changes. No analytics script is included.

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

GitHub Actions (`.github/workflows/build.yml`) runs `npm ci`, the deploy-script tests, `npm run build`, `npm run check:copy`, and `npm run check:jsonld` on pushes and pull requests. `.github/workflows/terraform.yml` checks the Pages Terraform formatting, schema, and plan invariants. Neither workflow has Cloudflare credentials, and neither deploys.
