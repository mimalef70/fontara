# Security Policy

FontARA is a browser extension with access to page content and extension
storage, so security reports should be handled privately.

## Supported Versions

Security fixes target the current release line first. Older browser store
versions may lag behind the repository until a new package is reviewed and
published.

## Reporting a Vulnerability

Please do not open a public GitHub issue for a security vulnerability.

Use one of these private channels:

- GitHub private vulnerability reporting, if it is enabled for the repository.
- A direct private contact with the maintainer listed on the GitHub profile or
  project website.

Include:

- Affected browser and operating system.
- FontARA version or commit.
- Steps to reproduce.
- Expected impact.
- Whether the issue requires a malicious website, a malicious extension, or user
  interaction.

Reports will be investigated with the smallest practical code change and a
release note when disclosure is appropriate.

## Security-Sensitive Areas

- Content script injection and page messaging.
- Custom font upload validation and data URLs.
- Backup import parsing.
- Storage sync chunking and restore behavior.
- Site CSS that could target unintended page content.
- Extension page CSP and web-accessible resources.
