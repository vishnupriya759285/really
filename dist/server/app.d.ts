import http from 'http';
export declare function startDashboardServer(port?: number): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
