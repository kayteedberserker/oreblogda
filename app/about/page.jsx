"use client";
import React from "react";

const AboutPage = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-6 py-16 bg-linear-to-br from-pink-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors duration-500 relative overflow-hidden">
      
      {/* Subtle glowing circles for anime & gaming aesthetic */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-indigo-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      <div className="max-w-3xl text-center relative z-10">
        <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          About Oreblogda
        </h1>

        <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 mb-6">
          Welcome to{" "}
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            Oreblogda
          </span>{" "}
          — your chill corner for everything anime, gaming, and pop culture 🎮🎌  
          From anime episode breakdowns and manga highlights to game updates,
          reviews, and community takes, we cover what fans actually care about.
        </p>

        <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 mb-6">
          Whether you’re grinding ranked matches, exploring open worlds,
          hyped for the next anime episode, or just here for memes and hot takes —
          you’re in the right place.  
          Our goal is simple: keep things fun, honest, and worth your scroll.
        </p>

        <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
          We’re fans first — writers second.  
          So grab your controller 🕹️, queue the next episode 🍿, and join the
          Oreblogda community.  
          Stay updated, stay competitive, and never miss a drop — in-game or on-screen.
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
