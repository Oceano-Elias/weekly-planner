# Changelog

All notable changes to Weekly Planner will be documented in this file.

## [3.2.0] - 2026-01-31

### Added
- **DevLog utility** for dev-only console logging
- **DragDropService tests** - 12 tests for time slot utilities
- **Toast component tests** - 15 tests for notification system
- **Parking Lot visuals** - clear visual cues for queued blocks
- **Zen audio synthesis** - gong and bell sounds for task actions

### Changed
- **Vite upgraded** from 5.4.21 to 7.3.1
- **Production builds** now strip console.log/debugger statements
- **FocusAudio** converted from dynamic to static import

### Fixed
- **Focus Mode Complete button** - now green, persistent, and animates with carousel
- **Carousel rendering** - reduced backdrop blur, added GPU hints
- **Button click responsiveness** - uses event delegation for dynamic buttons
- **Weekly system bugs** - duplicate confirmations, task copying, reappearing tasks
- **PiP/Focus Mode timers** - unified synchronization

### Performance
- Bundle size reduced to 57.23KB gzipped (from 58.45KB)
- Reduced backdrop-filter blur for faster GPU rendering
- Skip DOM rebuild when card index unchanged

## [3.1.0] - 2026-01-09

### Added
- Step Completion Reward System
- Enhanced PiP controls
- Active task visual indicators in calendar views

### Changed
- Increased block vibrancy and color contrast
- Grid height synced to 56px

### Fixed
- Focus mode stability and robustness improvements
