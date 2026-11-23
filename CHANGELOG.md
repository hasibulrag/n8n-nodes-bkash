# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-23

### Added

- `bKash API` credential with Sandbox and Production environments. The token grant is cached in an expirable field, so bKash's limit of two grants per hour is respected.
- `bKash` node:
  - Payment: Create (mode `0011` checkout or `0001` with an agreement), Execute, Query.
  - Agreement: Create (mode `0000`), Execute, Query, Cancel.
  - Transaction: Search, Refund.
- 30-second timeout on every request, a bKash `statusCode` check, Continue On Fail support, and `usableAsTool`.
- Offline tests that check request shapes.
- Example workflow `examples/payment-flow.json`.
- GitHub Actions CI, plus npm publishing with provenance.

[0.1.0]: https://github.com/hasibulrag/n8n-nodes-bkash/releases/tag/v0.1.0
