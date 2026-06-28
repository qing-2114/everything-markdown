# Fast Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a faster-launching Windows distribution without changing app features.

**Architecture:** Keep runtime code unchanged and reduce launch overhead by switching the Windows packaging target from Electron Builder `portable` to `nsis`. The converter remains bundled as an extra resource and is still called only during conversion.

**Tech Stack:** Electron, electron-builder, PyInstaller, Node test runner.

---

### Task 1: Add Packaging Configuration Coverage

**Files:**
- Modify: `tests/main.test.js`
- Read: `package.json`

- [ ] **Step 1: Write a failing packaging test**

Add a Node test that loads `package.json` and asserts the Windows target is `nsis`, not `portable`, and that the artifact name is installer-oriented.
Also assert that `scripts.dist:win` does not pass `portable` on the command line, so Electron Builder uses the configured `nsis` target.
Also assert that `build.electronDist` points at `node_modules/electron/dist`.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test`

Expected: one new failure showing the current target is still `portable`.

### Task 2: Switch Windows Build Target

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Change `build.win.target`**

Replace the current portable target with:

```json
{
  "target": "nsis",
  "arch": [
    "x64"
  ]
}
```

- [ ] **Step 2: Change artifact name**

Set `build.win.artifactName` to:

```json
"Everything Markdown Setup ${version}.${ext}"
```

- [ ] **Step 3: Use local Electron distribution**

Set `build.electronDist` to:

```json
"node_modules/electron/dist"
```

- [ ] **Step 4: Run tests**

Remove the forced target from `scripts.dist:win` so it becomes:

```json
"dist:win": "npm run build:converter && electron-builder --win"
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all tests pass.

### Task 3: Update Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update user download wording**

Change the release instructions from portable executable language to Windows installer language.

- [ ] **Step 2: Update build output wording**

Change the packaging section from portable build to installer build and update the expected artifact path.

### Task 4: Build and Inspect Release

**Files:**
- Generated: `release/Everything Markdown Setup 0.1.0.exe`

- [ ] **Step 1: Build**

Run: `npm run dist:win`

Expected: exit code 0 and an installer in `release/`.

- [ ] **Step 2: Inspect outputs**

Run: `Get-ChildItem release`

Expected: installer file appears with the configured name.

- [ ] **Step 3: Check git status**

Run: `git status --short --branch`

Expected: only intentional source/doc/test changes are shown; generated release output stays ignored.
