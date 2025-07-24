import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { render } from "react-dom";
import "./styles.scss";

import { User, UserNode } from "./model/user";
import { Toast } from "./components/Toast";
import { UserCheckIcon } from "./components/icons/UserCheckIcon";
import { UserUncheckIcon } from "./components/icons/UserUncheckIcon";
import { DEFAULT_TIME_BETWEEN_SEARCH_CYCLES,
  DEFAULT_TIME_BETWEEN_UNFOLLOWS,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS,
  DEFAULT_TIME_BETWEEN_PROFILE_FETCHES,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_PROFILE_FETCHES,
  INSTAGRAM_HOSTNAME,
  WHITELISTED_RESULTS_STORAGE_KEY
} from "./constants/constants";
import {
  assertUnreachable,
  getCookie,
  getCurrentPageUnfollowers,
  getUsersForDisplay,
  sortUsers,
  sleep,
  unfollowUserUrlGenerator,
  urlGenerator,
} from "./utils/utils";
import { scrapeFollowerCounts } from "./utils/instagram";
import { NotSearching } from "./components/NotSearching";
import { State, ScanningState } from "./model/state";
import { UnfollowLogEntry } from "./model/unfollow-log-entry";
import { Searching } from "./components/Searching";
import { Toolbar } from "./components/Toolbar";
import { Unfollowing } from "./components/Unfollowing";
import { Timings } from "./model/timings";

// pause
let scanningPaused = false;
let followerFetchStarted = false;

function pauseScan() {
  scanningPaused = !scanningPaused;
}


