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
): Promise<{ followers: number; following: number; biography: string | null } | null> {
  console.log(`scrapeFollowerCounts: fetching ${username}`);
  try {
    let biography: string | null = null;

    const res = await fetch(`/${username}/`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`http ${res.status}`);
    }
    const html = await res.text();
    console.log('scrapeFollowerCounts: html length', html.length);

    // fallback to meta description parsing (may vary by locale)
    const descDoc = new DOMParser().parseFromString(html, 'text/html');
    const desc =
      descDoc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      descDoc
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content');

    const escaped = username.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const userSection = html.match(
      new RegExp(`"username":"${escaped}"([\s\S]*?)"edge_owner_to_timeline_media"`),
    );
    if (userSection) {
      const sec = userSection[1];
      const followersMatch = sec.match(/"edge_followed_by":\{"count":(\d+)\}/);
      const followingMatch = sec.match(/"edge_follow":\{"count":(\d+)\}/);
      const bioMatch = sec.match(/"biography":"((?:\\.|[^\"])*)"/);
      if (followersMatch && followingMatch) {
        const followers = parseInt(followersMatch[1], 10);
        const following = parseInt(followingMatch[1], 10);
        if (bioMatch) {
          try {
            biography = JSON.parse(`"${bioMatch[1]}"`);
          } catch {
            biography = bioMatch[1];
          }
        }
        console.log(`scrapeFollowerCounts: scraped ${username} via html section`, {
          followers,
          following,
          biography,
        });
        return { followers, following, biography };
      }
    }

    if (desc) {
      const followerMatch =
        desc.match(/([\d.,MK]+)\s*(followers|seguidores)/i) ||
        desc.match(/(followers|seguidores)\s*([\d.,MK]+)/i);
      const followingMatch =
        desc.match(/([\d.,MK]+)\s*(following|seguindo)/i) ||
        desc.match(/(a seguir|seguindo|following)\s*([\d.,MK]+)/i);

      const bioMatch = desc.match(/Instagram:\s*"([^"]*)/i);

      if (followerMatch && followingMatch) {
        const followers = parseInstagramNumber(followerMatch[1] ?? followerMatch[2]);
        const following = parseInstagramNumber(followingMatch[1] ?? followingMatch[2]);
        if (!biography && bioMatch) {
          biography = bioMatch[1];
        }
        console.log(`scrapeFollowerCounts: scraped ${username} via meta`, {
          followers,
          following,
          biography,
        });
        return { followers, following, biography };
      }
      console.error('scrapeFollowerCounts: description regex mismatch', desc);
    }

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const pageText = temp.innerText;
    console.log('scrapeFollowerCounts: page text length', pageText.length);
    let followersMatch =
      pageText.match(/([\d.,MK]+)\s*(followers|seguidores)/i) ||
      pageText.match(/(followers|seguidores)\s*([\d.,MK]+)/i);
    let followingMatch =
      pageText.match(/([\d.,MK]+)\s*(following|seguindo)/i) ||
      pageText.match(/(a seguir|seguindo|following)\s*([\d.,MK]+)/i);

    if (followersMatch && followingMatch) {
      const followers = parseInstagramNumber(followersMatch[1] ?? followersMatch[2]);
      const following = parseInstagramNumber(followingMatch[1] ?? followingMatch[2]);
      if (!biography) {
        const followingIdx = pageText.indexOf(followingMatch[0]);
        if (followingIdx !== -1) {
          const after = pageText.slice(followingIdx + followingMatch[0].length);
          const bioLine = after.split(/\n+/).map(l => l.trim()).find(l => l);
          if (bioLine) {
            biography = bioLine;
          }
        }
      }
      console.log(`scrapeFollowerCounts: scraped ${username} via text`, {
        followers,
        following,
        biography,
      });
      return { followers, following, biography };
    }

    throw new Error('unable to extract follower counts');
  } catch (err) {
    console.error(`scrapeFollowerCounts: error for ${username}`, err);
    return null;
  }
}
