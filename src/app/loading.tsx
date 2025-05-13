export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">TOEFL Practice</h1>
        <div className="animate-pulse flex space-x-4 justify-center">
          <div className="rounded-full bg-gray-300 h-3 w-3"></div>
          <div className="rounded-full bg-gray-300 h-3 w-3"></div>
          <div className="rounded-full bg-gray-300 h-3 w-3"></div>
        </div>
        <p className="mt-4 text-gray-600">Loading your content...</p>
      </div>
    </div>
  );
}
