/** Shared with the fixture page and the checker. Not a site route. */
export const probe = "JSONLD_ESCAPE_PROBE";

export const attack = {
  close: "</script><script>alert(1)</script>",
  comment: "<!--",
  mixed: "</ScRiPt>",
  nested: {
    items: ["</SCRIPT><!--", { note: "a < b" }],
  },
  probe,
};

export const breadcrumbs = [
  { name: attack.mixed, href: "/jsonld-escape-check" },
  { name: attack.nested.items[0], href: "/jsonld-escape-check" },
];
