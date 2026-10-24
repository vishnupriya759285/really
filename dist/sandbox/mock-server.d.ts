import { NetworkCallRecord } from '../tracer/types';
export declare class DeterministicMockServer {
    private server?;
    private port;
    private networkCalls;
    private matchIndex;
    constructor(networkCalls: NetworkCallRecord[], preferredPort?: number);
    start(): Promise<number>;
    private findMatchingCall;
    private isMatch;
    stop(): Promise<void>;
    getPort(): number;
}
