# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Run native ReductStore and ReductBridge processes with private configuration, Transitive billing enforcement, a unique generated store API token, checksum-verified binary downloads, bounded native logs, clean process shutdown, and arm64 support, [PR-6](https://github.com/reductstore/tr-reduct-capability/pull/6).

## [0.1.0] - 2026-07-23

### Changed

- Prepare capability for publishing to the Transitive Robotics official store, [PR-4](https://github.com/reductstore/tr-reduct-capability/pull/4).

### Added

- Initial ReductStore capability: provision and manage a ReductStore instance and ReductBridge on a robot from the portal, [PR-2](https://github.com/reductstore/tr-reduct-capability/pull/2).
