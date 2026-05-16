import * as fs from "fs";
import * as path from "path";

type GitHubAsset = {
  id: number;
  name: string;
};

type GitHubRelease = {
  id: number;
  assets?: GitHubAsset[];
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value == null || value.trim() === "" ? fallback : value;
}

async function githubRequest<T>(
  url: string,
  init: RequestInit & { expectedStatuses?: readonly number[] } = {},
): Promise<{ status: number; value?: T }> {
  const expectedStatuses = init.expectedStatuses ?? [200, 201, 204];
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${requiredEnv("GH_TOKEN")}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`GitHub API request failed: ${init.method ?? "GET"} ${url} -> ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  if (response.status === 204) {
    return { status: response.status };
  }
  return { status: response.status, value: await response.json() as T };
}

async function fetchRelease(repository: string, tag: string): Promise<GitHubRelease | undefined> {
  const result = await githubRequest<GitHubRelease>(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    { expectedStatuses: [200, 404] },
  );
  return result.status === 404 ? undefined : result.value;
}

async function createRelease(repository: string, tag: string, title: string, target: string): Promise<GitHubRelease> {
  const result = await githubRequest<GitHubRelease>(`https://api.github.com/repos/${repository}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tag,
      target_commitish: target,
      name: title,
      body: "Windows ARM64 primary runtime feed for Codex workspace dependencies.",
      make_latest: "false",
    }),
  });
  if (result.value == null) {
    throw new Error(`GitHub did not return a release for ${tag}.`);
  }
  return result.value;
}

async function markReleaseNotLatest(repository: string, releaseId: number): Promise<void> {
  await githubRequest<GitHubRelease>(`https://api.github.com/repos/${repository}/releases/${releaseId}`, {
    method: "PATCH",
    body: JSON.stringify({ make_latest: "false" }),
  });
}

async function deleteAsset(repository: string, asset: GitHubAsset): Promise<void> {
  await githubRequest<void>(`https://api.github.com/repos/${repository}/releases/assets/${asset.id}`, {
    method: "DELETE",
  });
}

async function uploadAsset(repository: string, releaseId: number, filePath: string): Promise<void> {
  const name = path.basename(filePath);
  const body = await fs.promises.readFile(filePath);
  await githubRequest<GitHubAsset>(
    `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: body as never,
    },
  );
}

async function main(): Promise<void> {
  const repository = requiredEnv("GITHUB_REPOSITORY");
  const releaseTag = optionalEnv("RELEASE_TAG", "codex-primary-runtime-win32-arm64");
  const releaseTitle = optionalEnv("RELEASE_TITLE", "codex-primary-runtime win32-arm64");
  const targetSha = requiredEnv("GITHUB_SHA");
  const assetRoot = path.resolve(optionalEnv("PRIMARY_RUNTIME_ASSET_ROOT", path.join("out", "primary-runtime", "win32-arm64")));
  const files = (await fs.promises.readdir(assetRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(assetRoot, entry.name));
  const latestManifest = files.find((file) => path.basename(file) === "LATEST.json");
  const archives = files.filter((file) => path.basename(file) !== "LATEST.json");

  if (latestManifest == null || archives.length < 1) {
    throw new Error(`Expected LATEST.json and a runtime archive in ${assetRoot}.`);
  }

  let release = await fetchRelease(repository, releaseTag);
  if (release == null) {
    release = await createRelease(repository, releaseTag, releaseTitle, targetSha);
  } else {
    await markReleaseNotLatest(repository, release.id);
  }

  const uploadNames = new Set([...archives.map((archive) => path.basename(archive)), path.basename(latestManifest)]);
  for (const asset of release.assets ?? []) {
    if (uploadNames.has(asset.name)) {
      await deleteAsset(repository, asset);
    }
  }

  for (const archive of archives) {
    await uploadAsset(repository, release.id, archive);
  }
  await uploadAsset(repository, release.id, latestManifest);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
