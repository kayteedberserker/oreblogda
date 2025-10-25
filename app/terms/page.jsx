"use client";
import React from "react";

const TermsAndConditions = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-6 py-16 bg-linear-to-br from-blue-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors duration-500 relative overflow-hidden">
      
      {/* Subtle anime glow background */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      <div className="max-w-3xl text-left relative z-10">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100 text-center">
          Terms & Conditions
        </h1>
        <p className="text-gray-700 dark:text-gray-300 mb-8 text-center">
          Welcome to <span className="font-semibold text-indigo-600 dark:text-indigo-400">Oreblogda</span>!  
          By using this website, you agree to the following simple terms.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-3">
          1. Content & Use
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          All posts, articles, and media on Oreblogda are for entertainment and informational purposes only.  
          Please enjoy, share, and discuss — but don’t copy or repost our content without credit.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-3">
          2. User Conduct
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Be respectful when commenting or engaging with our content.  
          We don’t tolerate spam, hate speech, or harmful behavior. Violating this may result in comment or account removal.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-3">
          3. External Links
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Sometimes we share links to other websites or anime sources.  
          We’re not responsible for their content or privacy practices — browse responsibly.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-3">
          4. Updates
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          These terms might change occasionally as Oreblogda grows.  
          We’ll always keep the latest version available here.
        </p>

        <p className="text-gray-700 dark:text-gray-300 mt-10">
          If you have questions or concerns, contact us at  
          <span className="font-semibold text-indigo-600 dark:text-indigo-400"> oreblogda@gmail.com</span>.
        </p>
      </div>
    </div>
  );
};

export default TermsAndConditions;
