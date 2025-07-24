import { UserNode } from "./user";
import { ScanningTab } from "./scanning-tab";
import { ScanningFilter } from "./scanning-filter";
import { UnfollowLogEntry } from "./unfollow-log-entry";
import { UnfollowFilter } from "./unfollow-filter";

export type SortKey =
  | 'username'
  | 'followers'
  | 'following'
  | 'ratio'
  | 'status'
  | 'selected';

export type SortDirection = 'asc' | 'desc';

export type SortColumn = {
  readonly key: SortKey;
  readonly direction: SortDirection;
};

export type ScanningState = {
  readonly status: 'scanning';
  readonly page: number;
  readonly currentTab: ScanningTab;
  readonly searchTerm: string;
  readonly percentage: number;
  readonly results: readonly UserNode[] | null;
  readonly whitelistedResults: readonly UserNode[] | null;
  readonly selectedIds: ReadonlySet<string>;
  readonly filter: ScanningFilter;
  readonly sortColumns: readonly SortColumn[];
};

export type UnfollowingState = {
  readonly status: 'unfollowing';
  readonly searchTerm: string;
  readonly percentage: number;
  readonly selectedIds: ReadonlySet<string>;
  readonly unfollowLog: readonly UnfollowLogEntry[];
  readonly filter: UnfollowFilter;
};

//TODO THIS TYPE OF MULTIPLE STATE NEEDS TO BE SEPARETED IN DIFFERENT FILES ASAP (Global state,unfollowing state, scanning state etc...)
export type State = { readonly status: 'initial' } | ScanningState | UnfollowingState;
