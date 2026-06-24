export type CodexAppcastFeed = "prod";

export const codexAppcastUrls: Record<CodexAppcastFeed, string> = {
  prod: "https://persistent.oaistatic.com/codex-app-prod/appcast.xml",
};

export function codexAppcastUrlForFeed(feed: CodexAppcastFeed): string {
  return codexAppcastUrls[feed];
}
