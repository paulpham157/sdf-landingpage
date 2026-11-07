import { site } from "../data/site";

export interface Crumb {
  name: string;
  href: string;
}

export function absolute(path: string) {
  return new URL(path, site.url).href;
}

export function webPage(opts: { title: string; description: string; path: string }) {
  return {
    "@type": "WebPage",
    name: opts.title,
    description: opts.description,
    url: absolute(opts.path),
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: site.name,
      url: `${site.url}/`,
    },
  };
}

export function faqPage(faqs: readonly { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function breadcrumbList(items: readonly Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absolute(item.href),
    })),
  };
}

export function graph(...nodes: unknown[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

function schemaNodes(value: object | undefined): Record<string, unknown>[] {
  if (!value) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record["@graph"])) return record["@graph"] as Record<string, unknown>[];
  const { "@context": _context, ...rest } = record;
  return [rest];
}

/** Object BaseLayout serializes into the JSON-LD script. */
export function pageJsonLd(jsonLd: object | undefined, breadcrumbs: readonly Crumb[] = []) {
  const structured = [
    ...schemaNodes(jsonLd),
    ...(breadcrumbs.length ? [breadcrumbList(breadcrumbs)] : []),
  ];
  if (!structured.length) return undefined;
  return { "@context": "https://schema.org", "@graph": structured };
}

/**
 * JSON for `set:html` inside `<script type="application/ld+json">`.
 * `<` becomes the JSON escape `\u003c` so the HTML parser cannot close the script.
 */
export function jsonLdHtml(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
