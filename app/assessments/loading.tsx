export default function AssessmentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-slate-800 rounded w-1/4" />
      <div className="h-24 bg-slate-900 border border-slate-800 rounded-xl" />
      <div className="space-y-3">
        <div className="h-16 bg-slate-900 border border-slate-800 rounded-lg" />
        <div className="h-16 bg-slate-900 border border-slate-800 rounded-lg" />
        <div className="h-16 bg-slate-900 border border-slate-800 rounded-lg" />
      </div>
    </div>
  );
}
