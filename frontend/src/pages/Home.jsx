import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/5 rounded-full blur-3xl" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl animate-slide-up">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
          Full-Stack Application
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          <span className="text-white">Visualize Your</span>
          <br />
          <span className="gradient-text">Database Schema</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed text-balance">
          A powerful full-stack application built with React, Spring Boot, and MySQL.
          Explore, query, and visualize your database in real time.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link to="/dashboard" className="btn-primary text-lg px-8 py-4">
            Open Dashboard
            <svg className="inline-block w-5 h-5 ml-2 -mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="btn-outline text-lg px-8 py-4">
            View Source
          </a>
        </div>

        {/* Tech Stack Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { name: 'React', icon: '⚛️', desc: 'Frontend UI' },
            { name: 'Spring Boot', icon: '🍃', desc: 'Backend API' },
            { name: 'MySQL', icon: '🐬', desc: 'Database' },
            { name: 'Tailwind CSS', icon: '🎨', desc: 'Styling' },
          ].map((tech, i) => (
            <div
              key={tech.name}
              className="glass-card-hover p-5 text-center animate-fade-in"
              style={{ animationDelay: `${0.1 * (i + 1)}s` }}
            >
              <div className="text-3xl mb-2">{tech.icon}</div>
              <div className="text-sm font-semibold text-white">{tech.name}</div>
              <div className="text-xs text-gray-500 mt-1">{tech.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
