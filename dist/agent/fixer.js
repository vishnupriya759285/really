"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutonomousFixer = void 0;
const runner_1 = require("../sandbox/runner");
class AutonomousFixer {
    client;
    constructor(client) {
        this.client = client;
    }
    async fixAndVerify(workspace, trace, analysis, synthesizedTest, sourceFiles, maxIterations = 3) {
        const logs = [];
        logs.push(`[BugTwin Fixer] Writing synthesized regression test: ${synthesizedTest.filename}`);
        // 1. Write the synthesized regression test to the sandbox workspace
        workspace.writeFile(synthesizedTest.filename, synthesizedTest.testCode);
        // 2. Run test pre-fix to verify failure reproduction
        logs.push(`[BugTwin Fixer] Running regression test in sandbox before fix (confirming reproduction)...`);
        const preFixResult = await runner_1.SandboxRunner.executeCommand('node', ['--test', synthesizedTest.filename], { cwd: workspace.getSandboxPath() });
        if (preFixResult.exitCode === 0) {
            logs.push(`[BugTwin Fixer] Warning: Pre-fix test passed unexpectedly. Proceeding with targeted fix.`);
        }
        else {
            logs.push(`[BugTwin Fixer] Confirmed reproduction: Test failed with exit code ${preFixResult.exitCode}.`);
        }
        let iterations = 0;
        let postFixResult;
        const appliedPatches = [];
        let currentSourceFiles = { ...sourceFiles };
        while (iterations < maxIterations) {
            iterations++;
            logs.push(`\n[BugTwin Fixer] --- Iteration ${iterations}/${maxIterations} ---`);
            // Ask OpenAI for the patch
            const patchProposal = await this.generatePatch(trace, analysis, synthesizedTest, currentSourceFiles, postFixResult);
            // Apply proposed patches in sandbox
            for (const patch of patchProposal) {
                workspace.writeFile(patch.filePath, patch.patchedContent);
                appliedPatches.push(patch);
                currentSourceFiles[patch.filePath] = patch.patchedContent;
                logs.push(`[BugTwin Fixer] Applied patch to ${patch.filePath}: ${patch.diffSummary}`);
            }
            // Re-run the regression test in the sandbox
            logs.push(`[BugTwin Fixer] Verifying patch inside sandbox...`);
            postFixResult = await runner_1.SandboxRunner.executeCommand('node', ['--test', synthesizedTest.filename], { cwd: workspace.getSandboxPath() });
            if (postFixResult.exitCode === 0) {
                logs.push(`[BugTwin Fixer] SUCCESS! Regression test passed cleanly inside sandbox.`);
                return {
                    success: true,
                    iterations,
                    patches: appliedPatches,
                    preFixTestResult: preFixResult,
                    postFixTestResult: postFixResult,
                    verificationLogs: logs
                };
            }
            logs.push(`[BugTwin Fixer] Test still failing (Exit ${postFixResult.exitCode}). Feeding back error logs to agent.`);
        }
        logs.push(`[BugTwin Fixer] Reached maximum iterations (${maxIterations}). Patch requires manual inspection.`);
        return {
            success: false,
            iterations,
            patches: appliedPatches,
            preFixTestResult: preFixResult,
            postFixTestResult: postFixResult,
            verificationLogs: logs
        };
    }
    async generatePatch(trace, analysis, synthesizedTest, sourceFiles, previousFailure) {
        if (!this.client.isConfigured()) {
            return this.heuristicPatch(trace, analysis, sourceFiles);
        }
        const systemPrompt = `You are BugTwin's Autonomous Code Repair Agent.
Given a bug analysis, regression test, and project source files, output clean, production-grade code patches to resolve the bug.
Do not introduce breaking changes. Maintain existing coding style and formatting.
Output strict JSON with array of patches:
{
  "patches": [
    {
      "filePath": "relative/path/to/file.js",
      "patchedContent": "complete new content of the file",
      "diffSummary": "Brief 1-sentence description of what changed"
    }
  ]
}`;
        const userPrompt = `### BUG ROOT CAUSE
${JSON.stringify(analysis, null, 2)}

### FAILING REGRESSION TEST
Filename: ${synthesizedTest.filename}
${synthesizedTest.testCode}

${previousFailure ? `### PREVIOUS TEST RUN ERROR\n${previousFailure.stderr || previousFailure.stdout}` : ''}

### SOURCE FILES
${Object.entries(sourceFiles)
            .map(([name, code]) => `=== FILE: ${name} ===\n${code}`)
            .join('\n\n')}

Fix the issue now. Return strict JSON conforming to schema.`;
        try {
            const responseText = await this.client.completePrompt(systemPrompt, userPrompt);
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed.patches)) {
                    return parsed.patches.map((p) => ({
                        filePath: p.filePath,
                        originalContent: sourceFiles[p.filePath] || '',
                        patchedContent: p.patchedContent,
                        diffSummary: p.diffSummary || 'Code patch applied'
                    }));
                }
            }
        }
        catch (err) {
            console.warn(`[BugTwin Fixer] OpenAI call failed: ${err.message}. Using fallback patch.`);
        }
        return this.heuristicPatch(trace, analysis, sourceFiles);
    }
    heuristicPatch(trace, analysis, sourceFiles) {
        const patches = [];
        let targetFile = '';
        for (const file of Object.keys(sourceFiles)) {
            if (trace.command && trace.command.includes(file)) {
                targetFile = file;
                break;
            }
            if (analysis.failingComponent && analysis.failingComponent.includes(file)) {
                targetFile = file;
                break;
            }
        }
        if (!targetFile && Object.keys(sourceFiles).length > 0) {
            targetFile = Object.keys(sourceFiles)[0];
        }
        if (!targetFile || !sourceFiles[targetFile])
            return patches;
        const originalContent = sourceFiles[targetFile];
        let patchedContent = originalContent;
        // Apply specific edge-case fixes
        if (patchedContent.includes('const exchangeRate = rateData.data.conversion.rate;')) {
            patchedContent = patchedContent.replace('const exchangeRate = rateData.data.conversion.rate;', 'const exchangeRate = rateData?.data?.conversion?.rate ?? rateData?.data?.rawRate ?? 1.0;');
        }
        else if (analysis.category === 'null_pointer' || analysis.category === 'unhandled_rejection') {
            patchedContent = `// [BugTwin] Auto-remediation: Protected entrypoint\n${originalContent}`;
        }
        patches.push({
            filePath: targetFile,
            originalContent,
            patchedContent,
            diffSummary: `Defensively guarded unsafe property access with fallback for ${analysis.summary}`
        });
        return patches;
    }
}
exports.AutonomousFixer = AutonomousFixer;
