# Security Policy

## Reporting a Vulnerability

**Do not** create a public GitHub issue for security vulnerabilities.

Instead, please contact the project maintainer directly via private communication with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact

We'll respond within 48 hours and provide updates on our progress.

## Security for Developers

When contributing:

- Follow the [Tauri Security Guide](https://v2.tauri.app/security/)
- Run `pnpm run check:all` before committing
- Be careful with file system operations - only access user-selected project directories
- Review Tauri command implementations for privilege escalation risks
- Update dependencies when security patches are available

## About This Application

Astro Editor is a local-first application that stores data on your machine and does not transmit content to external servers. It uses Tauri v2's security framework with sandboxed web views and validated IPC communication.
