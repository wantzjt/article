export function SearchForm({ query }: { query: string }) {
  return (
    <form action="/search" method="get" className="flex items-end gap-4">
      <label className="block min-w-0 flex-1 space-y-2">
        <span className="kicker">Topic</span>
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoComplete="off"
          className="w-full border-b border-rule bg-transparent py-2 text-[0.9375rem] leading-6 text-ink outline-none"
        />
      </label>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center border-b border-rule font-mono text-[12px]/[16px] text-ink"
      >
        Search
      </button>
    </form>
  );
}
