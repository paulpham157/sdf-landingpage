const xHosts = new Set(["x.com", "twitter.com", "mobile.twitter.com"]);

export interface CitationInput {
  platform: string;
  author: string;
  handle?: string;
  date?: string | Date;
  url: string;
  sample?: boolean;
}

export interface CitationView {
  platformLabel: string;
  author: string;
  handle?: string;
  href: string;
  host: string;
  dateTime?: string;
  dateLabel?: string;
  sample: boolean;
}

function hostOf(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Turn citation props into a view model. Throws at build time when the
 * permalink is missing or the platform label would misidentify the host.
 * There is no oEmbed call: the card always renders the quote, the author,
 * and the link.
 */
export function resolveCitation(input: CitationInput): CitationView {
  const author = input.author?.trim() ?? "";
  if (!author) {
    throw new Error("A social citation needs an author.");
  }

  const rawUrl = input.url?.trim() ?? "";
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Citation permalink is not a URL: ${rawUrl || "(empty)"}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Citation permalink must be http or https: ${rawUrl}`);
  }

  const platform = input.platform.trim().toLowerCase();
  const host = hostOf(parsed);
  let platformLabel: string;

  if (platform === "x" || platform === "twitter") {
    platformLabel = "X";
    if (!xHosts.has(host)) {
      throw new Error(`An X citation must link to x.com or twitter.com, not ${parsed.hostname}.`);
    }
  } else if (platform === "linkedin") {
    platformLabel = "LinkedIn";
    if (host !== "linkedin.com") {
      throw new Error(`A LinkedIn citation must link to linkedin.com, not ${parsed.hostname}.`);
    }
  } else if (platform === "generic" || platform === "web" || platform === "url" || platform === "") {
    platformLabel = host;
  } else {
    platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  }

  const handle = input.handle?.trim().replace(/^@/, "") || undefined;

  let dateTime: string | undefined;
  let dateLabel: string | undefined;
  if (input.date) {
    const raw =
      input.date instanceof Date
        ? input.date
        : new Date(input.date.length === 10 ? `${input.date}T00:00:00Z` : input.date);
    if (Number.isNaN(raw.valueOf())) {
      throw new Error(`Citation date is not a date: ${String(input.date)}`);
    }
    dateTime = raw.toISOString();
    dateLabel = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(raw);
  }

  return {
    platformLabel,
    author,
    handle,
    href: parsed.href,
    host: parsed.hostname,
    dateTime,
    dateLabel,
    sample: Boolean(input.sample),
  };
}
