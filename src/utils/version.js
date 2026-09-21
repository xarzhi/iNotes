import manifest from "../../version.json";

// 版本号的唯一来源就是项目根目录的 version.json。
// 检查更新时读的是仓库里同一个文件
export const CURRENT_VERSION = manifest.version;

export const REPO_URL = "https://github.com/xarzhi/iNotes";

const BRANCH = "main";
const REPO_PATH = "xarzhi/iNotes";

// 依次尝试，任何一个拿到就算成功。
// 不用 raw.githubusercontent.com 打头是因为它在国内网络经常连不上（会一直挂到超时），
// 所以放最后兜底
const SOURCES = [
  {
    name: "jsDelivr",
    url: `https://cdn.jsdelivr.net/gh/${REPO_PATH}@${BRANCH}/version.json`,
    read: (response) => response.json(),
  },
  {
    name: "GitHub API",
    url: `https://api.github.com/repos/${REPO_PATH}/contents/version.json`,
    read: async (response) => {
      // 这个接口返回的是 base64 编码的文件内容
      const data = await response.json();
      return JSON.parse(atob(String(data.content ?? "").replace(/\s/g, "")));
    },
  },
  {
    name: "GitHub Raw",
    url: `https://raw.githubusercontent.com/${REPO_PATH}/${BRANCH}/version.json`,
    read: (response) => response.json(),
  },
];

// 每个源单独限时，避免某个源卡住导致按钮一直停在“检查中”
const TIMEOUT_MS = 5000;

// 语义化版本比较：a 比 b 新返回正数
export function compareVersions(a, b) {
  const left = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const right = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchFrom(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await source.read(response);
    if (!data?.version) throw new Error("没有 version 字段");
    return String(data.version);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLatestVersion() {
  const failures = [];

  for (const source of SOURCES) {
    try {
      return await fetchFrom(source);
    } catch (e) {
      const reason = e.name === "AbortError" ? "超时" : e.message;
      failures.push(`${source.name} ${reason}`);
    }
  }

  const error = new Error(`获取版本失败：${failures[0]}`);
  error.details = failures; // 详细信息留给控制台
  throw error;
}

// 返回 { hasUpdate, latest }
export async function checkForUpdate() {
  const latest = await fetchLatestVersion();
  return {
    latest,
    hasUpdate: compareVersions(latest, CURRENT_VERSION) > 0,
  };
}
