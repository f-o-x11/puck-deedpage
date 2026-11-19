import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderPuckToFiles, publishPuck, deedPageOnPublish } from "../src/index.js";

const config = {
  root: { fields: { title: { type: "text" } } },
  components: {
    Heading: { fields: { text: { type: "text" } }, render: ({ text }) => createElement("h1", { className: "hero" }, text) },
    Upper: {
      fields: { text: { type: "text" } },
      resolveData: async ({ props }) => ({ props: { ...props, text: String(props.text).toUpperCase() } }),
      render: ({ text }) => createElement("p", null, text),
    },
  },
};
const data = {
  root: { props: { title: "Puck <page>" } },
  content: [
    { type: "Heading", props: { id: "Heading-1", text: "Hello Puck" } },
    { type: "Upper", props: { id: "Upper-1", text: "resolved" } },
  ],
};

function fakeFetch() {
  const calls = [];
  const fn = async (url, init) => {
    const u = new URL(url);
    calls.push({ path: u.pathname + u.search, headers: init.headers, body: JSON.parse(init.body) });
    const auth = init.headers.authorization;
    const slug = u.searchParams.get("slug") || "auto-1";
    return new Response(JSON.stringify({ ok: true, url: `https://${slug}.deed.page/`, slug, version: auth ? "v2" : "v1", ...(auth ? {} : { token: "deed_tok_T" }) }));
  };
  return { fn, calls };
}

test("renders static HTML with root title and resolveData", async () => {
  const files = await renderPuckToFiles({ config, data, css: ".hero{color:red}" });
  assert.match(files["index.html"], /<title>Puck &lt;page&gt;<\/title>/);
  assert.match(files["index.html"], /<h1 class="hero">Hello Puck<\/h1>/);
  assert.match(files["index.html"], /<p>RESOLVED<\/p>/);
  assert.match(files["index.html"], /href="style.css"/);
  assert.equal(files["style.css"], ".hero{color:red}");
});

test("publishPuck tags ref=partner_puck", async () => {
  const { fn, calls } = fakeFetch();
  const res = await publishPuck({ config, data, slug: "puck-x" }, { fetch: fn });
  assert.equal(res.url, "https://puck-x.deed.page/");
  assert.equal(calls[0].path, "/v1/sites?slug=puck-x&ref=partner_puck");
  assert.equal(calls[0].headers["x-client"], "puck-deedpage");
});

test("onPublish remembers the minted token and republishes", async () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const { fn, calls } = fakeFetch();
  const orig = globalThis.fetch;
  globalThis.fetch = fn;
  try {
    const seen = [];
    const onPublish = deedPageOnPublish({ config, slug: "puck-y", onPublished: (r) => seen.push(r) });
    await onPublish(data);
    await onPublish(data);
    assert.equal(calls[0].headers.authorization, undefined);
    assert.equal(calls[1].headers.authorization, "Bearer deed_tok_T");
    assert.deepEqual(seen.map((r) => r.version), ["v1", "v2"]);
  } finally {
    globalThis.fetch = orig;
    delete globalThis.localStorage;
  }
});

test("onError receives failures", async () => {
  const errs = [];
  const onPublish = deedPageOnPublish({ config, slug: "puck-z", remember: false, onError: (e) => errs.push(e) });
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, code: "quota_sites", message: "Limit" }), { status: 403 });
  try {
    await onPublish(data);
  } finally {
    globalThis.fetch = orig;
  }
  assert.equal(errs[0].code, "quota_sites");
});
