import { BugTwinTrace } from '../tracer/types';
import { OpenAIClientWrapper } from './openai-client';
export interface RootCauseAnalysis {
    summary: string;
    category: 'unhandled_rejection' | 'network_failure' | 'state_inconsistency' | 'null_pointer' | 'concurrency_race' | 'schema_mismatch' | 'unknown';
    failingComponent?: string;
    failingLine?: number;
    explanation: string;
    reproductionHypothesis: string;
    recommendedFixApproach: string;
}
export declare class FailureAnalyzer {
    private client;
    constructor(client: OpenAIClientWrapper);
    analyze(trace: BugTwinTrace, relevantCodeSnippet?: string): Promise<RootCauseAnalysis>;
    private heuristicFallback;
}
