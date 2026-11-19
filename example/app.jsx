import React from "react";
import { createRoot } from "react-dom/client";
import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { deedPageOnPublish } from "puck-deedpage";

const config = {
  root: { fields: { title: { type: "text" } } },
  components: {
    Heading: { fields: { text: { type: "text" } }, defaultProps: { text: "Heading" }, render: ({ text }) => <h1 style={{ color: "teal" }}>{text}</h1> },
    Paragraph: { fields: { text: { type: "textarea" } }, defaultProps: { text: "Text" }, render: ({ text }) => <p>{text}</p> },
  },
};

const initialData = {
  root: { props: { title: "My Puck page" } },
  content: [
    { type: "Heading", props: { id: "Heading-1", text: "Hello from Puck" } },
    { type: "Paragraph", props: { id: "Paragraph-1", text: "Published with puck-deedpage." } },
  ],
};

const onPublish = deedPageOnPublish({
  config,
  slug: new URLSearchParams(location.search).get("slug") || undefined,
  onPublished: ({ url, created, token }) => {
    window.lastPublish = { url };
    alert(created ? `Live at ${url}\n\nSave your owner token:\n${token}` : `Updated ${url}`);
  },
});

createRoot(document.getElementById("root")).render(<Puck config={config} data={initialData} onPublish={onPublish} />);
