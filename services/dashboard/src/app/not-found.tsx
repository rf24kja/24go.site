import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-zinc-700 mb-4">404</div>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Page not found</h1>
        <p className="text-zinc-400 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
