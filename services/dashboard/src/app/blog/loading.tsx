import { headers } from "next/headers";

/** Immediate route feedback while fresh public blog data is being loaded. */
export default function BlogLoading() {
  const ru = headers().get("x-locale") === "ru";
  return (
    <main aria-busy="true" className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <p role="status" className="text-zinc-400 mb-8">{ru ? "Загружаем блог…" : "Loading blog…"}</p>
        <div aria-hidden="true" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 motion-safe:animate-pulse">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-52 rounded-xl bg-zinc-900 border border-zinc-800" />)}
        </div>
      </div>
    </main>
  );
}
