import { BugTwinTrace } from '../tracer/types';
import { RootCauseAnalysis } from './analyzer';
import { OpenAIClientWrapper } from './openai-client';
export interface SynthesizedTest {
    filename: string;
    testCode: string;
    testFramework: 'node:test' | 'jest';
    description: string;
}
export declare class TestSynthesizer {
    private client;
    constructor(client: OpenAIClientWrapper);
    synthesize(trace: BugTwinTrace, analysis: RootCauseAnalysis, sourceFiles: Record<string, string>): Promise<SynthesizedTest>;
    private heuristicFallback;
}
