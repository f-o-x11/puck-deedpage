export interface PublishResult {
  ok: true; url: string; path_url: string; slug: string; version: string;
  created: boolean; republished: boolean; ref: string; partner: string;
  /** Owner bearer token. The only key that can update or delete the site. */
  token: string; bearerToken: string; showToHuman: string; response: Record<string, unknown>;
}
export interface RenderInput {
  config: any; data: any; title?: string; lang?: string; head?: string; css?: string;
  stylesheets?: string[]; resolve?: boolean; extraFiles?: Record<string, string | { base64: string }>; metadata?: Record<string, unknown>;
}
export interface PublishInput extends RenderInput { slug?: string; token?: string; origin?: string; partner?: string; client?: string; }
export function renderPuckToFiles(input: RenderInput): Promise<Record<string, string>>;
export function publishPuck(input: PublishInput, deps?: { fetch?: typeof fetch }): Promise<PublishResult>;
export function deedPageOnPublish(opts: Omit<PublishInput, "data"> & {
  remember?: boolean; storageKey?: string;
  onPublished?: (result: PublishResult) => void; onError?: (error: Error) => void;
}): (data: any) => Promise<PublishResult | undefined>;
export function publishWebsite(input: any, deps?: { fetch?: typeof fetch }): Promise<PublishResult>;
export function partnerRef(raw: unknown): { partner: string; ref: string };
export class PartnerPublishError extends Error { status: number; code: string; extra?: Record<string, unknown>; }
