# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1]

### Upgrading

- If you are upgrading from a 0.x version (Whitespace Cleaner Tool), follow the upgrading steps for 1.0.0: the app key changed in that release.

### Changed

- Visualizations, event visualizations and maps are no longer shown or fixed. In DHIS2 2.41 to 2.43, changing one of these objects through the API removes the data elements from its data element operands, and the object can no longer be opened.
- User documentation moved to `docs/user/`, in the format used by docs.dhis2.org.
- The end-to-end suite moved to `e2e/` and follows the `run.sh` contract of the tool conventions.

### Fixed

- The conflict check now finds duplicates of values that contain a comma. On DHIS2 2.42 and later they were missed.
- Options are checked for duplicate names and codes within their option set only, which is what DHIS2 requires. Before, an option with the same name in another option set was reported as a conflict.
- When DHIS2 rejects a fix, the fix results show the reason instead of a generic message.
- The alert for failed conflict checks is now translatable.

## [1.0.0]

### Upgrading

- Requires DHIS2 2.41 or later.
- The app key changed from `tool-whitespace-cleaner` to `tool-whitespace-remover`, so DHIS2 installs 1.0.0 as a new app next to the old one:
    1. Install the new version, then uninstall the old Whitespace Cleaner Tool in App Management, or two entries remain in the menu.
    2. Add the new app to every user role that gave access to the old one. Until then, users without the ALL authority cannot open it.
    3. Bookmarks to the old app URL stop working.

### Changed

- Migrated to the DHIS2 App Platform: React + TypeScript, `@dhis2/app-runtime`
  data engine, `@dhis2/ui` components. The custom fetch wrapper, jQuery,
  Materialize CSS and the legacy header-bar loader have been removed - the
  platform app shell provides the header bar on all supported versions.
- Conflict checks now consistently skip name/shortName uniqueness for
  organisation units (previously only the bulk check did).
- The scan now excludes objects whose whitespace issues are only in
  properties the tool cannot clean.
- Renamed to align with the repository: the app is now titled
  **Whitespace Remover Tool** with app key `tool-whitespace-remover`
  (previously "Whitespace Cleaner Tool").

## [0.2.0]

### Added

- Support for the global app shell header bar in DHIS2 2.42 and later.

## [0.1.0]

### Added

- Initial release.
