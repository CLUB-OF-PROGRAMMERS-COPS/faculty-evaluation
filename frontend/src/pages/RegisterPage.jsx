import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerStudent, fetchSectionsByBatch, fetchRegistrationStatus } from "../api";
import toast from "react-hot-toast";

// Extract batch year from USN (e.g., "1CK23CS020" → "2023")
function parseBatchFromUSN(usn) {
  const match = usn.match(/[A-Za-z]{2,4}(\d{2})/);
  if (match) {
    return `20${match[1]}`;
  }
  return null;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    usn: "",
    password: "",
    confirm_password: "",
    section_id: "",
    registration_code: "",
  });
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [detectedBatch, setDetectedBatch] = useState(null);
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Registration gate state
  const [regStatus, setRegStatus] = useState({ registration_open: true, requires_code: false });
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Check if registration is open
    fetchRegistrationStatus()
      .then(({ data }) => setRegStatus(data))
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  // When USN changes, detect batch and fetch sections
  useEffect(() => {
    const batch = parseBatchFromUSN(form.usn);
    setDetectedBatch(batch);
    
    if (batch) {
      setLoadingSections(true);
      fetchSectionsByBatch(batch)
        .then(({ data }) => {
          setSections(data);
          // Reset section_id if current selection is not in new batch
          if (data.length > 0 && !data.find(s => s.id === Number(form.section_id))) {
            setForm(f => ({ ...f, section_id: "" }));
          }
        })
        .catch(() => {
          setSections([]);
        })
        .finally(() => setLoadingSections(false));
    } else {
      setSections([]);
    }
  }, [form.usn]);

  const set = (field) => (e) =>
    setForm((f) => ({
      ...f,
      [field]: field === "usn" ? e.target.value.toUpperCase() : e.target.value,
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!form.section_id) {
      toast.error("Please select a section.");
      return;
    }
    setLoading(true);
    try {
      await registerStudent({
        ...form,
        section_id: Number(form.section_id),
      });
      toast.success("Registration successful! Please log in.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://cbitkolar.edu.in/wp-content/uploads/2025/07/01-4.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/85 to-slate-900/95" />
      </div>

      {/* Animated Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className={`w-full max-w-sm glass-dark rounded-3xl p-8 transition-all duration-700 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-float">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-white mb-1">
            Create Account
          </h1>
          <p className="text-sm text-center text-gray-400 mb-6">
            Register for evaluation portal
          </p>

          {/* Registration Closed Banner */}
          {!loadingStatus && !regStatus.registration_open ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Registration Closed</h2>
              <p className="text-gray-400 text-sm mb-6">
                Registration is currently not available. Please contact your HOD or admin to open registration.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-all"
              >
                Already registered? Login
              </Link>
            </div>
          ) : loadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-purple-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* USN Input */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">USN</label>
                <input
                  type="text"
                  value={form.usn}
                  onChange={set("usn")}
                  placeholder="1CK23CS020"
                  required
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:outline-none transition-all"
                />
                {/* Detected Batch Badge */}
                {detectedBatch && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Batch {detectedBatch} detected
                    </span>
                  </div>
                )}
              </div>

              {/* Section Dropdown */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Section</label>
                {!detectedBatch ? (
                  <div className="w-full bg-slate-800/30 border border-slate-600/30 rounded-xl px-4 py-3 text-gray-500 text-sm">
                    Enter USN to see available sections
                  </div>
                ) : loadingSections ? (
                  <div className="w-full bg-slate-800/30 border border-slate-600/30 rounded-xl px-4 py-3 text-gray-400 text-sm flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading sections...
                  </div>
                ) : sections.length === 0 ? (
                  <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-400 text-sm">
                    No sections found for Batch {detectedBatch}. Contact admin.
                  </div>
                ) : (
                  <select
                    value={form.section_id}
                    onChange={set("section_id")}
                    required
                    className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:outline-none transition-all appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '20px',
                    }}
                  >
                    <option value="" className="bg-slate-800">Select Section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id} className="bg-slate-800">
                        Section {section.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Registration Code (only if required) */}
              {regStatus.requires_code && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">
                    Registration Code
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.registration_code}
                      onChange={set("registration_code")}
                      placeholder="Enter code provided by HOD"
                      required
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 pl-10 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:outline-none transition-all"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Ask your HOD/admin for this code</p>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:outline-none transition-all"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Confirm Password</label>
                <input
                  type="password"
                  value={form.confirm_password}
                  onChange={set("confirm_password")}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !form.section_id}
                className="btn-glow w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white py-3 rounded-xl font-semibold hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account...
                  </span>
                ) : "Register"}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-700/50 space-y-3">
            <p className="text-sm text-center text-gray-400">
              Already registered?{" "}
              <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Login here
              </Link>
            </p>
            <p className="text-xs text-center">
              <Link to="/" className="text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
