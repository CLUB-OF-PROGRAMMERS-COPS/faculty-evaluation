import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchAdminStats, resetSemester, fetchRegistrationSettings, updateRegistrationSettings } from "../api";
import toast from "react-hot-toast";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Registration gate state
  const [regSettings, setRegSettings] = useState({ registration_open: false, registration_code: null });
  const [regCode, setRegCode] = useState("");
  const [savingReg, setSavingReg] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    loadStats();
    loadRegSettings();
  }, [navigate]);

  const loadRegSettings = async () => {
    try {
      const { data } = await fetchRegistrationSettings();
      setRegSettings(data);
      setRegCode(data.registration_code || "");
    } catch (err) {
      // silently fail - settings will just show defaults
    }
  };

  const handleToggleRegistration = async () => {
    setSavingReg(true);
    try {
      const { data } = await updateRegistrationSettings({
        registration_open: !regSettings.registration_open,
      });
      setRegSettings(data);
      toast.success(data.registration_open ? "Registration opened!" : "Registration closed!");
    } catch (err) {
      toast.error("Failed to update registration settings.");
    } finally {
      setSavingReg(false);
    }
  };

  const handleSaveRegCode = async () => {
    setSavingReg(true);
    try {
      const { data } = await updateRegistrationSettings({
        registration_code: regCode,
      });
      setRegSettings(data);
      setRegCode(data.registration_code || "");
      toast.success(regCode.trim() ? "Registration code updated!" : "Registration code removed!");
    } catch (err) {
      toast.error("Failed to update registration code.");
    } finally {
      setSavingReg(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await fetchAdminStats();
      setStats(data);
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        navigate("/admin/login", { replace: true });
      } else {
        toast.error("Failed to load stats.");
      }
    }
  };

  const handleReset = async () => {
    if (confirmText !== "DELETE-CONFIRM") {
      toast.error('Type "DELETE-CONFIRM" to proceed.');
      return;
    }
    setResetting(true);
    try {
      await resetSemester(confirmText);
      toast.success("Semester reset complete!");
      setShowReset(false);
      setConfirmText("");
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Reset failed.");
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-500">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const votingPercentage = stats.total_students > 0
    ? Math.round((stats.voted_students / stats.total_students) * 100)
    : 0;

  const statCards = [
    { label: "Total Students", value: stats.total_students, icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", gradient: "from-blue-500 to-blue-600", bg: "bg-blue-50", text: "text-blue-600", shadow: "shadow-blue-100" },
    { label: "Voted", value: stats.voted_students, icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", gradient: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50", text: "text-emerald-600", shadow: "shadow-emerald-100" },
    { label: "Pending", value: stats.total_students - stats.voted_students, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", gradient: "from-amber-500 to-orange-500", bg: "bg-amber-50", text: "text-amber-600", shadow: "shadow-amber-100" },
    { label: "Feedback Entries", value: stats.total_feedback, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", gradient: "from-purple-500 to-violet-600", bg: "bg-purple-50", text: "text-purple-600", shadow: "shadow-purple-100" },
    { label: "Teachers", value: stats.total_teachers, icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", gradient: "from-cyan-500 to-teal-600", bg: "bg-cyan-50", text: "text-cyan-600", shadow: "shadow-cyan-100" },
    { label: "Sections", value: stats.total_sections, icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", gradient: "from-pink-500 to-rose-600", bg: "bg-pink-50", text: "text-pink-600", shadow: "shadow-pink-100" },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50">
      {/* Subtle Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50" />

      {/* Subtle Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className={`bg-white/90 backdrop-blur-lg border-b border-gray-200 px-6 py-4 flex items-center justify-between transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center border border-blue-200">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Faculty Evaluation System</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </header>

        {/* Stats Grid */}
        <div className={`px-6 pt-6 grid grid-cols-2 md:grid-cols-3 gap-4 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {statCards.map((card, index) => (
            <div
              key={card.label}
              className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 group cursor-default`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 shadow-lg ${card.shadow} group-hover:scale-110 transition-transform`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Progress Card */}
        <div className={`px-6 mt-6 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-gray-900 font-semibold">Voting Progress</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{votingPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${votingPercentage}%` }}
              />
            </div>
            <p className="text-gray-500 text-sm mt-3">
              {stats.voted_students} of {stats.total_students} students have submitted feedback
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`px-6 mt-6 grid grid-cols-2 gap-4 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <Link
            to="/admin/manage"
            className="py-4 rounded-2xl font-semibold text-sm bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 hover:border-purple-300 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage System
          </Link>
          <Link
            to="/admin/reports"
            className="py-4 rounded-2xl font-semibold text-sm bg-white text-cyan-600 border border-cyan-200 hover:bg-cyan-50 hover:border-cyan-300 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Reports
          </Link>
        </div>

        {/* Registration Control Panel */}
        <div className={`px-6 mt-6 transition-all duration-700 delay-350 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-gray-900 font-semibold">Registration Control</p>
                <p className="text-gray-400 text-xs">Prevent misuse by controlling who can register</p>
              </div>
            </div>

            {/* Toggle Registration Open/Close */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 mb-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Student Registration</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {regSettings.registration_open
                    ? "Students can currently register"
                    : "Registration is closed — students cannot register"}
                </p>
              </div>
              <button
                onClick={handleToggleRegistration}
                disabled={savingReg}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  regSettings.registration_open ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    regSettings.registration_open ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Secret Registration Code */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Secret Registration Code</p>
              <p className="text-xs text-gray-400 mb-3">
                Set a code that students must enter to register. Share it verbally in class. Leave blank to allow registration without a code.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value)}
                  placeholder="e.g. COPS2026"
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500/30 focus:border-green-400 focus:outline-none transition-all"
                />
                <button
                  onClick={handleSaveRegCode}
                  disabled={savingReg}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-all"
                >
                  Save
                </button>
              </div>
              {regSettings.registration_code && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-medium">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Active code: {regSettings.registration_code}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reset Section */}
        <div className={`px-6 mt-6 pb-8 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {!showReset ? (
            <button
              onClick={() => setShowReset(true)}
              className="w-full py-4 rounded-2xl font-semibold text-sm bg-white text-red-500 border border-red-200 hover:bg-red-50 hover:border-red-300 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Reset Semester
            </button>
          ) : (
            <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-600 font-semibold">Danger Zone</p>
                  <p className="text-gray-400 text-xs">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                This will <span className="text-red-600 font-medium">permanently delete</span> ALL feedback data and reset student voting flags. Type <code className="bg-red-50 px-2 py-1 rounded text-red-600 border border-red-200">DELETE-CONFIRM</code> to proceed.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE-CONFIRM"
                className="w-full bg-gray-50 border border-red-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-400 focus:outline-none transition-all mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {resetting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Resetting...
                    </>
                  ) : "Confirm Reset"}
                </button>
                <button
                  onClick={() => {
                    setShowReset(false);
                    setConfirmText("");
                  }}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
