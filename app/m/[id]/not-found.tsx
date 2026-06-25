import Link from 'next/link';

export default function MelodyNotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <h1 className="text-2xl font-semibold">Melody Not Found</h1>
        <p className="text-gray-400">
          The melody you&apos;re looking for doesn&apos;t exist or may have been deleted.
        </p>
        <Link
          href="/"
          className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
