/**
 * publishWebsite(): publish or republish a static site on deed.page.
 *
 * The bearer token in the result is the owner's key. Show `showToHuman` to the
 * human in full. This module never redacts that token, and it never calls
 * checkout or any other billing route.
 *
 * No dependencies. Copy this file, or import it:
 *   import { publishWebsite } from "./publish-website.js";
 *
 * Works in browsers (deed.page allows CORS) and in Node 18+.
 */

const ENV = typeof process !== "undefined" && process && process.env ? process.env : {};

const PARTNER_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,39})$/;
const PUBLISH_PATH = "/v1/sites";

export class PartnerPublishError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [extra]
   */
  constructor(status, code, message, extra) {
    super(message);
    this.name = "PartnerPublishError";
    this.status = status;
    this.code = code;
    if (extra) this.extra = extra;
  }
}

/**
 * `partner` or `DEED_PARTNER` becomes `ref=partner_<slug>`.
 * Letters and digits only, hyphens allowed in the middle, at most 40 characters.
 * @param {unknown} raw
 * @returns {{ partner: string, ref: string }}
 */
export function partnerRef(raw) {
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!PARTNER_SLUG.test(slug)) {
    throw new PartnerPublishError(
      400,
      "bad_partner",
      "Set partner (or DEED_PARTNER) to a short slug such as acme. Publishes are tagged ref=partner_<slug>.",
    );
  }
  return { partner: slug, ref: `partner_${slug}` };
}

/**
 * @param {object} input
 * @param {Record<string, string | { base64: string }>} input.files Path to text or { base64 }.
 * @param {string} [input.slug] Omit on the first publish to let deed.page pick one. Required to republish.
 * @param {string} [input.token] Owner bearer token. Omit on the first publish. Required to republish.
 * @param {string} [input.partner] Partner slug. Falls back to DEED_PARTNER.
 * @param {string} [input.origin] API origin. Falls back to DEED_PAGE_URL, then https://deed.page.
 * @param {string} [input.client] X-Client label. Default partner-<slug>.
 * @param {boolean} [input.spa]
 * @param {string} [input.idempotencyKey]
 * @param {{ fetch?: typeof fetch }} [deps]
 */
export async function publishWebsite(input = {}, deps = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PartnerPublishError(400, "bad_request", "Pass { files } to publishWebsite.");
  }
  const files = input.files;
  if (!files || typeof files !== "object" || Array.isArray(files) || Object.keys(files).length === 0) {
    throw new PartnerPublishError(400, "bad_request", "files must be a non-empty map of path to text or { base64 }.");
  }
  const { partner, ref } = partnerRef(input.partner ?? ENV.DEED_PARTNER);
  const origin = String(input.origin || ENV.DEED_PAGE_URL || "https://deed.page").replace(/\/+$/, "");
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new PartnerPublishError(500, "no_fetch", "No fetch implementation. Pass deps.fetch or run on Node 18+.");
  }

  const url = new URL(PUBLISH_PATH, `${origin}/`);
  if (url.pathname !== PUBLISH_PATH) {
    throw new PartnerPublishError(500, "partner_scope", "publishWebsite only calls POST /v1/sites. It does not start checkout.");
  }
  if (input.slug != null && String(input.slug) !== "") url.searchParams.set("slug", String(input.slug));
  url.searchParams.set("ref", ref);

  /** @type {Record<string, string>} */
  const headers = {
    "content-type": "application/json",
    accept: "application/json",
    "x-client": input.client || `partner-${partner}`,
  };
  if (input.token) headers.authorization = `Bearer ${input.token}`;
  if (input.idempotencyKey) headers["idempotency-key"] = String(input.idempotencyKey);
  if (input.spa) headers["x-spa"] = "1";

  /** @type {Record<string, unknown>} */
  const payload = { files };
  if (input.slug != null && String(input.slug) !== "") payload.slug = String(input.slug);

  const res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await res.text();
  /** @type {Record<string, any>} */
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new PartnerPublishError(res.status || 502, "bad_response", "deed.page did not return JSON.", {
      body: text.slice(0, 500),
    });
  }
  if (!res.ok || parsed.ok === false) {
    throw new PartnerPublishError(res.status || 502, parsed.code || "publish_failed", parsed.message || "Publish failed.", parsed);
  }

  const minted = typeof parsed.token === "string" && parsed.token ? parsed.token : null;
  const token = minted || (input.token ? String(input.token) : null);
  if (!token) {
    throw new PartnerPublishError(
      500,
      "token_missing",
      "The publish did not return a bearer token. Show the raw response to the human. Do not hide it.",
      { response: parsed },
    );
  }

  const liveUrl = String(parsed.url || "");
  const showToHuman = [
    `Live URL: ${liveUrl}`,
    `Bearer token (save this; shown in full, not hidden): ${token}`,
    `Recovery is optional and is not required to publish. Attach an address later with POST ${origin}/v1/recovery/email and Authorization: Bearer ${token}.`,
    "Without a recovery email, a lost token cannot be restored. The site stays online. Publish under a new slug if you still have the files.",
    `This adapter does not start checkout. To change plan, open ${origin}/account and paste the token.`,
  ].join("\n");

  return {
    ok: true,
    url: liveUrl,
    path_url: parsed.path_url ?? liveUrl,
    slug: parsed.slug,
    version: parsed.version,
    republished: Boolean(input.token),
    created: !input.token,
    ref,
    partner,
    token,
    bearerToken: token,
    showToHuman,
    recovery: {
      optional: true,
      attach: `${origin}/v1/recovery/email`,
      request: `${origin}/v1/recovery`,
      note: "Email is never required to publish. A token with no recovery email has no recovery path. We store only the SHA-256 of a token and of a recovery address.",
    },
    response: parsed,
  };
}
