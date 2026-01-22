---
description: how to run unit tests
---

To ensure code quality and stability, you can run the unit testing suite using the following steps:

1. **Run all tests once**:

```bash
npm test -- --run
```

2. **Run tests in watch mode** (best for development):

```bash
npm test
```

3. **Check coverage** (if enabled):

```bash
npx vitest run --coverage
```

The test files are located in `src/test/`. We currently have:

- `PlannerService.test.js`: Validates date math and formatting utilities.
- `Store.test.js`: Validates state mutations and reactivity transitions.
