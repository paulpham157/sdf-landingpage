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
