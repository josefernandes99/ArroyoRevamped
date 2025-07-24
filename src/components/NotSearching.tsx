import React from 'react';

interface NotSearchingProps {
  onScan?: () => void;
  onLoad?: () => void;
}

export const NotSearching = ({ onScan, onLoad }: NotSearchingProps) => (
  <div className="start-buttons">
    <button className="run-scan" onClick={onScan}>
      RUN
    </button>
    <button className="load-save" onClick={onLoad}>
      LOAD LAST SAVE
    </button>
  </div>
);