function App() {
  const [state, setState] = useState<State>({
    status: "initial",
  });

  const [toast, setToast] = useState<{ readonly show: false } | { readonly show: true; readonly text: string }>({
    show: false,
  });

  //TODO FOR NEXT UPDATE SAVE THIS IN STORAGE
  const [timings, setTimings] = useState<Timings>(
    {
      timeBetweenSearchCycles: DEFAULT_TIME_BETWEEN_SEARCH_CYCLES,
      timeToWaitAfterFiveSearchCycles: DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES,
      timeBetweenProfileFetches: DEFAULT_TIME_BETWEEN_PROFILE_FETCHES,
      timeToWaitAfterFiveProfileFetches: DEFAULT_TIME_TO_WAIT_AFTER_FIVE_PROFILE_FETCHES,
      timeBetweenUnfollows: DEFAULT_TIME_BETWEEN_UNFOLLOWS,
      timeToWaitAfterFiveUnfollows: DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS,
    }
  );

  const [scrapedCount, setScrapedCount] = useState(0);
  const [scrapeStart, setScrapeStart] = useState<number | null>(null);

  const stateRef = useRef<State>(state);
  const timingsRef = useRef<Timings>(timings);
  const userMapRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    timingsRef.current = timings;
  }, [timings]);

  const whitelistSet = useMemo(() => {
    if (state.status !== "scanning") {
      return new Set<string>();
    }
    return new Set((state.whitelistedResults ?? []).map(user => user.id));
  }, [state]);

  const usersForDisplay = useMemo(() => {
    if (state.status !== "scanning") {
      return [] as readonly UserNode[];
    }
    return getUsersForDisplay(
      state.results ?? [],
      whitelistSet,
      state.currentTab,
      state.searchTerm,
      state.filter,
    );
  }, [state, whitelistSet]);

  const selectedIds = useMemo(() => {
    if (state.status !== "scanning") return new Set<string>();
    return state.selectedIds;
  }, [state]);
  const sortedUsersForDisplay = useMemo(() => {
    if (state.status !== "scanning") {
      return [] as readonly UserNode[];
    }
    return sortUsers(usersForDisplay, state.sortColumns, selectedIds);
  }, [state.status, usersForDisplay, state.status === "scanning" ? state.sortColumns : [], selectedIds]);

  const currentPage = state.status === "scanning" ? state.page : 1;
  const currentPageUsers = useMemo(() => {
    if (state.status !== "scanning") {
      return [] as readonly UserNode[];
    }
    return getCurrentPageUnfollowers(sortedUsersForDisplay, currentPage);
  }, [state.status, sortedUsersForDisplay, currentPage]);


  let isActiveProcess: boolean;
  switch (state.status) {
    case "initial":
      isActiveProcess = false;
      break;
    case "scanning":
    case "unfollowing":
      isActiveProcess = state.percentage < 100;
      break;
    default:
      assertUnreachable(state);
  }

  const onScan = async () => {
    if (state.status !== "initial") {
      return;
    }
    const whitelistedResultsFromStorage: string | null = localStorage.getItem(WHITELISTED_RESULTS_STORAGE_KEY);
    const whitelistedResults: readonly UserNode[] =
      whitelistedResultsFromStorage === null ? [] : JSON.parse(whitelistedResultsFromStorage);
    followerFetchStarted = false;
    scanningPaused = false;
    setState({
      status: "scanning",
      page: 1,
      searchTerm: "",
      sortColumns: [],
      currentTab: "non_whitelisted",
      percentage: 0,
      results: [],
      selectedIds: new Set<string>(),
      whitelistedResults,
      filter: {
        showNonFollowers: true,
        showFollowers: false,
        showPublic: true,
        showPrivate: true,
      },
    });
  };

  const handleScanFilter = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== "scanning") {
      return;
    }
    if (state.selectedIds.size > 0) {
      if (!confirm("Changing filter options will clear selected users")) {
        // Force re-render. Bit of a hack but had an issue where the checkbox state was still
        // changing in the UI even even when not confirming. So updating the state fixes this
        // by synchronizing the checkboxes with the filter statuses in the state.
        setState({ ...state });
        return;
      }
    }
    const name = e.currentTarget.name as keyof typeof state.filter;
    const checked = e.currentTarget.checked;
    const newFilter = { ...state.filter, [name]: checked } as typeof state.filter;
    setState({
      ...state,
      selectedIds: new Set<string>(),
      filter: newFilter,
    });
  };

  const handleUnfollowFilter = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== "unfollowing") {
      return;
    }
    setState({
      ...state,
      filter: {
        ...state.filter,
        [e.currentTarget.name]: e.currentTarget.checked,
      },
    });
  };

  const toggleUser = (newStatus: boolean, user: UserNode) => {
    if (state.status !== "scanning") {
      return;
    }
    if (newStatus) {
      setState({
        ...state,
        selectedIds: new Set(state.selectedIds).add(user.id),
      });
    } else {
      setState({
        ...state,
        selectedIds: (() => {
          const set = new Set(state.selectedIds);
          set.delete(user.id);
          return set;
        })(),
      });
    }
  };

  const toggleAllUsers = () => {
    if (state.status !== "scanning") {
      return;
    }
    const allSelected = state.selectedIds.size === usersForDisplay.length;
    setState({
      ...state,
      selectedIds: allSelected ? new Set<string>() : new Set(usersForDisplay.map(u => u.id)),
    });
  };

  // it will work the same as toggleAllUsers, but it will select everyone on the current page.
  const toggleCurrentePageUsers = () => {
    if (state.status !== "scanning") {
      return;
    }
    const allSelected = currentPageUsers.every(u => selectedIds.has(u.id));
    setState({
      ...state,
      selectedIds: allSelected ? new Set<string>() : new Set(currentPageUsers.map(u => u.id)),
    });
  };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Prompt user if he tries to leave while in the middle of a process (searching / unfollowing / etc..)
      // This is especially good for avoiding accidental tab closing which would result in a frustrating experience.
      if (!isActiveProcess) {
        return;
      }

      // `e` Might be undefined in older browsers, so silence linter for this one.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      e = e || window.event;

      // `e` Might be undefined in older browsers, so silence linter for this one.
      // For IE and Firefox prior to version 4
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (e) {
        e.returnValue = "Changes you made may not be saved.";
      }

      // For Safari
      return "Changes you made may not be saved.";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isActiveProcess, state]);

  useEffect(() => {
    let cancelled = false;
    const scan = async () => {
      if (state.status !== "scanning") {
        return;
      }
      let scrollCycle = 0;
      let url = urlGenerator();
      let hasNext = true;
      let currentFollowedUsersCount = 0;
      let totalFollowedUsersCount = -1;

      while (hasNext && !cancelled) {
        let receivedData: User;
        try {
          receivedData = (await fetch(url).then(res => res.json())).data.user.edge_follow;
        } catch (e) {
          console.error(e);
          continue;
        }

        if (totalFollowedUsersCount === -1) {
          totalFollowedUsersCount = receivedData.count;
        }

        hasNext = receivedData.page_info.has_next_page;
        url = urlGenerator(receivedData.page_info.end_cursor);
        currentFollowedUsersCount += receivedData.edges.length;

        setState(prevState => {
          if (prevState.status !== "scanning") {
            return prevState;
          }

          const newResults = [
            ...(prevState.results ?? []),
            ...receivedData.edges.map(edge => {
              const n = edge.node;
              return {
                id: n.id,
                username: n.username,
                full_name: n.full_name,
                profile_pic_url: n.profile_pic_url,
                is_private: n.is_private,
                is_verified: n.is_verified,
                followed_by_viewer: n.followed_by_viewer,
                follows_viewer: n.follows_viewer,
              } as UserNode;
            }),
          ];

          const newState: State = {
            ...prevState,
            percentage: Math.floor((currentFollowedUsersCount / totalFollowedUsersCount) * 100),
            results: newResults,
          };
          return newState;
        });

        // Pause scanning if user requested so.

        while (scanningPaused) {
          await sleep(1000);
        }

        await sleep(
          Math.floor(
            Math.random() *
              (timingsRef.current.timeBetweenSearchCycles -
                timingsRef.current.timeBetweenSearchCycles * 0.7),
          ) + timingsRef.current.timeBetweenSearchCycles,
        );
        scrollCycle++;
        if (scrollCycle > 6) {
          scrollCycle = 0;
          setToast({
            show: true,
            text: `Sleeping ${
              timingsRef.current.timeToWaitAfterFiveSearchCycles / 1000
            } seconds to prevent getting temp blocked`,
          });
          await sleep(timingsRef.current.timeToWaitAfterFiveSearchCycles);
        }
        setToast({ show: false });
      }
      if (!cancelled) {
        setToast({ show: true, text: "Scanning completed!" });
      }
    };
    scan();
    // Dependency array not entirely legit, but works this way. TODO: Find a way to fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
    };
  }, [state.status]);

  useEffect(() => {
    let cancelled = false;
    const fetchProfiles = async () => {
      if (state.status !== "scanning") {
        return;
      }

      followerFetchStarted = true;
      setScrapeStart(Date.now());
      setScrapedCount(0);
      let cycle = 0;
      let idx = 0;
      while (!cancelled) {
        const s = stateRef.current as ScanningState;
        if (idx >= (s.results?.length ?? 0)) {
          if (s.percentage === 100) break;
          await sleep(500);
          continue;
        }
        const u = s.results![idx];
        try {
          const scraped = await scrapeFollowerCounts(u.username);
          if (!scraped) {
            console.error(`Failed to scrape profile data for ${u.username}`);
            idx++;
            continue;
          }
          const { followers, following, biography } = scraped;

          const update = (list: readonly UserNode[]) =>
            list.map(user =>
              user.id === u.id
                ? {
                    ...user,
                    follower_count: followers,
                    following_count: following,
                    biography: user.biography ?? biography,
                  }
                : user,
            );
          setState(prev => {
            if (prev.status !== "scanning") return prev;
            return {
              ...prev,
              results: prev.results ? update(prev.results) : null,
              whitelistedResults: prev.whitelistedResults ? update(prev.whitelistedResults) : null,
            };
          });
          setScrapedCount(idx + 1);
        } catch (e) {
          console.error(`Failed fetching profile info for ${u.username}`, e);
          idx++;
          continue;
        }

        while (scanningPaused) {
          await sleep(1000);
        }

        await sleep(
          Math.floor(
            Math.random() *
              (timingsRef.current.timeBetweenProfileFetches -
                timingsRef.current.timeBetweenProfileFetches * 0.7),
          ) + timingsRef.current.timeBetweenProfileFetches,
        );
        cycle++;
        if (cycle >= 5) {
          cycle = 0;
          setToast({
            show: true,
            text: `Sleeping ${
              timingsRef.current.timeToWaitAfterFiveProfileFetches / 1000
            } seconds to prevent getting temp blocked`,
          });
          await sleep(timingsRef.current.timeToWaitAfterFiveProfileFetches);
          setToast({ show: false });
        }
        idx++;
      }
      if (!cancelled) {
        setToast({ show: true, text: "Profile fetching completed!" });
      }
    };

    if (!followerFetchStarted && state.status === "scanning" && (state.results?.length ?? 0) > 0) {
      fetchProfiles();
    }
    return () => {
      cancelled = true;
    };
  }, [state, timings]);

  useEffect(() => {
    let cancelled = false;
    const unfollow = async () => {
      if (state.status !== "unfollowing") {
        return;
      }

      const csrftoken = getCookie("csrftoken");
      if (csrftoken === null) {
        throw new Error("csrftoken cookie is null");
      }

      const total = state.selectedIds.size;
      let counter = 0;
      let logBuffer: UnfollowLogEntry[] = [];
      for (const id of state.selectedIds) {
        const username = userMapRef.current.get(id) || "";
        counter += 1;
        const percentage = Math.floor((counter / total) * 100);
        try {
          await fetch(unfollowUserUrlGenerator(id), {
            headers: {
              "content-type": "application/x-www-form-urlencoded",
              "x-csrftoken": csrftoken,
            },
            method: "POST",
            mode: "cors",
            credentials: "include",
          });
          logBuffer.push({ id, username, unfollowedSuccessfully: true });
        } catch (e) {
          console.error(e);
          logBuffer.push({ id, username, unfollowedSuccessfully: false });
        }
        if (logBuffer.length >= 10 || counter === total || cancelled) {
          const bufferCopy = logBuffer;
          logBuffer = [];
          setState(prevState => {
            if (prevState.status !== "unfollowing") {
              return prevState;
            }
            const selectedIds = new Set(prevState.selectedIds);
            for (const entry of bufferCopy) selectedIds.delete(entry.id);
            return {
              ...prevState,
              percentage,
              selectedIds,
              unfollowLog: [...prevState.unfollowLog, ...bufferCopy],
            };
          });
        }
        // If unfollowing the last user in the list, no reason to wait.
        if (counter === total) {
          break;
        }
        await sleep(
          Math.floor(
            Math.random() *
              (timingsRef.current.timeBetweenUnfollows * 1.2 -
                timingsRef.current.timeBetweenUnfollows),
          ) + timingsRef.current.timeBetweenUnfollows,
        );

        if (counter % 5 === 0) {
          setToast({
            show: true,
            text: `Sleeping ${
              timingsRef.current.timeToWaitAfterFiveUnfollows / 60000
            } minutes to prevent getting temp blocked`,
          });
          await sleep(timingsRef.current.timeToWaitAfterFiveUnfollows);
        }
        setToast({ show: false });
      }
    };
    unfollow();
    // Dependency array not entirely legit, but works this way. TODO: Find a way to fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
    };
  }, [state.status]);

  let markup: React.JSX.Element;
  switch (state.status) {
    case "initial":
      markup = <NotSearching onScan={onScan}></NotSearching>;
      break;

    case "scanning": {
      markup = <Searching
        state={state}
        handleScanFilter={handleScanFilter}
        toggleUser={toggleUser}
        userMapRef={userMapRef}
        pauseScan={pauseScan}
        setState={setState}
        scanningPaused={scanningPaused}
        scrapedCount={scrapedCount}
        scrapeStart={scrapeStart}
        timings={timings}
        UserCheckIcon={UserCheckIcon}
        UserUncheckIcon={UserUncheckIcon}
      ></Searching>;
      break;
    }

    case "unfollowing":
      markup = <Unfollowing
        state={state}
        handleUnfollowFilter={handleUnfollowFilter}
      ></Unfollowing>;
      break;

    default:
      assertUnreachable(state);
  }

  return (
    <main id="main" role="main" className="iu">
      <section className="overlay">
        <Toolbar
          state={state}
          setState={setState}
          isActiveProcess={isActiveProcess}
          toggleAllUsers={toggleAllUsers}
          toggleCurrentePageUsers={toggleCurrentePageUsers}
          setTimings={setTimings}
          currentTimings={timings}
        ></Toolbar>

        {markup}

        {toast.show && <Toast show={toast.show} message={toast.text} onClose={() => setToast({ show: false })} />}
      </section>
    </main>
  );
}

if (location.hostname !== INSTAGRAM_HOSTNAME) {
  alert("Can be used only on Instagram routes");
} else {
  document.title = "InstagramUnfollowers";
  document.body.innerHTML = "";
  render(<App />, document.body);
}
