# Testing in AgriMap Frontend

This document explains how to run and write tests for the AgriMap frontend using Jest and React Testing Library.

## Getting Started

The testing environment is already set up and configured. You can start testing by running the command below in the `frontend` directory.

### Commands

- **Run all tests:**
  ```bash
  npm test
  ```

- **Run tests in watch mode:**
  ```bash
  npm test -- --watch
  ```

- **Run a specific test file:**
  ```bash
  npm test <path_to_file>
  ```

## Configuration

The testing setup consists of several key configuration files:

- **`jest.config.cjs`**: The main Jest configuration file. It sets up the test environment (`jsdom`), defines module name mapping for assets and styles, and specifies the transformation for JavaScript/JSX files.
- **`.babelrc`**: Babel configuration used by `babel-jest` to transpile JSX and modern JavaScript for testing.
- **`src/setupTests.js`**: Imports `@testing-library/jest-dom` to provide custom matchers for more descriptive assertions (e.g., `toBeInTheDocument()`).
- **`src/__mocks__/fileMock.js`**: A mock file used to handle static asset imports (images, etc.) during tests, preventing errors from binary files.

## Writing Tests

Tests are located in the `src/__tests__` directory. You can create new test files ending in `.test.jsx` or `.test.js`.

### Example Test

```jsx
import React from 'react';
import { render, screen } from '@testing-library/react';

const SampleComponent = () => <div>Hello!</div>;

test('it renders the hello text', () => {
  render(<SampleComponent />);
  expect(screen.getByText(/hello!/i)).toBeInTheDocument();
});
```

### Best Practices

1.  **Test behavior, not implementation:** Focus on what the user sees and interacts with rather than the internal state of the component.
2.  **Use React Testing Library:** Prefer the utilities provided by RTL (`render`, `screen`, `fireEvent`) for consistent and accessible tests.
3.  **Keep tests isolated:** Ensure tests don't depend on each other.
