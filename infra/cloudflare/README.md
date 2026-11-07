# Cloudflare Pages for the SDF landing site

Terraform configuration for a static [Cloudflare Pages](https://developers.cloudflare.com/pages/) project. It describes the project only. It does not publish `dist/`, and nothing in this repository applies it.

Checked against the Cloudflare provider schema published with v5.28.1 (20 October 2026) and Terraform 1.17.1. The v5 names are `cloudflare_pages_project`, `cloudflare_pages_domain` (`name`, not the v4 `domain` argument), and `cloudflare_dns_record`.

## Why Pages

Cloudflare recommends [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) for new sites. This repository already specifies Pages: `npm run build`, output `dist`, Node 22, and the apex `softwaredecisionfabric.tech`. `public/_headers` is a Pages (and Netlify) static headers file. Moving the site to Workers would be a different host and a different asset configuration. This stack stays on Pages and creates no Worker, route, KV, R2, D1, or Access resource.

## What an apply would create

| Flag | Default | Resource |
| --- | --- | --- |
| (always) | on | `cloudflare_pages_project.site` |
| `enable_custom_domain` | `false` | `cloudflare_pages_domain.apex` for `domain` |
| `attach_www` | `false` | `cloudflare_pages_domain.www` for `www.<domain>` |
| `manage_dns` | `false` | Proxied `CNAME` records for those hostnames only |
| `enable_git_source` | `false` | GitHub `source` on the project |
| `enable_automatic_deployments` | `false` | Production and preview builds on push |

The default apply is the Pages project: build command `npm run build`, destination `dist`, production branch `main`, build image major version 3, and `NODE_VERSION=22` as a plain-text variable on production and preview. No custom hostname, no DNS, no Git connection, no automatic deployment.

Build image v3 is the current Pages image and defaults to Node 22. `NODE_VERSION` is the documented override (`https://developers.cloudflare.com/pages/configuration/build-image/`). v1 images are retired. The variable is not a secret. Preview receives that same pin and no other variables.

Direct Upload does not run the Pages build image. The build settings are stored on the project either way. Publishing files is a separate step below, and only for a project that was created as Direct Upload.

`lifecycle.prevent_destroy` is set on the project, the domain attachments, and the CNAMEs. Terraform only accepts a literal there, so allowing destruction takes a reviewed code change. Turning a flag off does not by itself delete the remote object: `count` going to zero plans a destroy, and `prevent_destroy` rejects that plan.

## What it will not take over

- No `cloudflare_zone`. The zone must already exist. Nameservers are not changed.
- No MX, TXT, CAA, NS, or wildcard records. The contact mailbox `design-partners@softwaredecisionfabric.tech` is untouched.
- `allow_overwrite` was removed in provider v5. If a record already exists at that hostname, create stops with a conflict. It does not replace that record. See import below. Do not import an A or AAAA into these CNAME resources.
- On Cloudflare, a proxied apex CNAME is flattened and can sit beside existing MX records. This configuration never sets `type` to `MX` or `TXT`.
- No redirect ruleset. A zone has one `http_request_dynamic_redirect` ruleset; creating `cloudflare_ruleset` would take ownership of that phase. `www` → apex is not automated. The Astro site, `public/_headers`, `public/robots.txt`, the static 404, and canonical URLs are unchanged.
- No token, account id, or zone id is committed. `terraform.tfvars.example` uses an all-zero account id as a placeholder, not as a real account.

## Ownership

Terraform owns the Pages project and, only when the flags are on, its custom domains and the CNAME records. There is no `wrangler.toml` and no `cloudflare.config.ts`. Do not add one that also sets the project name, build command, or environment. Wrangler and Terraform must not both reconcile those settings.

Uploading `dist/` is not `terraform apply`. The [Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) command, run by a person after the project exists, is:

```bash
CLOUDFLARE_ACCOUNT_ID="<account id>" npx wrangler pages deploy dist --project-name="<project name>"
```

`CLOUDFLARE_API_TOKEN` is the same environment variable, not a shell argument. Run the upload from a checkout of `main`. Pages uses the current Git branch as the deployment branch unless a branch option is set, and a non-production branch becomes a preview. Do not point Wrangler at a second project name. If Wrangler creates the project before Terraform does, import the project instead of applying a second create.

## Source mode is fixed at creation

The default, `enable_git_source = false`, creates a [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) project (`source` is null). Cloudflare's Direct Upload docs say you cannot switch that project to Git later. You create a new Git-backed project instead. The [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) docs say the opposite direction is also closed: a Git-backed project cannot be switched to Direct Upload.

Set `enable_git_source` only before the first apply, and only after the Cloudflare Workers & Pages GitHub App is installed (`https://github.com/settings/installations`, or the organization installations page). Limit the app to this repository. One GitHub account should point at one Cloudflare account. `git_owner_id` and `git_repo_id` stay null unless that installation has given you the numeric ids. Do not invent them. Terraform does not install the app.

Provider v5.28.1's `cloudflare_pages_project.source` attribute has no `RequiresReplace` plan modifier (`internal/services/pages_project/schema.go` at tag v5.28.1). A later edit of `source` would plan as an in-place update, which does not match the API limitation and could be applied by mistake. This configuration stores the mode in `terraform_data.pages_source_mode` and sets `replace_triggered_by` on the Pages project, so a mode change is tied to replacement of the project. `prevent_destroy` is set so Terraform rejects a plan that would destroy it. `name` and `account_id` already have `RequiresReplace` in that schema, so renaming the project is the same kind of destroy. That plan was not executed in this repository.

That safeguard is local to this configuration. It does not call Cloudflare, and it does not make the remote project immutable. Removing `replace_triggered_by` would bring back the misleading in-place plan.

`terraform test` does not demonstrate the rejection. A mock apply of `cloudflare_pages_project` on Terraform 1.17.1 fails before a second plan can run: provider 5.28.1 computed sensitive attributes (`deployment_configs`, `canonical_deployment`, `latest_deployment`) are regenerated between plan and apply (`Provider produced inconsistent final plan`). The tests therefore only check a fresh plan: Direct Upload leaves `source` null, and Git mode sends `source.type = "github"`. They do not prove `prevent_destroy` fires, and they do not prove the API rejects a switch. A live plan against an existing project was not run.

To use the other mode, create a new Pages project with a new name in its own state. The old name stays on the old project, and `prevent_destroy` blocks deleting or replacing it. Move the hostname only as its own reviewed change: a hostname is attached to one Pages project, and `prevent_destroy` on `cloudflare_pages_domain` blocks Terraform from detaching it until that lifecycle flag is changed on purpose. Point the CNAME at the new project's `pages_subdomain` only after the hostname is attached there. Leave MX and TXT alone.

When Git is selected at create, `production_deployments_enabled` and `deployments_enabled` are still false, `preview_deployment_setting` is `none`, and `pr_comments_enabled` is false, until `enable_automatic_deployments` is also set. Provider 5.28.1 warns that `deployments_enabled` is deprecated. It stays, set to false, because that is the schema text for disabling both production and preview builds. `terraform test` prints that warning when a Git create is planned. It is not an error. `enable_automatic_deployments` is rejected unless Git was selected. This repository does not turn that flag on, and CI does not deploy.

Preview deployments, when someone later enables them, are `*.pages.dev` URLs. Custom domains are separate `cloudflare_pages_domain` resources and are not set to a `pages.dev` name. Preview environment variables stay the public `NODE_VERSION` pin. There is no `secret_text` variable. The Astro `site` in `astro.config.mjs` stays `https://softwaredecisionfabric.tech`, so a preview document still canonicalizes to production. That is existing site behavior; this stack does not add the production hostname to a preview.

## Custom domain and DNS

`cloudflare_pages_domain` does not create DNS. The provider documents that separately (its page still says `cloudflare_record`; the v5 resource is `cloudflare_dns_record`). The dashboard flow can add a CNAME for a zone already on the account. This configuration will not, unless `manage_dns` is true.

`domain` is the hostname Pages should serve. It is usually the zone apex (`softwaredecisionfabric.tech`). It may instead be a subdomain of a zone you already have (`docs.example.com` in the zone `example.com`). `attach_www` adds `www.` in front of that hostname. Both names must sit in the zone: equal to the zone name, or a subdomain of it. A zone that is only `www.example.com` does not cover `example.com`. `pages.dev` and every hostname under it are rejected, in any case. `pages.dev.example.com` is a normal hostname and is not rejected by that rule. Labels must be lowercase punycode.

An apex custom domain has to be a zone on the same Cloudflare account as the Pages project. This stack does not create that zone or change nameservers. When `manage_dns` is true, a `data.cloudflare_zone` read checks the zone id before any record is planned. The zone's name must contain the hostnames, and `account.id` must equal `account_id`. A zone id from another zone fails that precondition during plan instead of failing when the record is created. A missing zone fails when the data source is read, which is also during plan. Tests mock that read. They do not call the zone API. A default plan does not include the data source, so it does not need Zone Read.

When `manage_dns` is true the record is:

| Name | Type | Content | Proxy | TTL |
| --- | --- | --- | --- | --- |
| `domain`, as a full hostname | `CNAME` | the project's `pages_subdomain` output | proxied | `1` (automatic) |

`www.<domain>` is added only with `attach_www`. Provider v5 compares `name` to the API's FQDN, so `@` is not used. TTL `1` is required for proxied records. The CNAME depends on the Pages domain attachment. Pages returns HTTP 522 if DNS points at `*.pages.dev` before the hostname is attached to the project. The test assertion that content equals `cloudflare_pages_project.site.subdomain` checks that wiring. The subdomain value in tests is a stub.

Certificate status moves through `initializing`, `pending`, and `active`. CAA records are not managed. If issuance stays pending, the custom-domain docs say the existing CAA set must allow `letsencrypt.org`, `pki.goog`, and `ssl.com`. Changing CAA is a separate review. Do not delete unrelated CAA, MX, or TXT records.

`www` → apex is still a product requirement in the site README and is intentionally not in this stack. Add it only after reading the current dynamic-redirect ruleset, or import that ruleset in a later change. Do not create a new ruleset over an existing one.

## Token

Create an account API token. The provider reads `CLOUDFLARE_API_TOKEN`. Do not put the token in tfvars, CLI arguments, or this repository.

Dashboard permission names are from the [permissions list](https://developers.cloudflare.com/fundamentals/api/reference/permissions/). The provider's accepted names are on each resource page.

| When | Dashboard permission | Scope | Provider name |
| --- | --- | --- | --- |
| Always | Account → Cloudflare Pages → Edit | This account only | `Pages Write` (the resource also lists `Pages Read`) |
| `manage_dns = true` only | Zone → Zone → Read | This zone only | `Zone Read` |
| `manage_dns = true` only | Zone → DNS → Read and DNS → Edit | This zone only | `DNS Read` and `DNS Write` |

`data.cloudflare_zone` in provider 5.28.1 lists many accepted permissions because the zone GET endpoint allows them. This stack asks only for Zone Read on that zone. Do not grant the rest of that list.

The direct-upload docs use the same Pages Edit permission for `wrangler pages deploy`. Do not add Zone Settings, Email Routing, Firewall, or access to every zone. Do not use the Global API Key (`CLOUDFLARE_API_KEY` / `CLOUDFLARE_EMAIL`).

## Remote state

Do not apply with local state. The committed backend is an empty S3 block:

```hcl
backend "s3" {}
```

Bucket, key, region, and lock settings are not in git.

1. Outside this state, create a private S3 bucket. Enable versioning and default encryption. Block public access.
2. Grant the operator `s3:ListBucket` on the bucket, `s3:GetObject` and `s3:PutObject` on the state key, and `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on the `<key>.tflock` object. That is the [S3 backend lock](https://developer.hashicorp.com/terraform/language/backend/s3) permission set for `use_lockfile`.
3. Copy `backend.hcl.example` to `backend.hcl`. Fill bucket, key, and region. Leave credentials out of the file.
4. `terraform init -backend-config=backend.hcl`

`use_lockfile = true` is the S3-native lock (generally available in Terraform 1.11 and later; this repo was checked with 1.17.1). A second apply fails while the `.tflock` object exists, instead of overwriting the state. DynamoDB locking is not used. HCP Terraform is the other locked backend, via `TF_TOKEN_app_terraform_io` and a `cloud` block this repository does not commit. This configuration does not use Cloudflare R2 for state: the lock depends on S3 conditional writes, and that was not verified for R2.

`terraform init -backend=false` is for format, validate, and `terraform test` only. It is not an apply.

## Plan, review, apply

```bash
cd infra/cloudflare
cp terraform.tfvars.example terraform.tfvars   # then replace account_id
export CLOUDFLARE_API_TOKEN="..."              # shell only; never commit it
terraform init -backend-config=backend.hcl
terraform plan -out=sdf.tfplan
```

Review the plan before apply:

- The only create, on a fresh account, is `cloudflare_pages_project.site`, unless you opted in.
- No zone, MX, TXT, CAA, ruleset, Worker, or secret environment variable.
- Opt-in DNS is `CNAME` only, names are the apex and optionally `www`, content ends in `.pages.dev`.
- Git `source` is absent unless this state was created with `enable_git_source`. A plan that replaces `cloudflare_pages_project.site` because the mode changed must not be applied. `prevent_destroy` is what rejects it.
- If Git source is present on a create, `preview_deployment_setting` is `none` and both deployment booleans are false, unless `enable_automatic_deployments` was set before that create.
- A second plan that only rewrites `deployment_configs` fields this configuration does not set is the known provider drift (the API fills defaults). Stop. Do not apply that diff, and do not add `ignore_changes` until the Node pin is still visible in review. `ignore_changes` on the whole block would hide a real `NODE_VERSION` edit.

`terraform apply sdf.tfplan` is a human step. This repository's GitHub Actions workflow does not run it. Apply is not transactional across resources. A failure after the project is created leaves the project in state and leaves DNS as it was. Run plan again and continue. A Pages domain can stay `pending` until DNS points at it; that is not a reason to edit mail records.

DNS and certificate changes propagate on their own schedule. Previous resolver TTLs can outlive Cloudflare's automatic TTL. Treat an address-record change as a cutover. Review the live record first. Import it only when it is already the CNAME described below.

## Rollback

A bad upload is a Pages deployment rollback, not a Terraform destroy. In the project, open **Deployments**, then **All deployments**, then the action menu on a successful production deployment, then **Rollback to this deployment**. Preview deployments are not rollback targets. Rollback does not change Terraform state.

A bad infrastructure change is a reverted commit and a new plan. `prevent_destroy` blocks `terraform destroy` and blocks a `count` change that would destroy an instance. To delete a remote object on purpose: change `prevent_destroy` to `false` in a reviewed commit, plan, and only then destroy. Destroying the project deletes its deployments. Destroying a CNAME deletes that record only. Cloudflare's domain docs remove the CNAME before the custom domain attachment.

If state is wrong, restore the previous object version from the bucket. Do not hand-edit the state.

## Stop managing an object without deleting it

`prevent_destroy` stays on every production resource that is still declared. Setting `manage_dns` or `enable_custom_domain` back to false changes `count` to 0. That removes the instance from the configuration, and Terraform plans to destroy `cloudflare_dns_record.apex[0]` (or the domain instance). `prevent_destroy` rejects that plan. The remote object stays. That is the protection. It is not how you forget the object.

To hand the object back to the dashboard without deleting it:

1. `terraform state pull` to a file that is not committed. Confirm the state bucket still has versioning.
2. In one reviewed change, leave the instance out of the configuration (`count` 0, or the resource block removed) and add a [`removed` block](https://developer.hashicorp.com/terraform/language/block/removed) for that address:

```hcl
removed {
  from = cloudflare_dns_record.apex[0]

  lifecycle {
    destroy = false
  }
}
```

3. Plan. It must say the address will leave state, and it must not say the record will be destroyed. If the resource instance is still declared at that address, Terraform will not accept the `removed` block. If the plan shows a destroy, stop. Do not set `prevent_destroy` to false for this path. That flag is what allows a real delete.
4. Apply only that plan. Delete the `removed` block in a follow-up once the address is gone from state. A `removed` block is for that apply, not a permanent setting.

`terraform state rm` also forgets an address without deleting the remote object. Prefer the `removed` block so the action is in the reviewed plan. Take the same state backup first. The same shape works for `cloudflare_pages_domain.apex[0]`, `cloudflare_dns_record.www[0]`, and `cloudflare_pages_project.site` (no `[0]`). Forgetting the project does not delete it, and it does not change its Direct Upload or Git mode.

## Import

Import adopts an object that already exists. A create against it conflicts; it does not adopt it. Match `enable_git_source` to the project's real mode before importing it. A mismatch plans a replacement, and `prevent_destroy` rejects that plan.

```bash
terraform import cloudflare_pages_project.site '<account_id>/<project_name>'
terraform import 'cloudflare_pages_domain.apex[0]' '<account_id>/<project_name>/<domain>'
```

The provider cannot import a Pages project that still has secret environment variables. This configuration has no secrets to put back.

DNS import is narrower. Provider v5.28.1 marks `cloudflare_dns_record.type` and `zone_id` with `RequiresReplace` (`internal/services/dns_record/schema.go` at tag v5.28.1). `name` does not have that modifier.

Import only a record that is already a `CNAME` at the exact hostname this resource manages (`domain`, or `www.<domain>`), in this zone:

```bash
terraform import 'cloudflare_dns_record.apex[0]' '<zone_id>/<cname_record_id>'
```

Use the same shape for `www[0]` only when that `www` CNAME already exists. Record ids come from the DNS API or dashboard.

Do not import an apex A, AAAA, or any other type into these resources. After that import, the plan replaces the record because `type` differs. Replacement deletes the old record and creates a CNAME. `prevent_destroy` blocks the delete, so the apply cannot finish, and the A/AAAA stays. A mistaken import is undone with a state backup and `terraform state rm 'cloudflare_dns_record.apex[0]'`, which forgets the address and does not delete the remote record.

Changing an existing A or AAAA into a CNAME is a separate, manual cutover. Inventory MX, TXT, CAA, and every other record first. This configuration never includes those types, so a plan that only mentions the one CNAME is not editing them. On Cloudflare, MX can remain beside a flattened apex CNAME. Make the website address change in the dashboard, or leave `manage_dns` false. Only import after the live record is already the CNAME you intend Terraform to own.

Then plan. A content update on that CNAME, aimed at `pages_subdomain`, is an in-place change and is the cutover. A replace, a name change, or any other record in the plan means stop.

## Validate without credentials

```bash
cd infra/cloudflare
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate
terraform test
```

`terraform test` plans against a mocked provider. It does not call Cloudflare, and it does not apply this resource. `.github/workflows/terraform.yml` runs the same commands. It does not reference GitHub secrets and does not set a Cloudflare token. It does not prove a token is absent on the runner. Do not add an apply job or a `secrets` reference there.
