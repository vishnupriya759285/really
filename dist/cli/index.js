#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
const recorder_1 = require("../tracer/recorder");
const mock_server_1 = require("../sandbox/mock-server");
const workspace_1 = require("../sandbox/workspace");
const runner_1 = require("../sandbox/runner");
const openai_client_1 = require("../agent/openai-client");
const analyzer_1 = require("../agent/analyzer");
const test_synthesizer_1 = require("../agent/test-synthesizer");
const fixer_1 = require("../agent/fixer");
const app_1 = require("../server/app");
const files_1 = require("../utils/files");
const program = new commander_1.Command();
program
    .name('bugtwin')
    .description('Turn hard-to-reproduce software bugs into deterministic regression tests with OpenAI-powered fixes.')
    .version('1.0.0');
// 1. bugtwin record <command>
program
    .command('record')
    .description('Execute target command with runtime tracing & zero-trust sanitization')
    .argument('<command...>', 'The target command and args to record (e.g. node server.js)')
    .option('-o, --out <path>', 'Custom path for output trace file', '.bugtwin.json')
    .action(async (commandParts, options) => {
    const fullCommand = commandParts.join(' ');
    console.log(chalk_1.default.cyan.bold('\n[BugTwin] Starting execution tracer...'));
    console.log(chalk_1.default.gray(`Command: ${fullCommand}`));
    console.log(chalk_1.default.gray(`Target output: ${options.out}\n`));
    const recorder = new recorder_1.TraceRecorder({
        command: fullCommand,
        outputFilePath: path_1.default.resolve(process.cwd(), options.out)
    });
    recorder.start();
    const [cmd, ...args] = commandParts;
    const isWindows = process.platform === 'win32';
    let capturedStderr = '';
    const child = (0, child_process_1.spawn)(cmd, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: isWindows,
        env: {
            ...process.env,
            BUGTWIN_ACTIVE: 'true'
        }
    });
    child.stdout?.on('data', (chunk) => {
        process.stdout.write(chunk);
        recorder.addBreadcrumb('log', chunk.toString('utf8').trim());
    });
    child.stderr?.on('data', (chunk) => {
        process.stderr.write(chunk);
        const text = chunk.toString('utf8');
        capturedStderr += text;
        recorder.addBreadcrumb('error', text.trim());
    });
    child.on('close', (code) => {
        if (code !== 0) {
            let errorMsg = `Process terminated with non-zero exit code: ${code}`;
            let stackTrace = undefined;
            // Try extracting error name and stack trace from capturedStderr
            const errMatch = capturedStderr.match(/([A-Za-z]+Error:[^\r\n]+)([\s\S]*)/);
            if (errMatch) {
                errorMsg = errMatch[1].trim();
                stackTrace = (errMatch[1] + errMatch[2]).trim();
            }
            const err = new Error(errorMsg);
            if (stackTrace)
                err.stack = stackTrace;
            recorder.recordError(err, true);
        }
        const trace = recorder.finalize();
        console.log(chalk_1.default.green.bold(`\n✔ BugTwin trace completed with status: ${trace.status}`));
        console.log(chalk_1.default.blue(`Run 'bugtwin replay' to reproduce in sandbox, or 'bugtwin fix' to generate regression test & fix.`));
        process.exit(code || 0);
    });
    child.on('error', (err) => {
        recorder.recordError(err, true);
        recorder.finalize();
        console.error(chalk_1.default.red.bold(`\n✖ Execution failed to launch: ${err.message}`));
        process.exit(1);
    });
});
// 2. bugtwin replay [traceFile]
program
    .command('replay')
    .description('Recreate failure in an isolated sandbox with deterministic mock replay')
    .argument('[traceFile]', 'Path to .bugtwin.json trace file', '.bugtwin.json')
    .action(async (traceFilePath) => {
    const resolvedPath = path_1.default.resolve(process.cwd(), traceFilePath);
    if (!fs_1.default.existsSync(resolvedPath)) {
        console.error(chalk_1.default.red.bold(`Trace file not found: ${resolvedPath}`));
        process.exit(1);
    }
    const trace = JSON.parse(fs_1.default.readFileSync(resolvedPath, 'utf8'));
    console.log(chalk_1.default.cyan.bold(`\n[BugTwin] Replaying Trace: ${trace.traceId}`));
    console.log(chalk_1.default.gray(`Recorded Error: ${trace.error?.message || 'None'}`));
    // Start mock server if network calls exist
    const mockServer = new mock_server_1.DeterministicMockServer(trace.networkCalls);
    const mockPort = await mockServer.start();
    console.log(chalk_1.default.magenta(`✔ Deterministic Mock Server active on port ${mockPort}`));
    // Setup isolated ephemeral workspace
    const workspace = new workspace_1.EphemeralWorkspace();
    const sandboxPath = await workspace.setup();
    console.log(chalk_1.default.blue(`✔ Isolated Sandbox established at: ${sandboxPath}`));
    if (trace.command) {
        console.log(chalk_1.default.yellow(`\nExecuting replay command: ${trace.command}...`));
        const parts = trace.command.split(' ');
        const result = await runner_1.SandboxRunner.executeCommand(parts[0], parts.slice(1), {
            cwd: sandboxPath,
            mockServerPort: mockPort,
            onStdout: (chunk) => process.stdout.write(chunk),
            onStderr: (chunk) => process.stderr.write(chunk)
        });
        console.log(chalk_1.default.cyan(`\nReplay finished in ${result.durationMs}ms (Exit code: ${result.exitCode})`));
        if (result.exitCode !== 0) {
            console.log(chalk_1.default.green.bold('✔ Bug successfully reproduced in isolated environment!'));
        }
        else {
            console.log(chalk_1.default.yellow('ℹ Command exited cleanly without triggering failure.'));
        }
    }
    await mockServer.stop();
    workspace.cleanup();
});
// 3. bugtwin fix [traceFile]
program
    .command('fix')
    .description('Autonomous OpenAI agent: Root Cause -> Regression Test -> Verified Code Patch')
    .argument('[traceFile]', 'Path to .bugtwin.json trace file', '.bugtwin.json')
    .option('--apply', 'Automatically apply verified patch directly to local working directory')
    .action(async (traceFilePath, options) => {
    const resolvedPath = path_1.default.resolve(process.cwd(), traceFilePath);
    if (!fs_1.default.existsSync(resolvedPath)) {
        console.error(chalk_1.default.red.bold(`Trace file not found: ${resolvedPath}`));
        process.exit(1);
    }
    const trace = JSON.parse(fs_1.default.readFileSync(resolvedPath, 'utf8'));
    console.log(chalk_1.default.cyan.bold(`\n======================================================`));
    console.log(chalk_1.default.cyan.bold(`   BugTwin Autonomous Repair Agent (Powered by AI)   `));
    console.log(chalk_1.default.cyan.bold(`======================================================\n`));
    const client = new openai_client_1.OpenAIClientWrapper();
    console.log(chalk_1.default.gray(`AI Model: ${client.getModel()} (${client.isConfigured() ? 'Connected' : 'Offline Heuristic Mode'})`));
    // Gather project source files recursively
    const sourceFiles = (0, files_1.collectProjectSourceFiles)(process.cwd());
    // Stage 1: Root Cause Analysis
    console.log(chalk_1.default.yellow.bold(`\n[Stage 1/3] Pinpointing Root Cause...`));
    const analyzer = new analyzer_1.FailureAnalyzer(client);
    const analysis = await analyzer.analyze(trace);
    console.log(chalk_1.default.green(`Headline: ${analysis.summary}`));
    console.log(chalk_1.default.gray(`Category: ${analysis.category} | Component: ${analysis.failingComponent}:${analysis.failingLine || '?'}`));
    console.log(chalk_1.default.white(`Explanation: ${analysis.explanation}`));
    // Stage 2: Regression Test Synthesis
    console.log(chalk_1.default.yellow.bold(`\n[Stage 2/3] Synthesizing Deterministic Regression Test...`));
    const testSynthesizer = new test_synthesizer_1.TestSynthesizer(client);
    const synthesizedTest = await testSynthesizer.synthesize(trace, analysis, sourceFiles);
    console.log(chalk_1.default.green(`Generated: ${synthesizedTest.filename}`));
    console.log(chalk_1.default.gray(synthesizedTest.description));
    // Stage 3: Autonomous Code Repair & Sandbox Verification
    console.log(chalk_1.default.yellow.bold(`\n[Stage 3/3] Sandbox Code Repair & Verification Loop...`));
    const workspace = new workspace_1.EphemeralWorkspace();
    await workspace.setup();
    const fixer = new fixer_1.AutonomousFixer(client);
    const fixResult = await fixer.fixAndVerify(workspace, trace, analysis, synthesizedTest, sourceFiles);
    if (fixResult.success) {
        console.log(chalk_1.default.green.bold(`\n✔ REPAIR VERIFIED: Regression test passed 100% in sandbox!`));
        console.log(chalk_1.default.cyan(`Iterations: ${fixResult.iterations} | Patched files: ${fixResult.patches.length}`));
        for (const patch of fixResult.patches) {
            console.log(chalk_1.default.magenta(`\nDiff for ${patch.filePath}:`));
            console.log(chalk_1.default.gray(`Summary: ${patch.diffSummary}`));
        }
        // Write the synthesized regression test to project so bug never returns
        const testPath = path_1.default.resolve(process.cwd(), synthesizedTest.filename);
        fs_1.default.writeFileSync(testPath, synthesizedTest.testCode, 'utf8');
        console.log(chalk_1.default.green(`\n✔ Saved regression test to: ${testPath}`));
        if (options.apply) {
            for (const patch of fixResult.patches) {
                fs_1.default.writeFileSync(path_1.default.resolve(process.cwd(), patch.filePath), patch.patchedContent, 'utf8');
                console.log(chalk_1.default.green(`✔ Applied patch directly to: ${patch.filePath}`));
            }
        }
        else {
            console.log(chalk_1.default.yellow(`\nRun with '--apply' to apply patches directly, or inspect in Web Dashboard ('bugtwin ui').`));
        }
    }
    else {
        console.log(chalk_1.default.red.bold(`\n✖ Automated verification could not reach green state.`));
    }
    workspace.cleanup();
});
// 4. bugtwin ui
program
    .command('ui')
    .description('Launch the modern BugTwin Web Dashboard')
    .option('-p, --port <port>', 'Port to run the dashboard on', '4100')
    .action((options) => {
    const port = parseInt(options.port, 10) || 4100;
    (0, app_1.startDashboardServer)(port);
});
program.parse(process.argv);
