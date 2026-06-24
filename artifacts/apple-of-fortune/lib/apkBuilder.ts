import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Self-service APK builder.
 *
 * The mobile app talks directly to the GitHub REST API using a Personal Access
 * Token the user pastes once (stored on-device). Committing a new app name and
 * icon to `artifacts/apple-of-fortune/**` on the default branch auto-triggers
 * the existing GitHub Actions workflow, which builds a signed APK and publishes
 * it as a Release asset. We then poll the workflow run and surface the download
 * link.
 */

export const GH_OWNER = "arizonbet-sudo";
export const GH_REPO = "apple-of-fortune";
export const GH_BRANCH = "main";

const APP_DIR = "artifacts/apple-of-fortune";
const APP_JSON_PATH = `${APP_DIR}/app.json`;
const ICON_PATH = `${APP_DIR}/assets/images/icon.png`;
const ADAPTIVE_ICON_PATH = `${APP_DIR}/assets/images/adaptive-icon.png`;

const TOKEN_KEY = "apple-of-fortune:gh-token:v1";
const LAST_BUILD_KEY = "apple-of-fortune:last-build:v1";

const API = "https://api.github.com";

export type LastBuild = {
  commitSha: string;
  appName: string;
  startedAt: number;
};

export type BuildStatusResult = {
  found: boolean;
  status: "queued" | "in_progress" | "completed" | "unknown";
  conclusion: string | null;
  htmlUrl: string | null;
  runNumber: number | null;
};

const WORKFLOW_NAME = "Build Android APK";
const WORKFLOW_PATH = ".github/workflows/build-android-apk.yml";

/* ----------------------------- token storage ----------------------------- */

export async function loadToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token.trim());
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function loadLastBuild(): Promise<LastBuild | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_BUILD_KEY);
    return raw ? (JSON.parse(raw) as LastBuild) : null;
  } catch {
    return null;
  }
}

async function saveLastBuild(value: LastBuild): Promise<void> {
  await AsyncStorage.setItem(LAST_BUILD_KEY, JSON.stringify(value));
}

export async function clearLastBuild(): Promise<void> {
  await AsyncStorage.removeItem(LAST_BUILD_KEY);
}

/* ------------------------------ http helper ------------------------------ */

function headers(token: string, accept = "application/vnd.github+json") {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh(
  token: string,
  path: string,
  init?: RequestInit & { rawAccept?: string },
): Promise<any> {
  const accept = init?.rawAccept ?? "application/vnd.github+json";
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(token, accept), ...(init?.headers ?? {}) },
  });
  if (accept === "application/vnd.github.raw") {
    if (!res.ok) throw new Error(await describeError(res));
    return res.text();
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(json?.message || `GitHub request failed (${res.status})`);
  }
  return json;
}

async function describeError(res: Response): Promise<string> {
  try {
    const j = JSON.parse(await res.text());
    return j?.message || `GitHub request failed (${res.status})`;
  } catch {
    return `GitHub request failed (${res.status})`;
  }
}

/* ------------------------------- token test ------------------------------ */

export async function verifyToken(token: string): Promise<void> {
  // Throws with a clear message if the token cannot access the repo.
  await gh(token, `/repos/${GH_OWNER}/${GH_REPO}`);
}

/* ------------------------------ trigger build ---------------------------- */

export type TriggerArgs = {
  token: string;
  appName: string;
  /** base64-encoded PNG/JPEG for the launcher icon (no data: prefix). */
  imageBase64?: string | null;
};

/**
 * Commits the new app name and/or icon in a single commit and returns the new
 * commit SHA. The commit triggers the GitHub Actions build automatically.
 */
