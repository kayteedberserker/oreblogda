"use client";
import React from "react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-6 py-12 bg-linear-to-br from-blue-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors duration-500 relative overflow-hidden">
      
      {/* Subtle anime glow */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      <div className="max-w-4xl text-left relative z-10">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100 text-center">
          Privacy Policy
        </h1>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Last updated: October 2025
        </p>

        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Welcome to <span className="font-semibold text-indigo-600 dark:text-indigo-400">Oreblogda</span>!  
          Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you visit our website.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          1. Information We Collect
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We may collect personal information such as your email address when you subscribe to our newsletter.  
          We also collect non-personal data automatically, like browser type, device info, and general site usage through cookies or analytics tools.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          2. How We Use Your Information
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          - To send you updates about new posts, anime news, or special content. <br />
          - To improve our website experience and understand what our readers enjoy most. <br />
          - To ensure our site remains secure and functional.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          3. Cookies
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We use cookies to personalize content and analyze traffic.  
          You can choose to disable cookies in your browser settings, but some parts of the site may not function properly without them.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          4. Sharing of Information
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We do not sell or share your personal data with third parties, except as required by law or to comply with legal processes.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          5. Security
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We take reasonable measures to protect your personal information.  
          However, no method of transmission over the Internet is completely secure, so we cannot guarantee absolute security.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          6. Your Rights
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          You may request to update or delete your personal data by contacting us directly.  
          If you subscribed to our newsletter, you can unsubscribe anytime via the link in our emails.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          7. Updates to This Policy
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We may update this Privacy Policy occasionally to reflect changes in our practices or for other operational reasons.  
          The date above will always show the latest version.
        </p>

        <p className="text-gray-700 dark:text-gray-300 mt-10">
          If you have any questions about this Privacy Policy, please contact us at  
          <span className="font-semibold text-indigo-600 dark:text-indigo-400"> oreblogda@gmail.com</span>.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
