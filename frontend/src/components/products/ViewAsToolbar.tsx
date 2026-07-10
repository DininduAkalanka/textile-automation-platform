'use client';

export type ViewMode = 'grid-2' | 'grid-3' | 'grid-4' | 'list';

interface ViewAsToolbarProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export default function ViewAsToolbar({ currentMode, onModeChange }: ViewAsToolbarProps) {
  const modes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    {
      id: 'grid-2',
      label: '2 Columns',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="4" width="8" height="16" rx="1.5" />
          <rect x="13" y="4" width="8" height="16" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'grid-3',
      label: '3 Columns',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="4" width="5.5" height="16" rx="1" />
          <rect x="9.25" y="4" width="5.5" height="16" rx="1" />
          <rect x="16.5" y="4" width="5.5" height="16" rx="1" />
        </svg>
      ),
    },
    {
      id: 'grid-4',
      label: '4 Columns',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="4" width="4" height="16" rx="0.75" />
          <rect x="7.33" y="4" width="4" height="16" rx="0.75" />
          <rect x="12.66" y="4" width="4" height="16" rx="0.75" />
          <rect x="18" y="4" width="4" height="16" rx="0.75" />
        </svg>
      ),
    },
    {
      id: 'list',
      label: 'List View',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <rect x="3" y="10" width="18" height="4" rx="1" />
          <rect x="3" y="16" width="18" height="4" rx="1" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        background: 'var(--clr-surface-2)',
        padding: '0.25rem',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--clr-border)',
      }}
      role="group"
      aria-label="Product layout mode"
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--clr-text-3)',
          padding: '0 0.5rem',
          fontWeight: 600,
        }}
        className="hide-mobile"
      >
        View As:
      </span>
      {modes.map((mode) => {
        const isActive = currentMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onModeChange(mode.id)}
            title={mode.label}
            aria-label={mode.label}
            aria-pressed={isActive}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
              borderRadius: 'var(--r-xs)',
              border: 'none',
              background: isActive ? 'var(--clr-brand)' : 'transparent',
              color: isActive ? '#ffffff' : 'var(--clr-text-2)',
              cursor: 'pointer',
              transition: 'all 180ms var(--ease-out-expo)',
              boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--clr-brand)';
                e.currentTarget.style.background = 'var(--clr-brand-tint)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--clr-text-2)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {mode.icon}
          </button>
        );
      })}
    </div>
  );
}
