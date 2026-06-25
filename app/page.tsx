import Link from 'next/link';
import { MelodyFeed, ErrorBoundary } from '@/components';
import { getMelodiesPaginated } from '@/lib/melodies';

// This page fetches fresh data on every request
export const dynamic = 'force-dynamic';

/**
 * Homepage component (Server Component)
 *
 * Fetches initial melody data server-side for faster first paint and SEO,
 * then hands off to the client-side MelodyFeed for interactivity and infinite scroll.
 *
 * Requirements:
 * - 22.1: Display first 20 melodies ordered by creation date (newest first)
 * - 22.2: Display melody title and creation date for each item
 * - 22.3: Provide play button for preview playback
 * - 22.4: Load next 20 melodies using infinite scroll
 * - 22.5: Load feed data using GET /api/melodies
 * - 22.6: Display empty state when no melodies available
 */
export default async function HomePage() {
  let initialMelodies;

  try {
    const data = await getMelodiesPaginated(1, 20);
    initialMelodies = data.melodies;
  } catch {
    // If DB fetch fails, let the client-side handle it
    initialMelodies = undefined;
  }

  return (
    <ErrorBoundary
      errorTitle="Page Error"
      errorMessage="Something went wrong while loading the page. Please try again."
    >
      <div className="flex flex-col flex-1 bg-gray-900 text-gray-100">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <svg
                className="w-8 h-8 text-indigo-500"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
              <h1 className="text-xl font-semibold">Tone Sketch</h1>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/create"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Create
            </Link>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-100">Discover Melodies</h2>
              <p className="mt-1 text-gray-400">
                Listen to melodies created by the community
              </p>
            </div>

            <ErrorBoundary
              errorTitle="Feed Error"
              errorMessage="Could not load the melody feed. Please try again."
              showHomeButton={false}
            >
              <MelodyFeed initialMelodies={initialMelodies} />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
