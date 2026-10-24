# 🪞 BugTwin

> **Turn hard-to-reproduce software bugs into reliable, automated regression tests.**

BugTwin captures sanitized execution traces, recreates failures inside an isolated sandbox, identifies root causes, and uses AI agents to synthesize deterministic regression tests and verified code fixes.

---

## ⚡ Key Features

- **Zero-Trust Trace Sanitizer**: Automatically redacts API keys, bearer tokens, passwords, cookies, and PII from execution traces before processing.
- **Deterministic Sandbox Replay**: Recreates environments and replays network interactions in an isolated workspace without mutating your working tree.
- **AI Root-Cause Diagnosis**: Analyzes breadcrumbs, stack traces, and relevant files to pinpoint why edge-case failures happen.
- **Automated Regression Test Synthesis**: Generates self-contained, reproducible `node:test` regression tests that guarantee the bug never returns.
- **Self-Verifying Code Repair**: Synthesizes minimal code patches and validates them inside the sandbox until test suites are 100% green.
- **Developer Showcase Demo & SDK**: Includes an interactive demo portal and embeddable SDK (`bugtwin-sdk.js`) for capturing external application exceptions.

---

## 🏗️ Repository Architecture

```
├── demo-site/          # Interactive showcase web portal & demo server
│   ├── public/         # Interactive UI, scenario runners, and bugtwin-sdk.js
│   └── server.js       # Express server with live OpenAI multi-stage pipeline
├── dist/               # Compiled TypeScript build (CLI and core modules)
├── examples/           # Sample services with realistic edge-case bugs
│   └── flaky-payment-service/
├── public/             # BugTwin Web Dashboard
├── src/                # Core BugTwin TypeScript engine
│   ├── agent/          # Root-cause analysis, test synthesizer, repair agent
│   ├── cli/            # BugTwin CLI commands (record, replay, fix, ui)
│   ├── sandbox/        # Ephemeral workspace runner & mock HTTP replay
│   ├── server/         # Express & WebSocket ingestion server
│   └── tracer/         # Zero-trust sanitizer, HTTP interceptor, recorder
├── .bugtwin.json       # Project configuration schema
├── ARCHITECTURE.md     # In-depth architectural blueprint
└── package.json
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Copy the template and provide your OpenAI API key:
```bash
cp .env.example .env
```
Edit `.env`:
```ini
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
DEMO_PORT=5500
```

### 4. Build TypeScript Source
```bash
npm run build
```

### 5. Run the Showcase Demo Portal
```bash
node demo-site/server.js
```
Open **`http://localhost:5500`** in your browser to test live scenarios (currency conversion errors, race conditions, timezone drift), inspect sanitized traces, and trigger the AI repair pipeline.

---

## 🛡️ Zero-Trust Security Guarantee
BugTwin never transmits or commits raw credentials. All traces pass through `ZeroTrustSanitizer` before reaching any model or persistent storage, redacting:
- Authorization headers (`Bearer`, `Basic`)
- API tokens & secret keys
- Session cookies
- PII (email addresses, phone numbers, credit card patterns)

---

## 📄 License
MIT
