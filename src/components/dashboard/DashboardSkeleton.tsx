const card = "rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const bar = "rounded bg-slate-200/70";

/** Placeholder with the dashboard's layout while orders load from the database. */
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading orders">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${card} p-4 sm:p-5`}>
            <div className={`${bar} h-4 w-24`} />
            <div className={`${bar} mt-4 h-8 w-12`} />
            <div className={`${bar} mt-3 h-3 w-32 max-w-full`} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className={card}>
          <div className="space-y-3 border-b border-slate-200 p-5">
            <div className={`${bar} h-4 w-32`} />
            <div className={`${bar} h-9 w-full`} />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
              <div className={`${bar} h-4 w-20`} />
              <div className={`${bar} h-4 flex-1`} />
              <div className={`${bar} h-4 w-24`} />
            </div>
          ))}
        </div>
        <div className={`${card} space-y-4 p-5`}>
          <div className={`${bar} h-4 w-36`} />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${bar} h-14 w-full`} />
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">
        Loading orders…
      </p>
    </div>
  );
}
