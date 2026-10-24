import { NetworkCallRecord, BreadcrumbRecord } from './types';
import { ZeroTrustSanitizer } from './sanitizer';
export declare class ExecutionInterceptor {
    private sanitizer;
    private onNetworkCall;
    private onBreadcrumb;
    private originalHttpLaunch?;
    private originalHttpsLaunch?;
    private originalConsole;
    constructor(sanitizer: ZeroTrustSanitizer, onNetworkCall: (record: NetworkCallRecord) => void, onBreadcrumb: (record: BreadcrumbRecord) => void);
    install(): void;
    private installConsoleInterceptors;
    private installHttpInterceptors;
    uninstall(): void;
}
