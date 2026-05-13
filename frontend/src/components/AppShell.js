'use client';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import Navigation from './Navigation';

export default function AppShell({ children }) {
  const { currentUser } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4 md:px-6">
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">💰 Finance Tracker</h1>

          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>

            {currentUser && (
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                {currentUser.name}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-[calc(100vh-64px)]">
        {currentUser && <Navigation />}
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </>
  );
}
