import React, { ChangeEvent, useMemo, useState } from "react";
import { State } from "../model/state";
import { assertUnreachable, getUsersForDisplay } from "../utils/utils";
import { SettingMenu } from "./SettingMenu";
import { SettingIcon } from "./icons/SettingIcon";
import { Timings } from "../model/timings";

interface ToolBarProps {
  isActiveProcess: boolean;
  state: State;
  setState: (state: State) => void;
  scanningPaused: boolean;
  toggleAllUsers: (e: ChangeEvent<HTMLInputElement>) => void;
  toggleCurrentePageUsers: (e: ChangeEvent<HTMLInputElement>) => void;
  currentTimings: Timings;
  setTimings: (timings: Timings) => void;
}

export const Toolbar = ({
  isActiveProcess,
  state,
  setState,
  scanningPaused,
  toggleAllUsers,
  toggleCurrentePageUsers,
  currentTimings,
  setTimings,
}: ToolBarProps) => {

  const [setingMenu, setSettingMenu] = useState(false);

  const whitelistSet = useMemo(() => {
    if (state.status !== "scanning") {
      return new Set<string>();
    }
    return new Set(state.whitelistedResults.map(user => user.id));
  }, [state]);

  const usersForDisplay = useMemo(() => {
    if (state.status !== "scanning") {
      return [] as const;
    }
    return getUsersForDisplay(
      state.results,
      whitelistSet,
      state.currentTab,
      state.searchTerm,
      state.filter,
    );
  }, [state, whitelistSet]);

  return (
    <header className="app-header">
      {isActiveProcess && (
        <progress
          className="progressbar"
          value={state.status !== "initial" ? state.percentage : 0}
          max="100"
        />
      )}
      <div className="app-header-content">
        <SettingIcon onClickLogo={() => { setSettingMenu(true); }} />
        <input
          type="text"
          className="search-bar"
          placeholder="Search..."
          disabled={state.status === "initial"}
          value={state.status === "initial" ? "" : state.searchTerm}
          onChange={e => {
            switch (state.status) {
              case "initial":
                return;
              case "scanning":
                return setState({
                  ...state,
                  searchTerm: e.currentTarget.value,
                });
              case "unfollowing":
                return setState({
                  ...state,
                  searchTerm: e.currentTarget.value,
                });
              default:
                assertUnreachable(state);
            }
          }}
        />
        {state.status === "scanning" && (
          <input
            title="Select all on this page"
            type="checkbox"
            disabled={state.percentage < 100 && !scanningPaused}
            checked={state.selectedResults.length === usersForDisplay.length}
            className="toggle-all-checkbox"
            onClick={toggleCurrentePageUsers}
          />
        )}
        {state.status === "scanning" && (
          <input
            title="Select all"
            type="checkbox"
            disabled={state.percentage < 100 && !scanningPaused}
            checked={state.selectedResults.length === usersForDisplay.length}
            className="toggle-all-checkbox"
            onClick={toggleAllUsers}
          />
        )}
      </div>
      {(setingMenu) &&
        <SettingMenu
          setSettingState={setSettingMenu}
          currentTimings={currentTimings}
          setTimings={setTimings}
        ></SettingMenu>
      }

    </header>
  );
};
