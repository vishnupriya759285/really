import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { BugTwinTrace } from '../tracer/types';
import { DeterministicMockServer } from '../sandbox/mock-server';
import { EphemeralWorkspace } from '../sandbox/workspace';
import { SandboxRunner } from '../sandbox/runner';
import { OpenAIClientWrapper } from '../agent/openai-client';
import { FailureAnalyzer } from '../agent/analyzer';
import { TestSynthesizer } from '../agent/test-synthesizer';
import { AutonomousFixer } from '../agent/fixer';
import { collectProjectSourceFiles } from '../utils/files';

export function startDashboardServer(port = 4100) {
  const app = express();
  app.use(express.json());

  // Static web UI
  const publicDir = path.resolve(__dirname, '../../public');
  app.use(express.static(publicDir));

  // Helper to load trace
  const getTrace = (): BugTwinTrace | null => {
    const tracePath = path.resolve(process.cwd(), '.bugtwin.json');
    if (fs.existsSync(tracePath)) {
      try {
        return JSON.parse(fs.readFileSync(tracePath, 'utf8'));
      } catch {
        return null;
      }
    }
    return null;
  };

  // Helper to get project source files
  const getSourceFiles = (): Record<string, string> => {
    return collectProjectSourceFiles(process.cwd());
  };

  // API Routes
  app.get('/api/status', (req, res) => {
    const client = new OpenAIClientWrapper();
    res.json({
      status: 'online',
      openAiConfigured: client.isConfigured(),
      model: client.getModel(),
      cwd: process.cwd(),
      hasTrace: Boolean(getTrace())
    });
  });

  app.get('/api/trace', (req, res) => {
    const trace = getTrace();
    if (!trace) {
      return res.status(404).json({ error: 'No .bugtwin.json found in current directory.' });
    }
    res.json(trace);
  });

  app.post('/api/replay', async (req, res) => {
    const trace = getTrace();
    if (!trace) {
      return res.status(400).json({ error: 'No trace available to replay.' });
    }

    try {
      const mockServer = new DeterministicMockServer(trace.networkCalls);
      const mockPort = await mockServer.start();

      const workspace = new EphemeralWorkspace();
      const sandboxPath = await workspace.setup();

      let result: import('../sandbox/runner').RunResult = {
        exitCode: 0,
        stdout: 'No command specified in trace',
        stderr: '',
        durationMs: 0,
        timedOut: false
      };
      if (trace.command) {
        const parts = trace.command.split(' ');
        result = await SandboxRunner.executeCommand(parts[0], parts.slice(1), {
          cwd: sandboxPath,
          mockServerPort: mockPort
        });
      }

      await mockServer.stop();
      workspace.cleanup();

      res.json({
        reproduced: result.exitCode !== 0,
        result
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/fix', async (req, res) => {
    const trace = getTrace();
    if (!trace) {
      return res.status(400).json({ error: 'No trace available to fix.' });
    }

    try {
      const client = new OpenAIClientWrapper();
      const sourceFiles = getSourceFiles();

      // 1. Analyze
      const analyzer = new FailureAnalyzer(client);
      const analysis = await analyzer.analyze(trace);

      // 2. Synthesize
      const testSynthesizer = new TestSynthesizer(client);
      const test = await testSynthesizer.synthesize(trace, analysis, sourceFiles);

      // 3. Fix & Verify in Sandbox
      const workspace = new EphemeralWorkspace();
      await workspace.setup();

      const fixer = new AutonomousFixer(client);
      const fixResult = await fixer.fixAndVerify(workspace, trace, analysis, test, sourceFiles);

      workspace.cleanup();

      res.json({
        analysis,
        synthesizedTest: test,
        fixResult
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/apply', (req, res) => {
    const { patches, testFile, testCode } = req.body;
    try {
      if (testFile && testCode) {
        fs.writeFileSync(path.resolve(process.cwd(), testFile), testCode, 'utf8');
      }

      if (Array.isArray(patches)) {
        for (const patch of patches) {
          if (patch.filePath && patch.patchedContent) {
            fs.writeFileSync(path.resolve(process.cwd(), patch.filePath), patch.patchedContent, 'utf8');
          }
        }
      }

      res.json({ success: true, message: 'Patches and regression test applied to workspace.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const server = http.createServer(app);
  server.listen(port, () => {
    console.log(chalk.cyan.bold('\n======================================================'));
    console.log(chalk.cyan.bold(`   BugTwin Web Dashboard is LIVE!                    `));
    console.log(chalk.cyan.bold(`   URL: http://localhost:${port}                      `));
    console.log(chalk.cyan.bold('======================================================\n'));
  });

  return server;
}
