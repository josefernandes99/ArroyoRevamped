export function parseInstagramNumber(str: string): number {
  const normalized = str.toLowerCase().trim();
  if (/[mk]$/.test(normalized)) {
    const numStr = normalized
      .slice(0, -1)
      .replace(/[,]/g, '.')
      .replace(/[^0-9.]/g, '');
    const num = parseFloat(numStr);
    const multiplier = normalized.endsWith('m') ? 1_000_000 : 1_000;
    return Math.round(num * multiplier);
  }
  return parseInt(normalized.replace(/[.,]/g, ''), 10);
}

export async function scrapeFollowerCounts(
  username: string,
): Promise<{ followers: number; following: number } | null> {
  console.log(`scrapeFollowerCounts: fetching ${username}`);
  try {
    const res = await fetch(`/${username}/`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`http ${res.status}`);
    }
    const html = await res.text();

    // try to parse counts from embedded JSON first (language independent)
    const followMatch = html.match(/"edge_followed_by"\s*:\s*\{"count"\s*:\s*(\d+)/);
    const followingMatch = html.match(/"edge_follow"\s*:\s*\{"count"\s*:\s*(\d+)/);
    console.log('scrapeFollowerCounts: json matches', {
      followMatch,
      followingMatch,
    });
    if (followMatch && followingMatch) {
      const followers = parseInt(followMatch[1], 10);
      const following = parseInt(followingMatch[1], 10);
      console.log(`scrapeFollowerCounts: scraped ${username} via JSON`, {
        followers,
        following,
      });
      return { followers, following };
    }

    // fallback to meta description parsing (may vary by locale)
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const desc =
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content');
    if (!desc) throw new Error('description not found');
    const match = desc.match(/([\d.,MK]+)\s*(?:followers|seguidores).*?(?:following|a seguir)\s*([\d.,MK]+)/i);
    if (!match) {
      console.error('scrapeFollowerCounts: description regex mismatch', desc);
      throw new Error('regex mismatch');
    }
    const followers = parseInstagramNumber(match[1]);
    const following = parseInstagramNumber(match[2]);
    console.log(`scrapeFollowerCounts: scraped ${username} via meta`, {
      followers,
      following,
    });
    return { followers, following };
  } catch (err) {
    console.error(`scrapeFollowerCounts: error for ${username}`, err);
    return null;
  }
}
