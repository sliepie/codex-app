export type CodexAppcastFeed = "prod" | "beta";

export const codexAppcastUrls: Record<CodexAppcastFeed, string> = {
  prod: "https://persistent.oaistatic.com/codex-app-prod/appcast.xml",
  beta: "https://persistent.oaistatic.com/codex-app-beta/appcast.xml",
};

export function codexAppcastUrlForFeed(feed: CodexAppcastFeed): string {
  return codexAppcastUrls[feed];
}

export function parseCodexAppcastFeed(
  value: string | undefined,
  fallback: CodexAppcastFeed = "prod",
): CodexAppcastFeed {
  const feed = value?.trim() || fallback;
  if (feed === "prod" || feed === "beta") {
    return feed;
  }

  throw new Error(`Unsupported Codex appcast feed: ${feed}`);
}
