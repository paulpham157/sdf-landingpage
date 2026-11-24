# Software Decision Fabric

Marketing site for [softwaredecisionfabric.tech](https://softwaredecisionfabric.tech/).

Software Decision Fabric is a local OpenTelemetry collector and decision ledger for coding agents. v0.1.0 is public (Apache 2.0) and runs on the user's machine. This site also describes a planned hosted referee. That loop is shown only as a labeled mock where the mock appears, so the pages do not show customer logos, testimonials, case studies, result metrics, or SDF dollar prices. Declare, Verify, and Record are partly shipped. Route is planned.

Copy lives in [`src/data/site.ts`](src/data/site.ts). The product repository is [github.com/paulpham157/sdf](https://github.com/paulpham157/sdf).

## Run locally

Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

`npm run build` writes the static site to `dist/`. `npm run check:copy` and `npm run check:jsonld` check that output. `npm run preview` serves `dist/` on the same port.

## Deploy

Create the Pages project once, in your own terminal:

```bash
npm ci
npm exec wrangler -- login
npm exec wrangler -- pages project create sdf-landing --production-branch main
```

Do not run `pages project create` from an agent session. Wrangler 4.158.0 can create a Worker instead of a Pages project when `sdf-landing` is missing. `npm run deploy` only uploads when that project already exists. A clean `main` checkout is production; any other branch is a preview. The command prints the project's `pages.dev` URL. It does not attach the custom domain. `npm run deploy` does not read Terraform state and does not use an R2 bucket. `npm run deploy` không đọc Terraform và không dùng bucket R2.

Copy [`.env.example`](.env.example) to `.env` at the repo root for a local shell. `npm run deploy` and `npm run attach-domain` load that file when it exists. A value already set in the shell wins. `.env` is not committed. When `.env` is absent, both commands keep the variables already in the process environment. The GitHub Actions deploy does not create a `.env` file.

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) installs with `npm ci`, builds, runs `npm run check:copy` and `npm run check:jsonld`, then runs `npm run deploy`. That command builds and checks again and uploads `dist/` to the existing Pages project `sdf-landing`. A push to `main` is production and is recorded on the GitHub `production` environment (`https://sdf-landing.pages.dev`). A push to any other branch is a preview (the Pages branch alias) on the `preview` environment. `workflow_dispatch` deploys the branch you select. Pull requests do not deploy. The workflow does not run Terraform and does not use an R2 bucket.

The workflow needs two repository secrets, added under Settings → Secrets and variables → Actions. `CLOUDFLARE_API_TOKEN` is an account API token with Cloudflare Pages: Edit. `CLOUDFLARE_ACCOUNT_ID` is the account id. They are passed only to the secret check and to `npm run deploy`. If either secret is missing on `main`, the check names it, says where to add it, and fails the production job. On any other branch it emits a notice and skips the preview. Secret values are not printed.

Push lên `main` là bản production. Push lên nhánh khác là bản xem trước (alias của nhánh). `workflow_dispatch` chạy nhánh được chọn. Workflow cần `CLOUDFLARE_API_TOKEN` (quyền Cloudflare Pages: Edit) và `CLOUDFLARE_ACCOUNT_ID`. Thiếu secret trên `main` thì job lỗi; trên nhánh khác thì ghi notice và bỏ qua. Không cần file `.env`. Không chạy Terraform và không dùng bucket R2.

## Attach the custom domain

`npm run attach-domain` is separate from deploy. The Pages project `sdf-landing` must already exist, and it must already be in Terraform state. A project created with Wrangler is imported first, then a plan that only adds the source-mode sentinel is applied. The first command prints the plan. The second applies only when that plan creates custom domains and nothing else.

```bash
npm run attach-domain
npm run attach-domain -- --yes
```

`CLOUDFLARE_API_TOKEN` (Pages Edit) and `CLOUDFLARE_ACCOUNT_ID` come from `.env` or the shell. `terraform.tfvars` is optional once the account id is in `.env`. The R2 keys (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), the S3 endpoint (`AWS_ENDPOINT_URL_S3`), and the bucket name (`R2_STATE_BUCKET`) also go in `.env`. `backend.hcl` is optional. On init, the script builds the backend config from those three values. For that run it sets `enable_custom_domain` and `attach_www`, and keeps `manage_dns=false`. It does not create a CNAME, touch MX/TXT/CAA, or redirect `www` to the apex. A plan that changes DNS, destroys, replaces, or updates the project stops without applying. GitHub Actions does not run this command.

Project settings, DNS, and the optional custom domain are documented in [`infra/cloudflare/README.md`](infra/cloudflare/README.md). Response headers are in [`public/_headers`](public/_headers).

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/pricing` | Hosted Team and Enterprise. Amounts are not published |
| `/blog` | Posts from `src/content/blog`. Drafts are not built |
| `/one-pager` | The same brief on one sheet |
| `/sample-evidence-report` | Labeled mock Evidence Report |
| `/design-partners` | Design-partner contact. Opens an email draft |

## Content

Add a post as Markdown or MDX under [`src/content/blog/`](src/content/blog/). The filename is the URL slug. Frontmatter requires `title`, `date`, and `summary`. `draft: true` keeps the file out of the build. `sample: true` marks a specimen. Quoted social posts use [`src/components/SocialCitation.astro`](src/components/SocialCitation.astro).

The contact address is `email` in [`src/data/site.ts`](src/data/site.ts) (`design-partners@softwaredecisionfabric.tech`).

## Stack

[Astro](https://astro.build/) 7 builds static HTML. [`.github/workflows/build.yml`](.github/workflows/build.yml) installs, tests, builds, and runs the checks. [`.github/workflows/terraform.yml`](.github/workflows/terraform.yml) validates the Pages Terraform. Neither workflow deploys.
