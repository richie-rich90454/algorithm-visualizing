# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.

Use GitHub's private vulnerability reporting instead:

1. Go to the repository's **Security** tab.
2. Select **Report a vulnerability** (under "Vulnerabilities").
3. Describe the issue, the steps to reproduce it, the affected version or commit, and the potential impact.

If private reporting is unavailable for this repository, contact a maintainer privately through GitHub by opening a draft security advisory or by sending a direct message through GitHub. Do not include exploit details in public channels.

You should receive an acknowledgement within a few days. We will work with you on a fix and coordinate disclosure. Please give us a reasonable window to address the issue before public disclosure.

## What to report

- Cross-site scripting or other injection issues in the app
- Problems with how external or user-provided data is handled
- Dependency vulnerabilities with a practical exploit path
- Issues that could expose user data or enable unauthorized access

## Scope

This is a static, client-side application with no backend, accounts, or server-side data storage. Reports about the visualization logic itself that do not have a security impact are better filed as bugs using the bug report template.

## Supported versions

Security fixes are applied to the latest commit on the default branch and to the most recent published release.
