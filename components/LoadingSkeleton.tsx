export default function LoadingSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 animate-pulse">
      <div className="h-10 w-48 rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
      <hr className="border-gray-100 dark:border-gray-800" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800" />
    </div>
  )
}
