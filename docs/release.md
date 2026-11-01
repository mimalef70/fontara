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

### One-time authentication setup

Use a Google Cloud service account with GitHub Workload Identity Federation
(OIDC). The workflow requests a short-lived access token; no JSON private key,
OAuth client secret, or refresh token is stored in GitHub or in a release ZIP.

1. In a Google Cloud project, enable the Chrome Web Store API and the IAM
   Service Account Credentials API. Create a service account dedicated to
   FontARA releases; it does not need project-wide editor or owner roles.
2. In the Chrome Web Store publisher account, link that service account email.
   Chrome currently allows one service account per publisher. This grants
   access to all items owned by that publisher, so use a dedicated account and
   restrict its GitHub trust carefully.
3. Create a Workload Identity Pool and GitHub OIDC provider with issuer
   `https://token.actions.githubusercontent.com`. Map `google.subject` to
   `assertion.sub` and `attribute.repository_id` to `assertion.repository_id`.
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

The following is a setup plan, not a record of resources already created. Run
it once from an authenticated Google Cloud CLI after authorizing creation of
the dedicated project and the publisher access grant. The proposed project ID
is `fontara-releases`; Google project IDs are globally unique, so choose an
available ID if that name is taken. These commands do not attach a billing
account, create service-account keys, or grant project editor/owner roles.

```sh
FONTARA_GCP_PROJECT_ID=fontara-releases
FONTARA_WIF_POOL=github-releases
FONTARA_WIF_PROVIDER=fontara-release
FONTARA_SA_NAME=fontara-store-release

gcloud projects create "$FONTARA_GCP_PROJECT_ID" --name="FontARA Releases"
gcloud services enable chromewebstore.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project="$FONTARA_GCP_PROJECT_ID"
gcloud iam service-accounts create "$FONTARA_SA_NAME" --display-name="FontARA Chrome release publisher" --project="$FONTARA_GCP_PROJECT_ID"

FONTARA_GCP_PROJECT_NUMBER="$(gcloud projects describe "$FONTARA_GCP_PROJECT_ID" --format='value(projectNumber)')"
FONTARA_SA_EMAIL="$FONTARA_SA_NAME@$FONTARA_GCP_PROJECT_ID.iam.gserviceaccount.com"

gcloud iam workload-identity-pools create "$FONTARA_WIF_POOL" --location=global --display-name="FontARA GitHub releases" --project="$FONTARA_GCP_PROJECT_ID"

FONTARA_WIF_CONDITION="assertion.repository_id == '141708904' && assertion.repository_owner_id == '17767869' && assertion.workflow_ref == 'mimalef70/fontara/.github/workflows/release.yml@' + assertion.ref && assertion.environment == 'chrome-web-store' && ((assertion.ref.startsWith('refs/tags/v') && assertion.event_name in ['push', 'workflow_dispatch']) || (assertion.ref == 'refs/heads/master' && assertion.event_name == 'workflow_dispatch'))"

gcloud iam workload-identity-pools providers create-oidc "$FONTARA_WIF_PROVIDER" --workload-identity-pool="$FONTARA_WIF_POOL" --location=global --issuer-uri="https://token.actions.githubusercontent.com" --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id" --attribute-condition="$FONTARA_WIF_CONDITION" --project="$FONTARA_GCP_PROJECT_ID"

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
automatically. Firefox store publication and rollback remain separate actions.
