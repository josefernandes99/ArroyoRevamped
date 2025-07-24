import { UserNode } from "../model/user";
import { UNFOLLOWERS_PER_PAGE } from "../constants/constants";
import { ScanningTab } from "../model/scanning-tab";
import { ScanningFilter } from "../model/scanning-filter";
import { UnfollowLogEntry } from "../model/unfollow-log-entry";
import { UnfollowFilter } from "../model/unfollow-filter";
import { SortColumn } from "../model/state";

export async function copyListToClipboard(nonFollowersList: readonly UserNode[]): Promise<void> {
  const sortedList = [...nonFollowersList].sort((a, b) => (a.username > b.username ? 1 : -1));

  let output = '';
  sortedList.forEach(user => {
    output += user.username + '\n';
  });

  await navigator.clipboard.writeText(output);
  alert('List copied to clipboard!');
}

export function getMaxPage(nonFollowersList: readonly UserNode[]): number {
  const pageCalc = Math.ceil(nonFollowersList.length / UNFOLLOWERS_PER_PAGE);
  return pageCalc < 1 ? 1 : pageCalc;
}

export function getCurrentPageUnfollowers(sortedList: readonly UserNode[], currentPage: number): readonly UserNode[] {
  return sortedList.slice(
    UNFOLLOWERS_PER_PAGE * (currentPage - 1),
    UNFOLLOWERS_PER_PAGE * currentPage,
  );
}

export function getUsersForDisplay(
  results: readonly UserNode[],
  whitelistedIds: ReadonlySet<string>,
  currentTab: ScanningTab,
  searchTerm: string,
  filter: ScanningFilter,
): readonly UserNode[] {
  const users: UserNode[] = [];
  for (const result of results) {
    const isWhitelisted = whitelistedIds.has(result.id);
    switch (currentTab) {
      case "non_whitelisted":
        if (isWhitelisted) {
          continue;
        }
        break;
      case "whitelisted":
        if (!isWhitelisted) {
          continue;
        }
        break;
      default:
        assertUnreachable(currentTab);
    }
    if (!filter.showPrivate && result.is_private) {
        continue;
    }
    if (!filter.showPublic && !result.is_private) {
        continue;
    }
    if (!filter.showFollowers && result.follows_viewer) {
        continue;
    }
    if (!filter.showNonFollowers && !result.follows_viewer) {
        continue;
    }
    const userMatchesSearchTerm =
      result.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    if (searchTerm !== "" && !userMatchesSearchTerm) {
      continue;
    }
    users.push(result);
  }
  return users;
}

export function getUnfollowLogForDisplay(log: readonly UnfollowLogEntry[], searchTerm: string, filter: UnfollowFilter) {
  const entries: UnfollowLogEntry[] = [];
  for (const entry of log) {
    if (!filter.showSucceeded && entry.unfollowedSuccessfully) {
      continue;
    }
    if (!filter.showFailed && !entry.unfollowedSuccessfully) {
      continue;
    }
    const userMatchesSearchTerm = entry.username.toLowerCase().includes(searchTerm.toLowerCase());
    if (searchTerm !== "" && !userMatchesSearchTerm) {
      continue;
    }
    entries.push(entry);
  }
  return entries;
}


export function sortUsers(
  users: readonly UserNode[],
  sort: readonly SortColumn[],
  selectedIds: ReadonlySet<string>,
): readonly UserNode[] {
  const list = [...users];

  const hasMissingAsc = (user: UserNode) =>
    sort.some(s => {
      if (s.direction !== 'asc') return false;
      switch (s.key) {
        case 'followers':
          return user.follower_count === undefined;
        case 'following':
          return user.following_count === undefined;
        case 'ratio':
          return (
            user.follower_count === undefined ||
            user.following_count === undefined
          );
        default:
          return false;
      }
    });
  list.sort((a, b) => {
    const aMissing = hasMissingAsc(a);
    const bMissing = hasMissingAsc(b);
    if (aMissing && !bMissing) return 1;
    if (!aMissing && bMissing) return -1;
    for (const s of sort) {
      let av: any;
      let bv: any;
      switch (s.key) {
        case 'username':
          av = a.username.toLowerCase();
          bv = b.username.toLowerCase();
          break;
        case 'followers':
          av = a.follower_count;
          bv = b.follower_count;
          if (s.direction === 'asc') {
            av = av ?? Infinity;
            bv = bv ?? Infinity;
          } else {
            av = av ?? -Infinity;
            bv = bv ?? -Infinity;
          }
          break;
        case 'following':
          av = a.following_count;
          bv = b.following_count;
          if (s.direction === 'asc') {
            av = av ?? Infinity;
            bv = bv ?? Infinity;
          } else {
            av = av ?? -Infinity;
            bv = bv ?? -Infinity;
          }
          break;
        case 'ratio':
          av = a.follower_count && a.following_count ? a.following_count / a.follower_count : undefined;
          bv = b.follower_count && b.following_count ? b.following_count / b.follower_count : undefined;
          if (s.direction === 'asc') {
            av = av ?? Infinity;
            bv = bv ?? Infinity;
          } else {
            av = av ?? -Infinity;
            bv = bv ?? -Infinity;
          }
          break;
        case 'status':
          av = a.is_private ? 1 : 0;
          bv = b.is_private ? 1 : 0;
          break;
        case 'selected':
          av = selectedIds.has(a.id) ? 1 : 0;
          bv = selectedIds.has(b.id) ? 1 : 0;
          break;
        default:
          assertUnreachable(s.key as never);
      }
      if (av < bv) return s.direction === 'asc' ? -1 : 1;
      if (av > bv) return s.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
  return list;
}

/**
 * When writing a switch-case with a finite number of cases, use this function in the
 * `default` clause of switch-case statements for exhaustive checking. This will make
 * TS complain until ALL cases are handled. For example, if we have a switch-case
 * in-which we evaluate every possible status of a component's state, if we add this
 * to the default clause and then add a new status to the state type, TS will complain
 * and force us to handle it as well, thus avoiding forgetting it.
 */
export function assertUnreachable(_value: never): never {
  throw new Error('Statement should be unreachable');
}

function maybeGC(): void {
  const g = (globalThis as any).gc;
  if (typeof g === 'function') {
    try {
      g();
    } catch {
      // ignore errors calling gc
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      maybeGC();
      resolve();
    }, ms);
  });
}

export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length !== 2) {
    return null;
  }
  return parts.pop()!.split(';').shift()!;
}

export function urlGenerator(nextCode?: string): string {
  const ds_user_id = getCookie('ds_user_id');
  if (nextCode === undefined) {
    // First url
    return `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24"}`;
  }
  return `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24","after":"${nextCode}"}`;
}

export function unfollowUserUrlGenerator(idToUnfollow: string): string {
  return `https://www.instagram.com/web/friendships/${idToUnfollow}/unfollow/`;
}

export function asciiNormalize(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x1f1e6 && code <= 0x1f1ff) {
      out += String.fromCharCode(code - 0x1f1e6 + 65);
      continue;
    }
    if (code >= 0x1f000) {
      // Drop other emoji and symbols
      continue;
    }
    out += ch;
  }
  out = out.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return out;
}

