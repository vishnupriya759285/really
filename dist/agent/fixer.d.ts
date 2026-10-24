import { BugTwinTrace } from '../tracer/types';
import { RootCauseAnalysis } from './analyzer';
import { SynthesizedTest } from './test-synthesizer';
import { OpenAIClientWrapper } from './openai-client';
import { EphemeralWorkspace } from '../sandbox/workspace';
import { RunResult } from '../sandbox/runner';
export interface PatchResult {
    filePath: string;
    originalContent: string;
    patchedContent: string;
    diffSummary: string;
}
export interface FixVerificationResult {
    success: boolean;
    iterations: number;
    patches: PatchResult[];
    preFixTestResult?: RunResult;
    postFixTestResult?: RunResult;
    verificationLogs: string[];
}
export declare class AutonomousFixer {
    private client;
    constructor(client: OpenAIClientWrapper);
    fixAndVerify(workspace: EphemeralWorkspace, trace: BugTwinTrace, analysis: RootCauseAnalysis, synthesizedTest: SynthesizedTest, sourceFiles: Record<string, string>, maxIterations?: number): Promise<FixVerificationResult>;
    private generatePatch;
    private heuristicPatch;
}
