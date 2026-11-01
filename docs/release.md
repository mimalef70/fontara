# Release Guide

This guide is a practical checklist for preparing FontARA release packages.

## Before Release

1. Confirm the intended version in `package.json` and `src/manifest.json`.
2. Review user-facing strings in `src/i18n/messages.json`.
3. Update `CHANGELOG.md` with user-visible changes, migration notes, and known
   issues.
4. Update public documentation surfaces such as `README.md`, `docs/index.html`,
   and release/store copy when the release changes user-visible behavior.
5. Confirm `_locales` output is generated from the shared catalog, not edited by
   hand.
6. Review site config migrations, default popup pins, and site rule versions.
7. Check whether the Google Fonts catalog needs a refresh.
8. Run local verification.

## Verification

Fast gate:

```sh
pnpm check
```

Full release gate:

```sh
pnpm verify
```

Determinism and version gates:

```sh
pnpm check:release-version
pnpm check:reproducible-zip
pnpm audit --prod
```

The reproducibility gate rebuilds every production target plus the Firefox
source-review archive in UTC and Asia/Tehran and compares each SHA-256 digest.

Browser smoke tests:

```sh
pnpm test:browser:chrome
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:firefox
pnpm test:browser:production:chrome
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:production:firefox
```

Run these with desktop Chrome/Chromium 130 or newer and Firefox 140 ESR or newer;
`CHROME_PATH` and `FIREFOX_PATH` select a particular installed binary. Firefox
tests also require geckodriver on `PATH` or at `GECKODRIVER_PATH`; see
[browser test setup](testing.md#browser-tests). The required CI matrix covers
both minimum versions and current stable releases.
The separate nightly/manual matrix adds beta and current ESR coverage.

Firefox for Android has an installation minimum of 142. Android device
validation is outside the current matrix, so desktop results do not establish
Android compatibility.

The `test:browser:production:*` scripts rebuild packages for local convenience.
To validate an existing distributable, unpack its ZIP into the matching
`build/<browser>-mv3-prod` directory and run the smoke test directly:

```sh
node --test --test-timeout=120000 --test-name-pattern='Chrome production artifact' tests/browser/production-artifacts.test.mjs
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 node --test --test-timeout=120000 --test-name-pattern='Firefox production artifact' tests/browser/production-artifacts.test.mjs
```

## Build Packages

All release targets:

```sh
pnpm build:all
```

Individual targets:

```sh
pnpm build:chrome
pnpm build:firefox
pnpm build:edge
pnpm build:brave
pnpm build:opera
pnpm build:safari
```

Release archives are written to `build/*-prod.zip`. When Firefox is part of the
build, the Firefox source review package is also written to
`build/firefox-mv3-source-<version>.zip`.

## Firefox Review Package

```sh
pnpm package:firefox:review
```

This creates the Firefox release package and a source package for review.

`pnpm build:firefox` and `pnpm build:all` create the same Firefox source review
package automatically.

## Extension Lint

```sh
pnpm lint:extension
```

This runs `web-ext lint` against `build/firefox-mv3-prod`.

Known warning category:

- Bundled UI code may produce `UNSAFE_VAR_ASSIGNMENT` warnings for generated
  `innerHTML` assignments. Treat new warning types or real errors as release
  blockers.

## GitHub Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| CI | push, pull request, manual | Calls the shared verification workflow. |
| Verify release packages | reusable workflow call | Runs `pnpm verify`, uploads production/source ZIPs, then runs stable/minimum browser suites and production smoke tests. |
| Browser Tests | manual, nightly | Browser matrix across Chrome and Firefox channels. |
| Release | `v*` tags, manual | Verifies and publishes the exact packages to GitHub Releases, then submits Chrome to the Web Store. Manual status and rollout operations are also available. |

[verify.yml](../.github/workflows/verify.yml) is the common gate for
[ci.yml](../.github/workflows/ci.yml) and
[release.yml](../.github/workflows/release.yml). Its browser jobs cover Chrome
stable/130 and Firefox stable/140 ESR. They download the
`fontara-verified-packages` artifact and smoke-test its unpacked production ZIPs.
The publish jobs wait for verification and download that same artifact without
another build. Chrome submission checks the ZIP's own manifest and SHA-256,
uploads those exact bytes, waits for asynchronous upload processing, and
submits the version for Google's normal review. Google publishes the approved
version automatically at the configured initial percentage. A successful
`PENDING_REVIEW` result means the submission was accepted, not that it is live.

## Chrome Web Store Automation

### Configured deployment

The following setup was verified on November 1, 2026:

| Setting | Configured value |
| --- | --- |
| Google Cloud project | `fontara-releases` (`889078376271`) |
| Billing account | None linked; verified in the Cloud Console before enabling release APIs. |
| Service account | `fontara-store-release@fontara-releases.iam.gserviceaccount.com` |
| Workload Identity provider | `projects/889078376271/locations/global/workloadIdentityPools/github-releases/providers/fontara-release` |
| GitHub environment | `chrome-web-store`; only `master` and `v*` tags are allowed. |
| Chrome publisher | `8ea046d5-23eb-47ac-a4e8-45e90296140e` |
| Chrome item | `dcjdhicepiklefpimapdkbaeoocniemc` |
| Initial rollout | `10%` |

The service account has no keys and is linked to the Chrome publisher. Its
impersonation grant is `roles/iam.workloadIdentityUser`, restricted to
`attribute.repository_id/141708904` in the pool above. The provider uses the
seven mappings and restrictive condition documented below. No project-wide
editor/owner role is granted to the release service account.

[Live authentication/status verification](https://github.com/mimalef70/fontara/actions/runs/41284253370)
passed after IAM propagation, with package verification and GitHub publication
skipped. [Release package verification](https://github.com/mimalef70/fontara/actions/runs/41283909097)
passed the build and all four browser lanes, with both publication jobs skipped.
These runs did not upload, submit, or publish a release.

### One-time authentication setup

Use a Google Cloud service account with GitHub Workload Identity Federation
(OIDC). The workflow requests a short-lived access token; no JSON private key,
OAuth client secret, or refresh token is stored in GitHub or in a release ZIP.

1. In a Google Cloud project, enable the Chrome Web Store, IAM, Resource
   Manager, Service Account Credentials, and Security Token Service APIs.
   Create a service account dedicated to FontARA releases; it does not need
   project-wide editor or owner roles.
2. In the Chrome Web Store publisher account, link that service account email.
   Chrome currently allows one service account per publisher. This grants
   access to all items owned by that publisher, so use a dedicated account and
   restrict its GitHub trust carefully.
3. Create a Workload Identity Pool and GitHub OIDC provider with issuer
   `https://token.actions.githubusercontent.com`. Map `google.subject` to
   `assertion.sub`, and map each of `repository_id`, `repository_owner_id`,
   `workflow_ref`, `environment`, `ref`, and `event_name` from `assertion.NAME`
   to `attribute.NAME`. This follows Google's deployment-pipeline setup
   guidance to map the claims used by the condition; `repository_id` is also
   used in the service account's IAM binding.
   Restrict the provider to FontARA's immutable numeric identities and this
   workflow, for example:

   ```text
   assertion.repository_id == '141708904' &&
   assertion.repository_owner_id == '17767869' &&
   assertion.workflow_ref == 'mimalef70/fontara/.github/workflows/release.yml@' + assertion.ref &&
   assertion.environment == 'chrome-web-store' &&
   ((assertion.ref.startsWith('refs/tags/v') &&
     assertion.event_name in ['push', 'workflow_dispatch']) ||
    (assertion.ref == 'refs/heads/master' && assertion.event_name == 'workflow_dispatch'))
   ```

4. Grant `roles/iam.workloadIdentityUser` on the service account to the pool's
   `principalSet` for `attribute.repository_id/141708904`. Do not grant access
   to the whole pool or every GitHub repository.
5. Create the GitHub environment `chrome-web-store`. Allow only the `master`
   branch and `v*` tags. Keep tag creation restricted to release maintainers.
   If the environment has required reviewers, a release waits for their
   approval in GitHub; the Chrome dashboard is not involved.
6. Add these GitHub repository or environment **variables**:

   | Variable | Value |
   | --- | --- |
   | `CWS_PUBLISHER_ID` | Publisher ID from Chrome Web Store **Publisher → Settings**. |
   | `CWS_EXTENSION_ID` | `dcjdhicepiklefpimapdkbaeoocniemc` |
   | `CWS_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER` |
   | `CWS_SERVICE_ACCOUNT` | The linked service account email. |
   | `CWS_DEPLOY_PERCENTAGE` | Optional initial rollout percentage; defaults to `10`. |

Run the read-only authentication check on `master` after setup:

```sh
gh workflow run release.yml --ref master -f action=status
```

Missing configuration fails the Chrome job with an explicit error. It is not
silently treated as a successful store release. Read the official
[service account setup](https://developer.chrome.com/docs/webstore/service-accounts)
and [Google GitHub authentication action](https://github.com/google-github-actions/auth)
when configuring the trust relationship.

#### Concrete setup commands

The commands below document provisioning a fresh deployment. The configured
deployment above already exists; inspect it instead of rerunning creation
commands. Run these only for an authorized new project and publisher access
grant. Google project IDs are globally unique, so choose an available ID for
another deployment. These commands do not attach a billing
account, create service-account keys, or grant project editor/owner roles.
The Cloud Console can automatically associate an existing billing account when
creating a project. For a setup authorized without billing, check the project's
billing page immediately and remove an automatic association before enabling
APIs or creating release resources. The CLI guard below requires both
`billingEnabled: false` and an empty billing-account reference; an unreadable
or unexpected result stops setup.

```bash
set -euo pipefail
FONTARA_GCP_PROJECT_ID=fontara-releases
FONTARA_WIF_POOL=github-releases
FONTARA_WIF_PROVIDER=fontara-release
FONTARA_SA_NAME=fontara-store-release

gcloud projects create "$FONTARA_GCP_PROJECT_ID" --name="FontARA Releases"
gcloud billing projects describe "$FONTARA_GCP_PROJECT_ID" --format=json |
  python3 -c 'import json,sys; b=json.load(sys.stdin); sys.exit(0 if b.get("billingEnabled") is False and not b.get("billingAccountName") else "Stop: confirm the project has no billing account before continuing")'
gcloud services enable chromewebstore.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project="$FONTARA_GCP_PROJECT_ID"
gcloud iam service-accounts create "$FONTARA_SA_NAME" --display-name="FontARA Chrome release publisher" --project="$FONTARA_GCP_PROJECT_ID"

FONTARA_GCP_PROJECT_NUMBER="$(gcloud projects describe "$FONTARA_GCP_PROJECT_ID" --format='value(projectNumber)')"
FONTARA_SA_EMAIL="$FONTARA_SA_NAME@$FONTARA_GCP_PROJECT_ID.iam.gserviceaccount.com"

gcloud iam workload-identity-pools create "$FONTARA_WIF_POOL" --location=global --display-name="FontARA GitHub releases" --project="$FONTARA_GCP_PROJECT_ID"

FONTARA_WIF_CONDITION="assertion.repository_id == '141708904' && assertion.repository_owner_id == '17767869' && assertion.workflow_ref == 'mimalef70/fontara/.github/workflows/release.yml@' + assertion.ref && assertion.environment == 'chrome-web-store' && ((assertion.ref.startsWith('refs/tags/v') && assertion.event_name in ['push', 'workflow_dispatch']) || (assertion.ref == 'refs/heads/master' && assertion.event_name == 'workflow_dispatch'))"

FONTARA_WIF_MAPPING="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.workflow_ref=assertion.workflow_ref,attribute.environment=assertion.environment,attribute.ref=assertion.ref,attribute.event_name=assertion.event_name"

gcloud iam workload-identity-pools providers create-oidc "$FONTARA_WIF_PROVIDER" --workload-identity-pool="$FONTARA_WIF_POOL" --location=global --issuer-uri="https://token.actions.githubusercontent.com" --attribute-mapping="$FONTARA_WIF_MAPPING" --attribute-condition="$FONTARA_WIF_CONDITION" --project="$FONTARA_GCP_PROJECT_ID"

gcloud iam service-accounts add-iam-policy-binding "$FONTARA_SA_EMAIL" --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/projects/$FONTARA_GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/$FONTARA_WIF_POOL/attribute.repository_id/141708904" --project="$FONTARA_GCP_PROJECT_ID"

gh variable set CWS_WORKLOAD_IDENTITY_PROVIDER --repo mimalef70/fontara --env chrome-web-store --body "projects/$FONTARA_GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/$FONTARA_WIF_POOL/providers/$FONTARA_WIF_PROVIDER"
gh variable set CWS_SERVICE_ACCOUNT --repo mimalef70/fontara --env chrome-web-store --body "$FONTARA_SA_EMAIL"
gh variable set CWS_EXTENSION_ID --repo mimalef70/fontara --env chrome-web-store --body dcjdhicepiklefpimapdkbaeoocniemc
gh variable set CWS_DEPLOY_PERCENTAGE --repo mimalef70/fontara --env chrome-web-store --body 10
```

Create and restrict the GitHub environment before the `gh variable` commands.
Set `CWS_PUBLISHER_ID` to the ID displayed in **Publisher → Settings**, and
link `FONTARA_SA_EMAIL` in the Chrome publisher account to complete the grant.
All variables above are identifiers, not credentials. If resources already
exist, inspect them and update the provider's mapping/condition with
`gcloud iam workload-identity-pools providers update-oidc` instead of creating
duplicates. Do not reuse an unrelated project or service account silently.

GitHub's OIDC claims identify the workflow, ref, event, and environment but do
not expose `workflow_dispatch` inputs. The provider therefore permits the
exact `master` workflow for manual operations; the workflow's pre-authentication
guard permits only `action=status` on a branch. That action requests only the
`chromewebstore.readonly` scope. Submission and rollout both require a version
tag before Google authentication, and use the write scope.

The [Google deployment-pipeline guide](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
asks for mappings for all condition fields. The [IAM REST reference](https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.locations.workloadIdentityPools.providers)
also allows a condition to inspect the raw `assertion` directly; the complete
mapping above keeps this setup aligned with the guide without broadening trust.

### Verify the connection without publishing

After linking the service account and setting the GitHub variables, run the
read-only operation from the real release workflow:

```sh
gh workflow run release.yml --repo mimalef70/fontara --ref master -f action=status
gh run list --repo mimalef70/fontara --workflow release.yml --event workflow_dispatch --branch master --limit 5
```

Open the newly dispatched run, or use `gh run watch RUN_ID --exit-status` with
its ID. Confirm that the Google authentication and Chrome operation steps pass,
and that the build and GitHub publication jobs are skipped. This exercises
GitHub OIDC, the provider condition, service account impersonation, publisher
access, and `fetchStatus` with the `chromewebstore.readonly` scope. The script
checks the publisher/item identity before printing status. The returned version
is the published or submitted revision; an unpublished dashboard draft is not
reported by `fetchStatus`.

New pools, providers, and IAM bindings can take up to five minutes to propagate.
For a propagation failure immediately after setup, allow that interval and
retry the status run before changing permissions. Keep tokens out of diagnostic
output.

To exercise the release package gate without submitting an extension, dispatch:

```sh
gh workflow run release.yml --repo mimalef70/fontara --ref master -f action=verify
```

This runs the full shared verification matrix and produces the tested ZIP
artifact; both publication jobs must be skipped. Together these checks verify
the package gate and the live authentication/status path. They do not establish
that a real upload or review submission succeeded. Confirm those operations on
the first intended release. Creating a `v*` tag is an actual release trigger,
so it is not a non-publishing test.

### Publish a version

Update the package and source manifest versions together, merge the reviewed
release changes, then create the matching tag:

```sh
git tag -a v5.1.0 -m "Release 5.1.0"
git push origin v5.1.0
```

This runs the full verification matrix before either publication. For a manual
submission or retry, select the version tag in GitHub Actions, or run:

```sh
gh workflow run release.yml --ref v5.1.0 -f action=submit
```

Reruns recognize an already published or pending version without uploading it
again or changing its rollout. A different pending version, older package,
policy warning, failed upload, or validation warning stops publication. An
upload whose state is uncertain is not retried blindly; inspect `action=status`
first. If upload succeeded but submission failed, resolve the reported store
validation problem before retrying; the dashboard may be needed to inspect an
existing draft.

Normal `action=verify` manual runs perform verification only. `status` reads the
store state without rebuilding or publishing packages. Store submission and
rollout require an exact version tag matching `package.json`; arbitrary branch
runs cannot publish.

### Increase an approved rollout

After checking release health, increase the rollout explicitly from GitHub:

```sh
gh workflow run release.yml --ref v5.1.0 -f action=rollout -f deploy_percentage=25
```

The command verifies the live version before changing its percentage, and
cannot lower the percentage or replace a pending submission. Percentage
rollouts require Chrome's eligibility threshold of more than 10,000 seven-day
active users. No scheduled job advances rollout percentages automatically.

Google review and policy decisions still apply. The API preserves the item's
existing visibility. A manual visibility change must be published once in the
dashboard before API publishing resumes. Store descriptions, screenshots,
privacy declarations, and account settings still use the dashboard because
the current API does not expose editing those fields. Package updates can be
released from GitHub after the one-time setup. See the official
[API guide](https://developer.chrome.com/docs/webstore/using-api) and
[publish method](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish).

## Firefox Add-ons Automation

[firefox-release.yml](../.github/workflows/firefox-release.yml) uses publisher
code from `master` and the exact packages from a completed `Release` tag-push
run. It verifies repository identity, tag commit ancestry, all build/browser
checks, and both Firefox asset digests against the published GitHub release.
The original 5.1.0 release also uses the explicitly pinned reviewer-source
supplement described below; its original artifacts remain verified and unchanged.
It never executes code from the release source ZIP or rebuilds the package.
Expired/missing artifacts stop the operation instead of selecting another build.

The workflow supports three manual actions on `master`. Replace `vX.Y.Z` with
an existing verified tag, such as `v5.1.0`.

```sh
gh workflow run firefox-release.yml --ref master -f release_tag=vX.Y.Z -f action=validate
gh workflow run firefox-release.yml --ref master -f release_tag=vX.Y.Z -f action=status
gh workflow run firefox-release.yml --ref master -f release_tag=vX.Y.Z -f action=submit
```

- `validate` checks production/source identity and metadata without AMO credentials
  or requests. It does not prove Mozilla will accept or approve the upload.
- `status` verifies the production package and reads AMO state without uploading
  or changing a version. It does not require or download reviewer source supplements.
- `submit` uploads the verified ZIP to the existing listed add-on, waits for AMO
  validation, and creates the version with its source ZIP attached in the same
  request. Release notes and reviewer build instructions accompany the version.
  AMO may approve/sign a version automatically or send it for further review;
  `unreviewed` is an accepted submission, not proof of public availability.

A matching existing listed version with source attached is not uploaded again.
A disabled version, another pending review, a newer version, invalid upload, or
missing reviewer source stops submission. A retry repairs interrupted release-note
updates only when the existing reviewer notes identify the same production and
source hashes; it does not overwrite unrelated dashboard metadata. A same-version
no-op confirms AMO state, not byte identity of a previously uploaded ZIP.

### One-time AMO credentials

Create the GitHub environment `mozilla-addons`, restricted to the `master`
branch. Configure these environment secrets only after approving the account
access and their transfer to GitHub:

- `AMO_API_KEY`: issuer from Mozilla's API credentials page.
- `AMO_API_SECRET`: its corresponding signing secret.

Mozilla's API secret permits API requests on behalf of the Mozilla account; it
is not an add-on-scoped credential. The publisher creates a distinct HS256 JWT
with a 60-second lifetime for each request, while the underlying AMO secret
remains a long-lived credential. Never place either credential in repository
variables, source files, release notes, artifacts, or logs. The workflow exposes
these secrets only to the AMO operation step. Missing credentials fail explicitly.
See [Mozilla's authentication documentation](https://mozilla.github.io/addons-server/topics/api/auth.html)
and the [API credentials page](https://addons.mozilla.org/en-US/developers/addon/api/key/).

Automatic submission is **disabled by default**. Once account access and
publication have been approved, set the environment variable
`AMO_AUTO_SUBMIT_ENABLED` to the exact value `true`. Successful future `Release`
tag-push runs then trigger Firefox submission. Leave it unset to retain manual
submission and the staged observation policy below; automated runs still validate
packages and explicitly report that submission is disabled. Manual `submit` is an
explicit publication action and does not depend on this automatic switch.

### Reviewer source and the original 5.1.0 release

Source archives must include `.gitignore`, the lockfile, manifests, changelog,
and `FIREFOX_SOURCE_README.md`. Tailwind uses the ignore rules when discovering
source files, so leaving `.gitignore` out can change the rebuilt CSS. The original
`v5.1.0` source artifact omitted that file. Its corrected source is an additional
GitHub release asset named `firefox-mv3-source-5.1.0-review.zip`, not a replacement
for either original ZIP or the tag. The trusted publisher pins the release
commit, original production/source hashes, corrected source hash, and the exact
tag's `.gitignore` hash. Before any AMO request, it verifies both original CI
artifact hashes, the supplement's published and downloaded hashes, and every ZIP
entry: all original entries must be byte-identical and `.gitignore` must be the
only added entry. An isolated rebuild of this reviewed correction reproduced all
152 production file contents. Reviewer notes disclose the correction explicitly.

`validate` and `submit` download and check this one approved supplement through
the API workflow; no dashboard upload, rebuild, arbitrary source override, or
changed production package is needed. A missing or mismatched supplement stops
submission. `status` remains read-only and needs no supplement. Future releases
contain `.gitignore` in their normal verified source artifact and do not use this
exception. The fixed source hash is
`9d9f6df548148261fa1666b7917acced2525ea34aff85c50365addb604d80bf2`.

[Mozilla's source-submission requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/)
and [version/source API](https://mozilla.github.io/addons-server/topics/api/addons.html#version-sources)
describe the reviewer source and listed-version submission contract. Store listing
copy and screenshots remain separately maintained metadata.

## Release Checklist

- `pnpm check` passes.
- `pnpm build:all` passes and creates the Firefox source review package.
- `pnpm lint:extension` passes with no errors.
- Shared verification passes, including Chrome stable/130 and Firefox
  stable/140 ESR runtime and production smoke tests.
- Review the separate nightly matrix for beta/current-ESR compatibility issues.
- Store-facing text and screenshots are current.
- `LICENSE`, `THIRD_PARTY_NOTICES.md`, the OFL text, and
  `assets/fonts/provenance.json` are present in both production ZIPs.
- Chrome and Firefox production ZIPs install and pass smoke tests; neither
  contains the browser-test RPC strings.
- A real v5 backup migrates successfully, and no open High-severity finding
  remains.
- README and `docs/index.html` describe the current release accurately.
- `CHANGELOG.md` mentions user-visible changes, migration notes, and known
  issues.

## 5.1.0 Staged Rollout

1. Install the signed Chrome and Firefox artifacts in the internal test channel
   for three full days.
2. Publish Chrome Web Store at 10%, then advance to 25% after 48 hours, 50%
   after another 48 hours, and 100% after another 72 hours.
3. Publish Firefox only after Chrome has remained at 50% for 72 hours without a
   P0/P1 regression.
4. Stop rollout and roll back for any data loss, binary disclosure, extension
   startup failure, or three independent reports of the same regression.

Chrome tag releases submit the verified package for review with a 10% initial
rollout by default. The increases above are explicit `rollout` actions in the
Release workflow after the observation periods; they are never scheduled
automatically. Firefox submission follows the separate workflow above; keep
`AMO_AUTO_SUBMIT_ENABLED` unset while applying this staged observation policy.
Firefox rollback remains a separate, explicit action.
