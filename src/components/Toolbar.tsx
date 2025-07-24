import React, { useState } from "react";
import { State } from "../model/state";
import { assertUnreachable } from "../utils/utils";
import { SettingMenu } from "./SettingMenu";
import { SettingIcon } from "./icons/SettingIcon";
import { Timings } from "../model/timings";
import { SAVED_RESULTS_STORAGE_KEY } from "../constants/constants";

interface ToolBarProps {
  isActiveProcess: boolean;
  state: State;
  setState: (state: State) => void;
  toggleAllUsers: () => void;
  toggleCurrentePageUsers: () => void;
  currentTimings: Timings;
  setTimings: (timings: Timings) => void;
}

export const Toolbar = ({
  isActiveProcess,
  state,
  setState,
  toggleAllUsers,
  toggleCurrentePageUsers,
  currentTimings,
  setTimings,
}: ToolBarProps) => {

  const [setingMenu, setSettingMenu] = useState(false);



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
          placeholder="Search Username..."
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
          <button
            className="toggle-all-button"
            onClick={() => {
              if (state.status !== "scanning") return;
              localStorage.setItem(
                SAVED_RESULTS_STORAGE_KEY,
                JSON.stringify({
                  results: state.results ?? [],
                  whitelistedResults: state.whitelistedResults ?? [],
                }),
              );
            }}
          >
            Save Current State
          </button>
        )}
        {state.status === "scanning" && (
          <button
            title="Select all on this page"
            className="toggle-all-button"
            onClick={toggleCurrentePageUsers}
          >
            Select Page
          </button>
        )}
        {state.status === "scanning" && (
          <button
            title="Select all"
            className="toggle-all-button"
            onClick={toggleAllUsers}
          >
            Select All
          </button>
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
