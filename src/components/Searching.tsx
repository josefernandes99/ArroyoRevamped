import React, { useMemo, useState } from "react";
import { asciiNormalize } from "../utils/utils";
import { VerifiedIcon } from "./icons/VerifiedIcon";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}
import {
  assertUnreachable,
  getCurrentPageUnfollowers,
  getMaxPage,
  getUsersForDisplay,
  sortUsers,
} from "../utils/utils";
import { ScanningState, State, SortKey } from "../model/state";
import { UserNode } from "../model/user";
import { WHITELISTED_RESULTS_STORAGE_KEY } from "../constants/constants";
import { Timings } from "../model/timings";


export interface SearchingProps {
  state: ScanningState;
  setState: (state: State) => void;
  scanningPaused: boolean;
  pauseScan: () => void;
  handleScanFilter: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleUser: (checked: boolean, user: UserNode) => void;
  UserCheckIcon: React.FC;
  UserUncheckIcon: React.FC;
  scrapedCount: number;
  scrapeStart: number | null;
  timings: Timings;
}

export const Searching = ({
  state,
  setState,
  scanningPaused,
  pauseScan,
  handleScanFilter,
  toggleUser,
  UserCheckIcon,
  UserUncheckIcon,
  scrapedCount,
  scrapeStart,
  timings,
}: SearchingProps) => {
  if (state.status !== "scanning") {
    return null;
  }

  const [bioSearch, setBioSearch] = useState("");

  const whitelistSet = useMemo(() => {
    return new Set(state.whitelistedResults.map(user => user.id));
  }, [state]);

  const usersForDisplay = useMemo(() => {
    const base = getUsersForDisplay(
      state.results,
      whitelistSet,
      state.currentTab,
      state.searchTerm,
      state.filter,
    );
    const keywords = bioSearch
      .split(',')
      .map(k => asciiNormalize(k).trim().toLowerCase())
      .filter(k => k);
    if (keywords.length === 0) {
      return base;
    }
    return base.filter(u => {
      if (!u.biography) return false;
      const bio = asciiNormalize(u.biography).toLowerCase();
      return keywords.some(k => bio.includes(k));
    });
  }, [state, whitelistSet, bioSearch]);
  const selectedIds = useMemo(() => new Set(state.selectedResults.map(u => u.id)), [state.selectedResults]);
  const sortedUsersForDisplay = useMemo(
    () => sortUsers(usersForDisplay, state.sortColumns, selectedIds),
    [usersForDisplay, state.sortColumns, selectedIds],
  );
  const currentPageUsers = useMemo(
    () => getCurrentPageUnfollowers(sortedUsersForDisplay, state.page),
    [sortedUsersForDisplay, state.page],
  );

  const elapsedMs = scrapeStart ? Date.now() - scrapeStart : 0;
  const remaining = state.results.length - scrapedCount;
  const etaMs =
    remaining * timings.timeBetweenProfileFetches +
    Math.floor(remaining / 5) * timings.timeToWaitAfterFiveProfileFetches;
  const elapsed = formatDuration(elapsedMs);
  const eta = formatDuration(etaMs);

  const handleSort = (key: SortKey) => {
    const idx = state.sortColumns.findIndex(c => c.key === key);
    let newSort = [...state.sortColumns];
    if (idx !== -1) {
      const dir = newSort[idx].direction === 'asc' ? 'desc' : 'asc';
      newSort[idx] = { key, direction: dir };
    } else if (state.sortColumns.length >= 2) {
      newSort = [];
    } else {
      newSort.push({ key, direction: 'asc' });
    }
    setState({ ...state, sortColumns: newSort });
  };

  const renderHeader = (key: SortKey, label: string) => {
    const idx = state.sortColumns.findIndex(c => c.key === key);
    if (idx === -1) {
      return label;
    }
    const arrow = state.sortColumns[idx].direction === 'asc' ? '↑' : '↓';
    const order = idx + 1;
    return (
      <>
        {label} {arrow} {order}
      </>
    );
  };

  const openProfileTabs = () => {
    for (const u of currentPageUsers) {
      window.open(`/${u.username}`, "_blank");
    }
  };



  return (
    <section className="flex">
      <aside className="app-sidebar">
        <menu className="flex column m-clear p-clear">
          <label className="badge m-small">
            <input
              type="checkbox"
              name="showNonFollowers"
              checked={state.filter.showNonFollowers}
              onChange={handleScanFilter}
            />
            &nbsp;Non-Followers
          </label>
          <label className="badge m-small">
            <input
              type="checkbox"
              name="showFollowers"
              checked={state.filter.showFollowers}
              onChange={handleScanFilter}
            />
            &nbsp;Followers
          </label>
          <label className="badge m-small">
            <input
              type="checkbox"
              name="showPublic"
              checked={state.filter.showPublic}
              onChange={handleScanFilter}
            />
            &nbsp;Public
          </label>
          <label className="badge m-small">
            <input
              type="checkbox"
              name="showPrivate"
              checked={state.filter.showPrivate}
              onChange={handleScanFilter}
            />
            &nbsp;Private
          </label>
        </menu>
        <div className="grow">
          <p>Displayed: {usersForDisplay.length}</p>
          {scrapeStart !== null && (
            <p>Scraped: {scrapedCount}</p>
          )}
          <p>Total: {state.results.length}</p>
          {scrapeStart !== null && (
            <p>
              Scraping: {elapsed} / {eta}
            </p>
          )}
        </div>
        <div className="grow t-center">
          <p>Pages</p>
          <a
            onClick={() => {
              if (state.page - 1 > 0) {
                setState({
                  ...state,
                  page: state.page - 1,
                });
              }
            }}
            className="p-medium"
          >
            ❮
          </a>
          <span>
            {state.page}&nbsp;/&nbsp;{getMaxPage(usersForDisplay)}
          </span>
          <a
            onClick={() => {
              if (state.page < getMaxPage(usersForDisplay)) {
                setState({
                  ...state,
                  page: state.page + 1,
                });
              }
            }}
            className="p-medium"
          >
            ❯
          </a>
        </div>
        <div className="controls">
          <button
            className="button-control button-pause"
            onClick={pauseScan}
          >
            {scanningPaused ? "Resume" : "Pause"}
          </button>
        </div>
        <button
          className="open-profiles"
          onClick={openProfileTabs}
        >
          Open Profiles
        </button>
        <button
          className="unfollow"
          onClick={() => {
            if (!confirm("Are you sure?")) {
              return;
            }
            //TODO TEMP until types are properly fixed
            // @ts-ignore
            setState(prevState => {
              if (prevState.status !== "scanning") {
                return prevState;
              }
              if (prevState.selectedResults.length === 0) {
                alert("Must select at least a single user to unfollow");
                return prevState;
              }
              const newState: State = {
                status: "unfollowing",
                searchTerm: prevState.searchTerm,
                percentage: 0,
                selectedResults: prevState.selectedResults,
                unfollowLog: [],
                filter: {
                  showSucceeded: true,
                  showFailed: true,
                },
              };
              return newState;
            });
          }}
        >
          Unfollow ({state.selectedResults.length})
        </button>
      </aside>
      <article className="results-container">
        <nav className="tabs-container">
          <div
            className={`tab ${state.currentTab === "non_whitelisted" ? "tab-active" : ""}`}
            onClick={() => {
              if (state.currentTab === "non_whitelisted") {
                return;
              }
              setState({
                ...state,
                currentTab: "non_whitelisted",
                selectedResults: [],
              });
            }}
          >
            Non-Whitelisted
          </div>
          <div
            className={`tab ${state.currentTab === "whitelisted" ? "tab-active" : ""}`}
            onClick={() => {
              if (state.currentTab === "whitelisted") {
                return;
              }
              setState({
                ...state,
                currentTab: "whitelisted",
                selectedResults: [],
              });
            }}
          >
            Whitelisted
          </div>
        </nav>
        <table className="results-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th onClick={() => handleSort('username')}>{renderHeader('username', 'User')}</th>
              <th>
                <p>Bio</p>
                <input
                  type="text"
                  className="bio-search"
                  placeholder="Search Keywords..."
                  value={bioSearch}
                  onChange={e => setBioSearch(e.currentTarget.value)}
                />
              </th>
              <th onClick={() => handleSort('followers')}>{renderHeader('followers', 'Followers')}</th>
              <th onClick={() => handleSort('following')}>{renderHeader('following', 'Following')}</th>
              <th onClick={() => handleSort('ratio')}>{renderHeader('ratio', 'Ratio')}</th>
              <th onClick={() => handleSort('status')}>{renderHeader('status', 'Status')}</th>
              <th onClick={() => handleSort('selected')}>{renderHeader('selected', 'Select')}</th>
            </tr>
          </thead>
          <tbody>
            {currentPageUsers.map(user => {
              const ratio =
                user.follower_count && user.following_count
                  ? (user.following_count / user.follower_count) * 100
                  : 0;
              const ratioClass = ratio >= 100 ? "ratio-green" : "ratio-red";
              return (
                <tr key={user.id} className="result-row">
                  <td>
                    <div
                      className="avatar-container"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        let whitelistedResults: readonly UserNode[] = [];
                        switch (state.currentTab) {
                          case "non_whitelisted":
                            whitelistedResults = [...state.whitelistedResults, user];
                            break;

                          case "whitelisted":
                            whitelistedResults = state.whitelistedResults.filter(
                              result => result.id !== user.id,
                            );
                            break;

                          default:
                            assertUnreachable(state.currentTab);
                        }
                        localStorage.setItem(
                          WHITELISTED_RESULTS_STORAGE_KEY,
                          JSON.stringify(whitelistedResults),
                        );
                        setState({ ...state, whitelistedResults });
                      }}
                    >
                      <img
                        className="avatar"
                        alt={user.username}
                        src={user.profile_pic_url}
                      />
                      <span className="avatar-icon-overlay-container">
                        {state.currentTab === "non_whitelisted" ? (
                          <UserCheckIcon />
                        ) : (
                          <UserUncheckIcon />
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex column">
                      <a
                        className="fs-xlarge username-link"
                        target="_blank"
                        href={`/${user.username}`}
                        rel="noreferrer"
                      >
                        <span>{user.username}</span>
                        {user.is_verified && (
                          <span className="verified-badge">
                            <VerifiedIcon />
                          </span>
                        )}
                      </a>
                      <span className="fs-medium">{user.full_name}</span>
                    </div>
                  </td>
                  <td className="fs-medium">{user.biography ?? '-'}</td>
                  <td className="fs-medium">{user.follower_count ?? '-'}</td>
                  <td className="fs-medium">{user.following_count ?? '-'}</td>
                  <td className={`fs-medium ${ratioClass}`}>{ratio.toFixed(0)}%</td>
                  <td className="fs-medium">{user.is_private ? 'Private' : 'Public'}</td>
                  <td>
                    <input
                      className="account-checkbox"
                      type="checkbox"
                      checked={state.selectedResults.indexOf(user) !== -1}
                      onChange={e => toggleUser(e.currentTarget.checked, user)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
    </section>
  );
};
