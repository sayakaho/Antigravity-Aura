declare module 'sidecar_sdk' {
  export interface ResponseOptions {
    contentType?: string;
    status?: number;
    headers?: Record<string, string>;
  }

  export class Response {
    public body: string | Uint8Array;
    public contentType: string;
    public status: number;
    public headers?: Record<string, string>;
    constructor(body: string | Uint8Array, options?: ResponseOptions);
  }

  export class SidecarApp {
    public readonly config: {
      projectId?: string;
      conversationId?: string;
    };
    public page(route: string, handler: () => unknown | Promise<unknown>): void;
    public api(
      route: string,
      handler: (data: Record<string, unknown>) => unknown | Promise<unknown>,
      method?: string
    ): void;
    public run(): Promise<unknown>;
    public close(): Promise<void>;
  }
}
