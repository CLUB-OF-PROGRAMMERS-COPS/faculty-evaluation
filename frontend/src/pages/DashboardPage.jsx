import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import TeacherAccordion from "../components/TeacherAccordion";
import { fetchTeachers, submitFeedback } from "../api";

/**
 * DashboardPage
 *
 * State Management:
 *   ratings = { [teacherId]: { q1: null…q10: null, comments: "" } }
 *
 * Validation:
 *   Submit button stays DISABLED until every teacher has all 10
 *   questions rated (totalAnswered === teachers.length * 10).
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const sectionId = Number(localStorage.getItem("section_id"));
  const batchId = Number(localStorage.getItem("batch_id"));
  const batchName = localStorage.getItem("batch_name");

  // If batch_id is missing (old login), force re-login
  useEffect(() => {
    if (!batchId) {
      toast.error("Session expired. Please log in again.");
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  }, [batchId, navigate]);

  const [teachers, setTeachers] = useState([]);
  const [ratings, setRatings] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ── Load teachers mapped to this section ──────────
  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const { data } = await fetchTeachers(sectionId);
        setTeachers(data);

        // Initialise empty score maps
        const init = {};
        data.forEach((t) => {
          init[t.id] = {
            q1: null, q2: null, q3: null, q4: null, q5: null,
            q6: null, q7: null, q8: null, q9: null, q10: null,
            comments: "",
          };
        });
        setRatings(init);
      } catch {
        toast.error("Failed to load teachers.");
      }
    })();
  }, [sectionId]);

  // ── Handle change from any accordion ──────────────
  const handleChange = useCallback((teacherId, field, value) => {
    setRatings((prev) => ({
      ...prev,
      [teacherId]: { ...prev[teacherId], [field]: value },
    }));
  }, []);

  // ── Validation: count rated questions across all teachers ─
  const totalAnswered = Object.values(ratings).reduce((sum, r) => {
    const answered = Object.entries(r).filter(
      ([k, v]) => k.startsWith("q") && v !== null && v !== undefined
    ).length;
    return sum + answered;
  }, 0);

  const totalRequired = teachers.length * 10;
  const isReady = totalRequired > 0 && totalAnswered === totalRequired;

  // Track how many teachers are fully rated
  const completedTeachers = Object.values(ratings).filter((r) => {
    return Object.entries(r).filter(
      ([k, v]) => k.startsWith("q") && v !== null && v !== undefined
    ).length === 10;
  }).length;

  const progressPercent = totalRequired > 0 ? Math.round((totalAnswered / totalRequired) * 100) : 0;

  // ── Submission ────────────────────────────────────
  const handleSubmit = async () => {
    if (!isReady) return;
    setSubmitting(true);

    // Derive batch_id — we pass batchName, backend resolves section_id + batch
    // For simplicity, we'll rely on section_id & let backend look up batch
    const ratingsPayload = teachers.map((t) => {
      const r = ratings[t.id];
      const scores = {};
      for (let i = 1; i <= 10; i++) scores[`q${i}`] = r[`q${i}`];
      return {
        teacher_id: t.id,
        scores,
        comments: r.comments || null,
      };
    });

    try {
      await submitFeedback({
        section_id: sectionId,
        batch_id: batchId,
        ratings: ratingsPayload,
      });
      toast.success("Feedback submitted!");
      localStorage.removeItem("token");
      navigate("/thank-you", { replace: true });
    } catch (err) {
      if (err.response?.status === 0 || !err.response) {
        toast.error("Connection failed — Retrying…");
      } else {
        toast.error(err.response?.data?.detail || "Submission failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-100/60 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-10 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-20 bg-white/90 backdrop-blur-lg border-b border-gray-200 px-4 py-4 transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Faculty Evaluation</h1>
            <p className="text-xs text-gray-500">
              Batch {batchName} · Section {sectionId}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{completedTeachers}/{teachers.length}</p>
            <p className="text-xs text-gray-500">Rated</p>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Teacher Accordions */}
      <div className={`relative z-10 px-4 mt-4 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {teachers.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-gray-500">Loading teachers...</p>
          </div>
        ) : (
          teachers.map((t, index) => (
            <TeacherAccordion
              key={t.id}
              teacher={t}
              scores={ratings[t.id] || {}}
              comments={ratings[t.id]?.comments || ""}
              onChange={handleChange}
              index={index}
            />
          ))
        )}
      </div>

      {/* Sticky Submit Button */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white/90 backdrop-blur-lg border-t border-gray-200 px-4 py-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isReady || submitting}
          className={`btn-glow w-full py-4 rounded-xl font-semibold text-sm transition-all ${
            isReady
              ? "bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting...
            </span>
          ) : isReady ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Submit Feedback
            </span>
          ) : (
            `Rate all teachers (${totalAnswered}/${totalRequired})`
          )}
        </button>
      </div>
    </div>
  );
}
