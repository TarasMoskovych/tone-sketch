'use client';

import { GitHubIcon, LinkedInIcon } from './icons';

export function Footer() {
  return (
    <footer className="border-t border-gray-700 bg-gray-800 py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-gray-400">
            Enjoying Tone Sketch? Please star the repo or connect with me!
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/TarasMoskovych/tone-sketch"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
              aria-label="Star on GitHub"
            >
              <GitHubIcon className="h-5 w-5" />
              <span>Star on GitHub</span>
            </a>
            <a
              href="https://www.linkedin.com/in/taras-moskovych"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
              aria-label="Connect on LinkedIn"
            >
              <LinkedInIcon className="h-5 w-5" />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
