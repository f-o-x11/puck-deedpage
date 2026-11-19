/**
 * puck-deedpage: publish a Puck page to https://<slug>.deed.page/.
 *
 *   <Puck config={config} data={data} onPublish={deedPageOnPublish({ config, slug: "my-page" })} />
 *
 * The page is rendered to static HTML with Puck's <Render> and react-dom/server,
 * then sent to deed.page. Works in the browser (deed.page allows CORS) and in Node 18+.
 * deed.page is operated by Avatar 8 LLC (ops@avatar33.com). MIT license.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import { publishWebsite, partnerRef, PartnerPublishError } from "./publish-website.js";

export { publishWebsite, partnerRef, PartnerPublishError };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Render Puck data to a deed.page file map: index.html (+ style.css when css is given).
 * @param {{config:object, data:object, title?:string, lang?:string, head?:string, css?:string, stylesheets?:string[], resolve?:boolean, extraFiles?:object, metadata?:object}} input
 */
export async function renderPuckToFiles({ config, data, title, lang = "en", head = "", css, stylesheets = [], resolve = true, extraFiles, metadata } = {}) {
  if (!config || !data) throw new Error("renderPuckToFiles needs { config, data }.");
  const resolved = resolve ? await resolveAllData(data, config, metadata) : data;
  const body = renderToStaticMarkup(createElement(Render, { config, data: resolved, metadata }));
  const pageTitle = title ?? resolved?.root?.props?.title ?? "Untitled";
  const links = [...(css ? ["style.css"] : []), ...stylesheets].map((href) => `<link rel="stylesheet" href="${esc(href)}">`).join("\n");
  const index = `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
${links}
${head}
</head>
<body>
${body}
</body>
</html>
`;
  const files = { "index.html": index };
  if (css) files["style.css"] = String(css);
  if (extraFiles && typeof extraFiles === "object") for (const [p, c] of Object.entries(extraFiles)) if (!(p in files)) files[p] = c;
  return files;
}

/** Render and publish in one call. Returns publishWebsite()'s result (url, slug, version, token, showToHuman). */
export async function publishPuck(input = {}, deps = {}) {
  const files = await renderPuckToFiles(input);
  return publishWebsite(
    { files, partner: input.partner || "puck", slug: input.slug, token: input.token, origin: input.origin, client: input.client || "puck-deedpage" },
    deps,
  );
}

function store(key) {
  const ls = typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null;
  return {
    get: () => {
      try {
        return ls ? JSON.parse(ls.getItem(key) || "null") : null;
      } catch {
        return null;
      }
    },
    set: (v) => {
      try {
        ls && ls.setItem(key, JSON.stringify(v));
      } catch {}
    },
  };
}

/**
 * Build an onPublish handler for <Puck>. First publish mints a token; it is passed to
 * onPublished and (by default) remembered in localStorage so the next publish updates the same site.
 * @param {object} opts config (required), slug, token, title, css, stylesheets, head, origin, partner,
 *   remember (default true), storageKey, onPublished(result), onError(error)
 */
export function deedPageOnPublish(opts = {}) {
  if (!opts.config) throw new Error("deedPageOnPublish needs your Puck config.");
  const mem = store(opts.storageKey || "puck-deedpage");
  const remember = opts.remember !== false;
  return async function onPublish(data) {
    const saved = remember ? mem.get() : null;
    const slug = opts.slug ?? (saved && saved.slug) ?? undefined;
    const token = opts.token ?? (saved && saved.slug === slug ? saved.token : undefined);
    try {
      const res = await publishPuck({ ...opts, data, slug, token });
      if (remember) mem.set({ slug: res.slug, token: res.token });
      if (opts.onPublished) opts.onPublished(res);
      return res;
    } catch (err) {
      if (opts.onError) opts.onError(err);
      else throw err;
    }
  };
}
