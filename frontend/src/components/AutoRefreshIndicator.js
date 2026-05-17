'use client';

function formatInterval(intervalSeconds) {
  if (!intervalSeconds) {
    return 'Off';
  }

  if (intervalSeconds < 60) {
    return `${intervalSeconds}s`;
  }

  const minutes = Math.round(intervalSeconds / 60);
  return `${minutes}m`;
}

function formatTime(value) {
  if (!value) {
    return 'Waiting for next sync';
  }

  return `Updated ${new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

export default function AutoRefreshIndicator({ intervalSeconds = 0, isRefreshing = false, lastRefreshedAt = null }) {
  const enabled = intervalSeconds > 0;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
      <span
        className={`h-2 w-2 rounded-full ${
          !enabled
            ? 'bg-gray-300 dark:bg-gray-600'
            : isRefreshing
              ? 'animate-pulse bg-blue-500'
              : 'bg-emerald-500'
        }`}
      />
      <span>{enabled ? formatTime(lastRefreshedAt) : 'Auto-refresh off'}</span>
      <span className="text-gray-400 dark:text-gray-500">•</span>
      <span>{enabled ? `Every ${formatInterval(intervalSeconds)}` : 'Manual refresh only'}</span>
    </div>
  );
}
