import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

export default function HeroPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://cbitkolar.edu.in/wp-content/uploads/2025/07/01-4.jpg')",
        }}
      >
        {/* Dark Overlay with Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/85 to-slate-900/95" />
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header/Nav */}
        <header className={`w-full py-4 px-6 flex items-center justify-between transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="flex items-center gap-3">
            <img
              src="/copslogo.png"
              alt="COPS Logo"
              className="w-10 h-10 object-contain animate-float"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            <span className="text-white font-bold text-lg tracking-wide hidden sm:block">
              C BYREGOWDA INSTITUTE OF TECHNOLOGY
            </span>
          </div>
          <div className="glass px-4 py-2 rounded-full">
            <span className="text-blue-400 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              CLUB OF PROGRAMMERS (COPS)
            </span>
          </div>
        </header>

        {/* Hero Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          {/* Main Heading */}
          <div className={`text-center max-w-4xl transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
              Automated Faculty
              <br />
              <span className="gradient-text">Evaluation System</span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className={`text-gray-300 text-center mt-6 max-w-xl text-base sm:text-lg leading-relaxed transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            A student-led initiative at C Byregowda Institute of Technology,
            focused on improving teaching quality through anonymous,
            secure feedback.
          </p>

          {/* CTA Buttons */}
          <div className={`mt-10 flex flex-col sm:flex-row gap-4 w-full max-w-md px-4 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <Link
              to="/login"
              className="btn-glow flex-1 text-center py-4 px-8 rounded-full font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 flex items-center justify-center gap-2"
            >
              Login as Student
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/admin/login"
              className="flex-1 text-center py-4 px-8 rounded-full font-semibold text-white glass hover:bg-white/20 transition-all duration-300 hover:scale-105"
            >
              Login as Admin
            </Link>
          </div>

          {/* Register Link */}
          <p className={`text-gray-400 mt-6 text-sm transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            New student?{" "}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors">
              Register here
            </Link>
          </p>
        </main>

        {/* Stats Section */}
        <section className={`w-full px-4 pb-8 transition-all duration-700 delay-600 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Stat Card 1 */}
            <div className="glass-dark rounded-2xl p-6 hover:bg-slate-800/60 transition-all duration-300 hover:scale-105 group cursor-default">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white">100%</h3>
              <p className="text-gray-400 text-sm">Anonymous & Secure</p>
            </div>

            {/* Stat Card 2 */}
            <div className="glass-dark rounded-2xl p-6 hover:bg-slate-800/60 transition-all duration-300 hover:scale-105 group cursor-default">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white">One-Click</h3>
              <p className="text-gray-400 text-sm">Submit Feedback</p>
            </div>

            {/* Stat Card 3 */}
            <div className="glass-dark rounded-2xl p-6 hover:bg-slate-800/60 transition-all duration-300 hover:scale-105 group cursor-default">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white">Semester-wise</h3>
              <p className="text-gray-400 text-sm">Evaluation Cycles</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={`w-full py-4 text-center text-gray-500 text-xs transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <p>Built with ❤️ by <span className="text-blue-400">Club of Programmers</span> • CBIT Kolar</p>
        </footer>
      </div>
    </div>
  );
}
