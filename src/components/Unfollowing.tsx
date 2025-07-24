import React from "react";
import { getUnfollowLogForDisplay } from "../utils/utils";
import { State } from "../model/state";

interface UnfollowingProps {
  state: State;
  handleUnfollowFilter: (e: React.ChangeEvent<HTMLInputElement>) => void;

}

export const Unfollowing = (
  {
    state,
    handleUnfollowFilter,
  }: UnfollowingProps) => {

  if (state.status !== "unfollowing") {
    return null;
  }

  return (
    <section className="flex">
      <aside className="app-sidebar">
        <menu className="flex column grow m-clear p-clear">
          <p>Filter</p>
          <label className="badge m-small">
            <input
              type="checkbox"
              name="showSucceeded"
              checked={state.filter.showSucceeded}
              onChange={handleUnfollowFilter}
            />
            &nbsp;Succeeded
          </label>
          <label className="badge m-small">
            <input
              type="checkbox"
              name="showFailed"
              checked={state.filter.showFailed}
              onChange={handleUnfollowFilter}
            />
            &nbsp;Failed
          </label>
        </menu>
      </aside>
      <article className="unfollow-log-container">
        {state.unfollowLog.length === state.selectedIds.size && (
          <>
            <hr />
            <div className="fs-large p-medium clr-green">All DONE!</div>
            <hr />
          </>
        )}
        {getUnfollowLogForDisplay(state.unfollowLog, state.searchTerm, state.filter).map(
          (entry, index) =>
            entry.unfollowedSuccessfully ? (
              <div className="p-medium" key={entry.id}>
                Unfollowed
                <a
                  className="clr-inherit"
                  target="_blank"
                  href={`../${entry.username}`}
                  rel="noreferrer"
                >
                  &nbsp;{entry.username}
                </a>
                <span className="clr-cyan">
                  &nbsp; [{index + 1}/{state.selectedIds.size}]
                </span>
              </div>
            ) : (
              <div className="p-medium clr-red" key={entry.id}>
                Failed to unfollow {entry.username} [{index + 1}/
                {state.selectedIds.size}]
              </div>
            ),
        )}
      </article>
    </section>
  );
};
