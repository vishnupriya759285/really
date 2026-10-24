# BugTwin Architecture & Implementation Blueprint

## 1. Executive Overview
**BugTwin** turns hard-to-reproduce software bugs into deterministic, automated regression tests. It captures sanitized execution traces from applications, recreates failures inside an isolated sandbox, performs root-cause analysis, synthesizes verified regression tests, and autonomously generates/verifies code fixes using the OpenAI API.

---

## 2. Core Modules & Responsibilities

### Module A: Tracer SDK & Interceptors (`@bugtwin/tracer`)
- **Node.js HTTP/HTTPS Interceptor**: Records outgoing/incoming requests, headers, and responses.
- **State & Unhandled Error Hook**: Traps uncaught exceptions, promise rejections, and console errors with complete execution breadcrumbs and stack traces.
- **Environment & Time Snapshot**: Captures environment variable keys/sanitized values, system timezone, and seed state.
- **Zero-Trust Sanitizer**:
  - Automatically redacts authorization headers (`Bearer`, `Basic`), cookies, API keys, passwords, and PII (emails, card patterns).
  - Honors `.bugtwinignore.json` for custom regex and field exclusion rules.

### Module B: Sandbox & Isolation Engine (`@bugtwin/sandbox`)
- **Virtual Workspace**: Creates isolated ephemeral workspaces copying target project files without mutating the active working directory.
- **I/O Mock Replay Server**: Replays recorded external API responses deterministically during test runs to eliminate external flake.
- **Process Isolation**: Spawns sandboxed runner processes with restricted environment variables and memory limits (with `--docker` flag support for containerized execution).

### Module C: Autonomous OpenAI Agent Engine (`@bugtwin/agent`)
- **Phase 1: Root Cause Analysis**: Analyzes trace breadcrumbs, stack traces, and relevant source files to pinpoint the exact failure mechanism.
- **Phase 2: Regression Test Synthesis**: Generates a self-contained, reproducible test file (e.g., `bugtwin-<bug-id>.spec.ts`) that reliably triggers the failure.
- **Phase 3: Autonomous Repair & Verification**:
  1. Executes the synthesized test in the sandbox (asserts that it fails on the current code).
  2. Synthesizes a minimal, clean code patch.
  3. Applies the patch and executes both the new regression test and the existing test suite.
  4. Loops if errors remain until all tests are 100% green.

### Module D: Dual Developer Experience (CLI & Web UI)
- **CLI (`bugtwin`)**:
  - `bugtwin record <cmd>`: Starts process with tracing enabled.
  - `bugtwin replay <trace.json>`: Reproduces the failure deterministically in the sandbox.
  - `bugtwin fix <trace.json>`: Runs the autonomous AI agent loop and outputs git diff/branch.
  - `bugtwin ui`: Launches the local Web Dashboard on `http://localhost:4100`.
- **Modern Web Dashboard**:
  - **Trace Inspector**: Visual timeline of HTTP requests, console logs, and exception states.
  - **Sandbox Replay Status**: Live terminal/log streaming of reproduction steps.
  - **Regression Test Viewer**: Highlighting synthesized test code.
  - **Interactive Diff Viewer**: Side-by-side patch inspection with one-click "Apply & Commit" or "Open PR".

---

## 3. Implementation Phasing Roadmap

| Phase | Milestone | Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | **Core Foundation & SDK** | TypeScript project setup, Tracer SDK, Zero-Trust Sanitizer, `.bugtwin.json` schema, CLI scaffolding. |
| **Phase 2** | **Isolation & Sandbox Runner** | Node subprocess sandbox, mock network replay server, isolated reproduction validator. |
| **Phase 3** | **OpenAI Multi-Stage Agent** | Root-cause analyzer, Jest/Vitest regression test generator, iterative code fixer with sandbox feedback loop. |
| **Phase 4** | **Modern Web Dashboard** | Premium web UI (Vite/Vanilla CSS/Express API), trace visualizer, live diff & replay controls. |
| **Phase 5** | **End-to-End Demo & Verification** | Realistic sample repository with a subtle, hard-to-reproduce bug, demonstrating capture -> test synthesis -> AI fix -> PR. |
