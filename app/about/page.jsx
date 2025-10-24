"use client";
import React from "react";

const AboutPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-linear-to-br from-pink-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors duration-500 relative overflow-hidden">
      
      {/* Subtle glowing circles for anime aesthetic */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-indigo-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      <div className="max-w-3xl text-center relative z-10">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          About AniVerse
        </h1>

        <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 mb-6">
          Welcome to <span className="font-semibold text-indigo-600 dark:text-indigo-400">AniVerse</span> — your chill corner for everything anime, manga, and otaku culture! 🎌  
          From the latest news and episode breakdowns to fun facts and
          underrated recommendations, we keep you updated on what’s hot in the anime world.
        </p>

        <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 mb-6">
          Whether you’re deep into shōnen battles, slice-of-life stories, or just here for 
          the memes — we’ve got you covered. Our mission is simple: 
          to make anime news fun, honest, and worth your time.
        </p>

        <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
          We’re fans first — writers second.  
          So grab your snacks 🍿, power up your Wi-Fi, and join the AniVerse community.  
          Stay tuned, stay hyped, and never skip the opening song!
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
