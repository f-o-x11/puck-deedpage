# puck-deedpage

`onPublish` helper for [Puck](https://puckeditor.com): renders the page to static HTML with Puck's `<Render>` and publishes it to a permanent `https://<slug>.deed.page/` URL. Works straight from the browser; no backend needed.

[deed.page](https://deed.page/?ref=partner_puck) is static hosting operated by Avatar 8 LLC.

## Install

```sh
npm i puck-deedpage
```

Peer dependencies: `@puckeditor/core`, `react`, `react-dom`.

## Example

```jsx
import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { deedPageOnPublish } from "puck-deedpage";

const onPublish = deedPageOnPublish({
  config,
  slug: "my-puck-page",
  css: ".hero { color: teal }",
  onPublished: ({ url, created, token }) => {
    alert(created ? `Live at ${url}. Save your owner token: ${token}` : `Updated ${url}`);
  },
});

export default function Editor() {
  return <Puck config={config} data={initialData} onPublish={onPublish} />;
}
```

The first publish creates an owner token and returns it once. By default the slug and token are kept in `localStorage`, so the next **Publish** click updates the same site. A full example is in [`example/app.jsx`](example/app.jsx): run `npm install && npm run example`, then serve the folder and open `example/index.html`.

On a server (Next.js route, script, CI):

```js
import { publishPuck } from "puck-deedpage";
const { url } = await publishPuck({ config, data, slug: "my-puck-page", token: process.env.DEED_PAGE_TOKEN });
```

## API

- `deedPageOnPublish(options)` returns `async (data) => result` for `<Puck onPublish>`.
- `publishPuck({ config, data, slug, token, ... })` renders and publishes.
- `renderPuckToFiles({ config, data, title, css, stylesheets, head, lang, resolve })` returns `{ "index.html", "style.css"? }` without publishing.

Options: `slug`, `token`, `title` (default `data.root.props.title`), `css` (written to `style.css`), `stylesheets` (extra `<link>` URLs), `head`, `lang`, `resolve` (run `resolveAllData`, default `true`), `remember`, `storageKey`, `onPublished`, `onError`, `partner` (attribution, default `puck`, sent as `ref=partner_puck`).

Output is static HTML: components render once, and client-side interactivity is not hydrated. Component styles must come from `css` or `stylesheets`.

The token is the only key that can update or delete the site. If many people use your editor, give each their own token or publish from your server. API docs: https://deed.page/docs.

## Support

ops@avatar33.com. MIT license, Avatar 8 LLC. Not affiliated with the Puck project.
