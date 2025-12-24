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
          Last updated: December 2025
        </p>

        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Welcome to <span className="font-semibold text-indigo-600 dark:text-indigo-400">Oreblogda</span>!  
          Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you use our website and Android application.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          1. Information We Collect
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          <strong>User Account Info:</strong> We collect usernames and email addresses to provide personalized features and account management. <br />
          <strong>User Content:</strong> We collect photos that you choose to upload for your profile or community interactions. <br />
          <strong>Device Data:</strong> We collect non-personal data automatically, such as browser type and device info. We also utilize the <strong>Google Advertising ID</strong> to provide relevant advertisements and prevent fraud.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          2. How We Use Your Information
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          - To provide core app functionality (account creation, profile customization). <br />
          - To send you updates about new posts, anime news, or special content. <br />
          - To display non-intrusive advertisements via Google AdMob. <br />
          - To ensure our site remains secure and functional.
        </p>

        {/* NEW SECTION FOR CHILD SAFETY */}
        <h2 id="safety" className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          3. Child Safety Standards (CSAE Policy)
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6 bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-100 dark:border-red-900">
          Oreblogda has a <strong>zero-tolerance policy</strong> regarding Child Sexual Abuse Material (CSAM). 
          Any user attempting to upload, share, or promote such content will be permanently banned, and their details will be reported to the National Center for Missing & Exploited Children (NCMEC) and relevant law enforcement. We utilize both automated and manual moderation to enforce these standards.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          4. Cookies and Tracking
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We use cookies and the Google Advertising ID to personalize content and analyze traffic.  
          You can disable cookies in browser settings or reset your Advertising ID in your Android device settings.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          5. Data Deletion Rights
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          You have the right to access, update, or delete your personal data at any time. To request account or data deletion, please contact us at <span className="font-semibold text-indigo-600 dark:text-indigo-400">oreblogda@gmail.com</span> or through our contact page. We will process your request within 48 hours.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          6. Security
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We take reasonable measures to protect your personal information, including encryption in transit. However, no method of transmission over the Internet is 100% secure.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          7. Updates to This Policy
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We may update this Privacy Policy occasionally. The date at the top will always indicate the latest version.
        </p>

        <p className="text-gray-700 dark:text-gray-300 mt-10 text-center border-t border-gray-200 dark:border-gray-800 pt-6">
          Questions? Contact our Safety Team:  
          <span className="font-semibold text-indigo-600 dark:text-indigo-400 block"> oreblogda@gmail.com</span>
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;