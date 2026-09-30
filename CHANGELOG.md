# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0]

### Changed

- Migrated to the DHIS2 App Platform: React + TypeScript, `@dhis2/app-runtime`
  data engine, `@dhis2/ui` components. The custom fetch wrapper, jQuery,
  Materialize CSS and the legacy header-bar loader have been removed - the
  platform app shell provides the header bar on all supported versions.
- Minimum supported DHIS2 version is now 2.41.
- Conflict checks now consistently skip name/shortName uniqueness for
  organisation units (previously only the bulk check did).
- The scan now excludes objects whose whitespace issues are only in
  properties the tool cannot clean.
- Renamed to align with the repository: the app is now titled
  **Whitespace Remover Tool** with app key `tool-whitespace-remover`
  (previously "Whitespace Cleaner Tool"). Installing 1.0.0 does not
  replace an installed 0.x app — uninstall the old one manually.

## [0.2.0]

- Added support for global app shell header barn in 42 and above

## [0.1.0]

### Added

- Initial release.
