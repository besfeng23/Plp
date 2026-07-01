const REPO_OWNER = 'besfeng23';
const REPO_NAME = 'Plp';
const API_BASE = 'https://api.github.com';

function headers() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'plp-telegram-command-bot',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubFetch(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: headers() });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `GitHub request failed with status ${response.status}`);
  return data;
}

export async function getOpenPullRequests() {
  const pulls = await githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=open&sort=updated&direction=desc&per_page=20`);
  return pulls.map((pr) => ({ number: pr.number, title: pr.title, state: pr.state, draft: Boolean(pr.draft), mergeable: pr.mergeable, updated_at: pr.updated_at, html_url: pr.html_url }));
}

export async function getPullRequest(number) {
  const pr = await githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${encodeURIComponent(number)}`);
  return { number: pr.number, title: pr.title, state: pr.state, draft: Boolean(pr.draft), mergeable: pr.mergeable, mergeable_state: pr.mergeable_state, updated_at: pr.updated_at, html_url: pr.html_url };
}