export async function triggerBuild({
  token,
  appName,
  imageBase64,
}: TriggerArgs): Promise<string> {
  const name = appName.trim();
  if (!name && !imageBase64) {
    throw new Error("Enter a new app name or choose a new icon first.");
  }

  // 1. Current branch tip + base tree.
  const ref = await gh(
    token,
    `/repos/${GH_OWNER}/${GH_REPO}/git/ref/heads/${GH_BRANCH}`,
  );
  const baseCommitSha: string = ref.object.sha;
  const baseCommit = await gh(
    token,
    `/repos/${GH_OWNER}/${GH_REPO}/git/commits/${baseCommitSha}`,
  );
  const baseTreeSha: string = baseCommit.tree.sha;

  const treeEntries: {
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }[] = [];

  // 2. app.json (launcher name) — only when a name was provided.
  if (name) {
    const raw: string = await gh(
      token,
      `/repos/${GH_OWNER}/${GH_REPO}/contents/${APP_JSON_PATH}?ref=${GH_BRANCH}`,
      { rawAccept: "application/vnd.github.raw" },
    );
    const config = JSON.parse(raw);
    config.expo = config.expo ?? {};
    config.expo.name = name;
    const blob = await gh(token, `/repos/${GH_OWNER}/${GH_REPO}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: JSON.stringify(config, null, 2) + "\n",
        encoding: "utf-8",
      }),
    });
    treeEntries.push({
      path: APP_JSON_PATH,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // 3. icon + adaptive icon — only when a new image was chosen.
  if (imageBase64) {
    const blob = await gh(token, `/repos/${GH_OWNER}/${GH_REPO}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: imageBase64, encoding: "base64" }),
    });
    treeEntries.push({
      path: ICON_PATH,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
    treeEntries.push({
      path: ADAPTIVE_ICON_PATH,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // 4. New tree, commit, and move the branch.
  const tree = await gh(token, `/repos/${GH_OWNER}/${GH_REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  const message = name
    ? `App identity: set name to "${name}"${imageBase64 ? " + new icon" : ""}`
    : "App identity: update icon";

  const commit = await gh(token, `/repos/${GH_OWNER}/${GH_REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseCommitSha],
    }),
  });

  await gh(
    token,
    `/repos/${GH_OWNER}/${GH_REPO}/git/refs/heads/${GH_BRANCH}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    },
  );

  await saveLastBuild({
    commitSha: commit.sha,
    appName: name,
    startedAt: Date.now(),
  });

  return commit.sha;
}

/* ------------------------------ build status ----------------------------- */

export async function getBuildStatus(
  token: string,
  commitSha: string,
): Promise<BuildStatusResult> {
  const data = await gh(
    token,
    `/repos/${GH_OWNER}/${GH_REPO}/actions/runs?head_sha=${commitSha}&per_page=20`,
  );
  const runs: any[] = data.workflow_runs ?? [];
  // Only consider the APK workflow — other workflows may run on the same commit.
  const apkRuns = runs.filter(
    (r) => r.path === WORKFLOW_PATH || r.name === WORKFLOW_NAME,
  );
  const run = (apkRuns.length ? apkRuns : runs)[0];
  if (!run) {
    return {
      found: false,
      status: "queued",
      conclusion: null,
      htmlUrl: null,
      runNumber: null,
    };
  }
  return {
    found: true,
    status: run.status as BuildStatusResult["status"],
    conclusion: run.conclusion ?? null,
    htmlUrl: run.html_url ?? null,
    runNumber: typeof run.run_number === "number" ? run.run_number : null,
  };
}

/** Deterministic download URL for the APK produced by a given run number. */
export function apkUrlForRun(runNumber: number): string {
  return `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/apk-build-${runNumber}/app-release.apk`;
}

/* ------------------------------ latest APK ------------------------------- */

export async function getLatestApkUrl(token: string): Promise<string | null> {
  try {
    const release = await gh(
      token,
      `/repos/${GH_OWNER}/${GH_REPO}/releases/latest`,
    );
    const asset = (release.assets ?? []).find((a: any) =>
      String(a.name).toLowerCase().endsWith(".apk"),
    );
    return asset?.browser_download_url ?? release.html_url ?? null;
  } catch {
    return null;
  }
}

export const RELEASES_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/releases`;
export const ACTIONS_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/actions`;
export const TOKEN_CREATE_URL = `https://github.com/settings/personal-access-tokens/new`;
