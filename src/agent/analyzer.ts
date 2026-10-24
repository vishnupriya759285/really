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

export class FailureAnalyzer {
  private client: OpenAIClientWrapper;

  constructor(client: OpenAIClientWrapper) {
    this.client = client;
  }

  public async analyze(trace: BugTwinTrace, relevantCodeSnippet?: string): Promise<RootCauseAnalysis> {
    if (!this.client.isConfigured()) {
      return this.heuristicFallback(trace, relevantCodeSnippet);
    }

    const systemPrompt = `You are BugTwin's Expert Root-Cause Debugging Agent.
Your job is to examine sanitized failure execution traces and pinpoint the exact underlying bug, why it occurred, and how to reliably reproduce it in a regression test.
Always reply with valid JSON conforming to this schema:
{
  "summary": "Short 1-sentence headline of the bug",
  "category": "unhandled_rejection" | "network_failure" | "state_inconsistency" | "null_pointer" | "concurrency_race" | "schema_mismatch" | "unknown",
  "failingComponent": "file or module name",
  "failingLine": 42,
  "explanation": "Detailed technical root-cause breakdown",
  "reproductionHypothesis": "Exact inputs or conditions triggering this state",
  "recommendedFixApproach": "How the code should be patched"
}`;

    const userPrompt = `### SANITIZED TRACE SUMMARY
- App: ${trace.appName}
- Status: ${trace.status}
- Error Name: ${trace.error?.name || 'N/A'}
- Error Message: ${trace.error?.message || 'N/A'}
- Stack Trace:
${trace.error?.stack || 'No stack trace available'}

### RECENT BREADCRUMBS (${trace.breadcrumbs.length})
${JSON.stringify(trace.breadcrumbs.slice(-5), null, 2)}

### NETWORK CALLS RECORDED (${trace.networkCalls.length})
${JSON.stringify(trace.networkCalls.slice(-5), null, 2)}

### ENVIRONMENT CONTEXT
- Node: ${trace.environment.nodeVersion}
- Platform: ${trace.environment.platform}
- Timezone: ${trace.environment.timezone}

${relevantCodeSnippet ? `### RELEVANT SOURCE CODE\n${relevantCodeSnippet}` : ''}

Identify the root cause and output strict JSON.`;

    try {
      const responseText = await this.client.completePrompt(systemPrompt, userPrompt);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as RootCauseAnalysis;
      }
    } catch (err: any) {
      console.warn(`[BugTwin Analyzer] OpenAI call failed: ${err.message}. Falling back to heuristic analysis.`);
    }

    return this.heuristicFallback(trace, relevantCodeSnippet);
  }

  private heuristicFallback(trace: BugTwinTrace, code?: string): RootCauseAnalysis {
    const errorMsg = trace.error?.message || 'Unknown error occurred';
    const stack = trace.error?.stack || '';

    let category: RootCauseAnalysis['category'] = 'unknown';
    if (errorMsg.includes('undefined') || errorMsg.includes('null')) {
      category = 'null_pointer';
    } else if (errorMsg.includes('fetch') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('404') || errorMsg.includes('500')) {
      category = 'network_failure';
    } else if (errorMsg.includes('unhandled') || trace.error?.unhandled) {
      category = 'unhandled_rejection';
    }

    // Extract file and line from stack trace
    let failingComponent = 'unknown';
    let failingLine: number | undefined;
    const stackMatch = stack.match(/at\s+(?:.*?\s+\()?([^\s)]+):(\d+):(\d+)\)?/);
    if (stackMatch) {
      failingComponent = stackMatch[1];
      failingLine = parseInt(stackMatch[2], 10);
    }

    return {
      summary: `Failure triggered by: ${errorMsg.substring(0, 100)}`,
      category,
      failingComponent,
      failingLine,
      explanation: `Execution crashed with ${trace.error?.name || 'Error'}: "${errorMsg}". Stack points to ${failingComponent}${failingLine ? ` at line ${failingLine}` : ''}. During execution, ${trace.networkCalls.length} network requests and ${trace.breadcrumbs.length} breadcrumb events were recorded.`,
      reproductionHypothesis: `Re-invoking with inputs matching the trace triggers the unhandled exception path in ${failingComponent}.`,
      recommendedFixApproach: `Add defensive validation or proper error handling at ${failingComponent}:${failingLine || 'entry point'} to handle missing/unexpected inputs.`
    };
  }
}
