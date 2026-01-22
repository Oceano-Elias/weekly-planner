# Weekly Planner V3

A lightweight, distraction-free weekly planner and focus tool built with Vanilla JavaScript, Vite, and Tauri.

## Features

- **Weekly & Day Views**: Drag-and-drop task scheduling.
- **Focus Mode**: Immersive timer with ambient sounds and decision tracking.
- **Task Queue**: Backlog management for unscheduled tasks.
- **Analytics**: Visualize productivity trends and department allocation.
- **Offline Support**: Fully functional PWA with Service Worker.
- **Desktop App**: Native experience via Tauri.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules), CSS3 Variables.
- **Build Tool**: Vite.
- **Desktop Wrapper**: Tauri (Rust).
- **Testing**: Vitest.
- **Linting/Formatting**: ESLint, Prettier.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Rust (for Tauri development)

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Development

Start the web development server:

```bash
npm run dev
```

Start the desktop application (requires Rust):

```bash
npm run tauri:dev
```

### Building

Build for web (PWA):

```bash
npm run build
```

Build for desktop:

```bash
npm run tauri:build
```

### Quality Control

Run linter:

```bash
npm run lint
```

Run unit tests:

```bash
npm test
```

## Project Structure

- `src/components/`: UI logic (Calendar, FocusMode, etc.).
- `src/services/`: Business logic (PlannerService, etc.).
- `src/styles/`: Component-specific CSS.
- `src/test/`: Unit tests.
- `src-tauri/`: Rust backend configuration.
- `public/sw.js`: Service Worker for offline capabilities.

## Contributing

1.  Ensure all tests pass: `npm test`
2.  Format code: `npm run format`
3.  Submit a Pull Request.

## License

Private.
