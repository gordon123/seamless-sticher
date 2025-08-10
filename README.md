# Seamless Stitcher

A lightweight dev scaffold for stitching images into seamless panoramas. This repository hosts a minimal static dev server and a small set of utilities used by the self-test harness.

## Quick start

Prerequisites:
- Node.js (LTS version recommended)

Install
- npm install

Run
- npm run dev
  - This starts the dev server (via dev.js) on http://localhost:5173
  - Alternatively, you can run: node dev.js

Verify
- Open http://localhost:5173 in your browser
- Or curl -s http://localhost:5173 to fetch the dev HTML

Self-tests
- Run the test suite:
  - node tests/self-test.js
  - If you previously used CommonJS tests, you can also run: node tests/self-test.cjs

Project structure and notes
- The repository root now holds a single canonical project. A nested copy at seamless-sticher/seamless-sticher was consolidated into the root to avoid duplication.
- The root index.html loads a minimal App.jsx and demonstrates runtime access to helper utilities.
- The App.jsx module exports a set of helper utilities on the App object for runtime use:
  - App.clamp
  - App.genId
  - App.rad
  - App.snapCenter
  - App.layerAABB
  - App.contentBounds
  - App.planAutoExpand
  - App.isWalletErrorMessage
- These utilities are intended for test harnesses and lightweight runtime scripting, not for building a full UI. If you need a full React render path, we can wire a simple root render next.

Contributing and workflow
- If you want to merge changes to main, use a standard git workflow (feature branch -> PR to main) and push after review.
- For port issues, ensure port 5173 is available or configure a fallback in dev.js.

Troubleshooting
- If npm run dev fails due to port in use (EADDRINUSE), identify the PID using lsof -iTCP:5173 -sTCP:LISTEN -t and kill it, then restart dev.
- ESLint warnings about unused utilities can be resolved by wiring App.* bindings (as implemented) so runtime scripts can access App.* directly while keeping the module exports clean.

End of readme. If you want, I can tailor the README to include more detailed commands or examples tailored to your preferred workflow.
