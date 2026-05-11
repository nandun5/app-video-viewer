import React from 'react';

interface BreadcrumbEntry {
  browserPath: string;
  name: string;
}

interface BreadcrumbProps {
  stack: BreadcrumbEntry[];
  onNavigate: (path: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ stack, onNavigate }) => {
  return (
    <div className="breadcrumb bottom-breadcrumb">
      {stack.map((entry, index) => (
        <React.Fragment key={entry.browserPath || 'root'}>
          {index > 0 && <span className="breadcrumb-separator">/</span>}
          <button
            className="breadcrumb-item"
            onClick={() => onNavigate(entry.browserPath)}
          >
            {index === 0 ? 'Root' : entry.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
