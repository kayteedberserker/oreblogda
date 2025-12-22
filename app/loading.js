import React from 'react'

const Loading = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading Page...</p>
      </div>
    </div>
  )
}

export default Loading