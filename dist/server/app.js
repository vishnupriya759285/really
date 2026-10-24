"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDashboardServer = startDashboardServer;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
const mock_server_1 = require("../sandbox/mock-server");
const workspace_1 = require("../sandbox/workspace");
const runner_1 = require("../sandbox/runner");
const openai_client_1 = require("../agent/openai-client");
const analyzer_1 = require("../agent/analyzer");
const test_synthesizer_1 = require("../agent/test-synthesizer");
const fixer_1 = require("../agent/fixer");
const files_1 = require("../utils/files");
function startDashboardServer(port = 4100) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Static web UI
    const publicDir = path_1.default.resolve(__dirname, '../../public');
    app.use(express_1.default.static(publicDir));
    // Helper to load trace
    const getTrace = () => {
        const tracePath = path_1.default.resolve(process.cwd(), '.bugtwin.json');
        if (fs_1.default.existsSync(tracePath)) {
            try {
                return JSON.parse(fs_1.default.readFileSync(tracePath, 'utf8'));
            }
            catch {
                return null;
            }
        }
        return null;
    };
    // Helper to get project source files
    const getSourceFiles = () => {
        return (0, files_1.collectProjectSourceFiles)(process.cwd());
    };
    // API Routes
    app.get('/api/status', (req, res) => {
        const client = new openai_client_1.OpenAIClientWrapper();
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
            const mockServer = new mock_server_1.DeterministicMockServer(trace.networkCalls);
            const mockPort = await mockServer.start();
            const workspace = new workspace_1.EphemeralWorkspace();
            const sandboxPath = await workspace.setup();
            let result = {
                exitCode: 0,
                stdout: 'No command specified in trace',
                stderr: '',
                durationMs: 0,
                timedOut: false
            };
            if (trace.command) {
                const parts = trace.command.split(' ');
                result = await runner_1.SandboxRunner.executeCommand(parts[0], parts.slice(1), {
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/fix', async (req, res) => {
        const trace = getTrace();
        if (!trace) {
            return res.status(400).json({ error: 'No trace available to fix.' });
        }
        try {
            const client = new openai_client_1.OpenAIClientWrapper();
            const sourceFiles = getSourceFiles();
            // 1. Analyze
            const analyzer = new analyzer_1.FailureAnalyzer(client);
            const analysis = await analyzer.analyze(trace);
            // 2. Synthesize
            const testSynthesizer = new test_synthesizer_1.TestSynthesizer(client);
            const test = await testSynthesizer.synthesize(trace, analysis, sourceFiles);
            // 3. Fix & Verify in Sandbox
            const workspace = new workspace_1.EphemeralWorkspace();
            await workspace.setup();
            const fixer = new fixer_1.AutonomousFixer(client);
            const fixResult = await fixer.fixAndVerify(workspace, trace, analysis, test, sourceFiles);
            workspace.cleanup();
            res.json({
                analysis,
                synthesizedTest: test,
                fixResult
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/apply', (req, res) => {
        const { patches, testFile, testCode } = req.body;
        try {
            if (testFile && testCode) {
                fs_1.default.writeFileSync(path_1.default.resolve(process.cwd(), testFile), testCode, 'utf8');
            }
            if (Array.isArray(patches)) {
                for (const patch of patches) {
                    if (patch.filePath && patch.patchedContent) {
                        fs_1.default.writeFileSync(path_1.default.resolve(process.cwd(), patch.filePath), patch.patchedContent, 'utf8');
                    }
                }
            }
            res.json({ success: true, message: 'Patches and regression test applied to workspace.' });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    const server = http_1.default.createServer(app);
    server.listen(port, () => {
        console.log(chalk_1.default.cyan.bold('\n======================================================'));
        console.log(chalk_1.default.cyan.bold(`   BugTwin Web Dashboard is LIVE!                    `));
        console.log(chalk_1.default.cyan.bold(`   URL: http://localhost:${port}                      `));
        console.log(chalk_1.default.cyan.bold('======================================================\n'));
    });
    return server;
}
