import { useState } from "react";
import { CheckCircleIcon } from "./Icons";

const LIKERT_OPTIONS = [5, 4, 3, 2, 1];

const RATING_LABELS = {
  5: "Excellent",
  4: "Good",
  3: "Above Average",
  2: "Below Average",
  1: "Poor",
};

const CYAN_STYLE = {
  selected: "bg-[#00FFFF] text-black shadow-lg shadow-cyan-500/25 scale-105",
  hover: "hover:bg-[#00FFFF] hover:text-black hover:border-[#00FFFF]"
};

const RATING_COLORS = {
  5: CYAN_STYLE,
  4: CYAN_STYLE,
  3: CYAN_STYLE,
  2: CYAN_STYLE,
  1: CYAN_STYLE,
};

const CRITERIA_LABELS = [
  "Preparation for class & Subject Knowledge",
  "Command over the subject",
  "Control of the class",
  "Syllabus Coverage",
  "Availability to solve problems",
  "Punctuality",
  "Impartiality in evaluating I.A Marks",
  "Teacher legibly writes/draws on board & communication",
  "Adequate notes provided",
  "Motivating Students",
];

/**
 * TeacherAccordion
 *
 * Mobile-first accordion card.
 * - Displays teacher name + subject as a horizontal bar.
 * - Expands to show the 10 Likert-scale questions.
 * - Shows a grey circle icon → green checkmark when all 10 are rated.
 *
 * Props:
 *   teacher   – { id, name, subject_name }
 *   scores    – { q1: number|null, …, q10: number|null }
 *   comments  – string
 *   onChange  – (teacherId, field, value) => void
 *   index     – position for staggered animation
 */
export default function TeacherAccordion({
  teacher,
  scores,
  comments,
  onChange,
  index = 0,
}) {
  const [open, setOpen] = useState(false);

  const answeredCount = Object.entries(scores).filter(
    ([k, v]) => k.startsWith("q") && v !== null && v !== undefined
  ).length;
  const isComplete = answeredCount === 10;

  return (
    <div 
      className="mb-3 transition-all duration-500"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* ── Header Bar ────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-300 group bg-white border ${
          isComplete
            ? "border-emerald-300 shadow-md shadow-emerald-100"
            : "border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
        }`}
      >
        <div className="flex items-center gap-3 text-left">
          {/* Status icon */}
          {isComplete ? (
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-200 transition-colors">
              <span className="text-gray-500 text-sm font-medium">{answeredCount}</span>
            </div>
          )}

          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">
              {teacher.subject_name}
            </p>
            <p className="text-xs text-gray-500">{teacher.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
            isComplete 
              ? "bg-emerald-100 text-emerald-700" 
              : "bg-gray-100 text-gray-500"
          }`}>
            {answeredCount}/10
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* ── Expanded Content ──────────────────────── */}
      <div className={`overflow-hidden transition-all duration-300 ${
        open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
      }`}>
        <div className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-5 space-y-5 shadow-sm">
          {/* Rating Scale Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500 bg-gray-50 rounded-xl py-2 px-3 border border-gray-100">
            {LIKERT_OPTIONS.map((val) => (
              <span key={val} className="flex items-center gap-1">
                <span className="font-bold text-gray-700">{val}</span>
                <span>= {RATING_LABELS[val]}</span>
              </span>
            ))}
          </div>

          {CRITERIA_LABELS.map((label, idx) => {
            const key = `q${idx + 1}`;
            return (
              <div key={key} className="group">
                <p className="text-sm text-gray-700 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 text-xs text-blue-700 font-semibold mr-2">
                    {idx + 1}
                  </span>
                  {label}
                </p>
                <div className="flex gap-2">
                  {LIKERT_OPTIONS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChange(teacher.id, key, val)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                        scores[key] === val
                          ? RATING_COLORS[val].selected
                          : `bg-gray-50 text-gray-500 border-gray-200 ${RATING_COLORS[val].hover}`
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-base">{val}</span>
                        <span className="text-[10px] font-medium leading-tight opacity-80 hidden sm:block">{RATING_LABELS[val]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Optional comment */}
          <div className="pt-2 border-t border-gray-200">
            <label className="block text-sm text-gray-600 mb-2">
              Comments (optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) =>
                onChange(teacher.id, "comments", e.target.value)
              }
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:outline-none transition-all resize-none"
              placeholder="Any additional feedback…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
