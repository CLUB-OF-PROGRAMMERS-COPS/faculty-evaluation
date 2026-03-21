import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import html2canvas from "html2canvas";
import { fetchAdminReport, fetchAdminSections, fetchAdminTeachers, fetchFeedbackDetails } from "../api";
import toast from "react-hot-toast";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

export default function AdminReportsPage() {
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedGraphKey, setSelectedGraphKey] = useState("");
  
  // Filters
  const [filterSection, setFilterSection] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return; // Don't call loadData if no token
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportRes, sectionsRes, teachersRes] = await Promise.all([
        fetchAdminReport(),
        fetchAdminSections(),
        fetchAdminTeachers(),
      ]);
      setReport(reportRes.data.report || []);
      setSections(sectionsRes.data);
      setTeachers(teachersRes.data);
    } catch (err) {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  };

  // Filter report data
  const filteredReport = report.filter((row) => {
    if (filterSection && row.section_id !== Number(filterSection)) return false;
    if (filterTeacher && row.teacher_id !== Number(filterTeacher)) return false;
    return true;
  });

  useEffect(() => {
    if (filteredReport.length === 0) {
      setSelectedGraphKey("");
      return;
    }

    const exists = filteredReport.some(
      (r) => `${r.teacher_id}-${r.section_id}-${r.batch_id}` === selectedGraphKey
    );

    if (!exists) {
      const first = filteredReport[0];
      setSelectedGraphKey(`${first.teacher_id}-${first.section_id}-${first.batch_id}`);
    }
  }, [filteredReport, selectedGraphKey]);

  const selectedGraphRow = filteredReport.find(
    (r) => `${r.teacher_id}-${r.section_id}-${r.batch_id}` === selectedGraphKey
  );

  // Calculate overall average
  const overallAvg = filteredReport.length > 0
    ? (filteredReport.reduce((sum, r) => sum + r.overall_avg, 0) / filteredReport.length).toFixed(2)
    : null;

  // Calculate overall percentage
  const overallPercentage = filteredReport.length > 0
    ? (filteredReport.reduce((sum, r) => sum + r.total_percentage, 0) / filteredReport.length).toFixed(3)
    : null;

  // Download CSV - Individual student feedback entries per teacher
  const downloadCSV = async () => {
    if (filteredReport.length === 0) {
      toast.error("No data to download");
      return;
    }

    try {
      toast.loading("Fetching feedback details...", { id: "csv-loading" });
      const res = await fetchFeedbackDetails();
      const allFeedback = res.data.feedback || [];
      toast.dismiss("csv-loading");

      if (allFeedback.length === 0) {
        toast.error("No feedback data found");
        return;
      }

      // For each teacher in filtered report, create a CSV with individual student rows
      for (const row of filteredReport) {
        // Filter feedback for this teacher + section
        const teacherFeedback = allFeedback.filter(
          (f) => f.teacher_id === row.teacher_id && f.section_id === row.section_id
        );

        if (teacherFeedback.length === 0) continue;

        const headers = [
          "S.No",
          "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10",
          "Total (out of 50)",
          "Average",
          "Suggestion",
        ];

        const dataRows = teacherFeedback.map((f, idx) => [
          idx + 1,
          f.q1, f.q2, f.q3, f.q4, f.q5, f.q6, f.q7, f.q8, f.q9, f.q10,
          f.total,
          f.average,
          `"${(f.suggestion || "").replace(/"/g, '""')}"`, // Escape quotes in suggestion
        ]);

        // Add summary row
        const summaryRow = [
          "TOTAL",
          row.q1_total, row.q2_total, row.q3_total, row.q4_total, row.q5_total,
          row.q6_total, row.q7_total, row.q8_total, row.q9_total, row.q10_total,
          "", "", "",
        ];
        const avgRow = [
          "AVERAGE",
          row.q1_avg.toFixed(2), row.q2_avg.toFixed(2), row.q3_avg.toFixed(2),
          row.q4_avg.toFixed(2), row.q5_avg.toFixed(2), row.q6_avg.toFixed(2),
          row.q7_avg.toFixed(2), row.q8_avg.toFixed(2), row.q9_avg.toFixed(2),
          row.q10_avg.toFixed(2),
          "", row.overall_avg.toFixed(2), "",
        ];

        const csvLines = [
          `Teacher: ${row.teacher_name}`,
          `Subject: ${row.subject_name}`,
          `Section: ${row.section_name}`,
          `Batch: ${row.batch_name}`,
          `Total Responses: ${row.total_responses}`,
          "",
          headers.join(","),
          ...dataRows.map((r) => r.join(",")),
          "",
          summaryRow.join(","),
          avgRow.join(","),
          "",
          "Question-wise Average Data (for graph plotting)",
          "Question,Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8,Q9,Q10",
          `Average Rating,${row.q1_avg.toFixed(2)},${row.q2_avg.toFixed(2)},${row.q3_avg.toFixed(2)},${row.q4_avg.toFixed(2)},${row.q5_avg.toFixed(2)},${row.q6_avg.toFixed(2)},${row.q7_avg.toFixed(2)},${row.q8_avg.toFixed(2)},${row.q9_avg.toFixed(2)},${row.q10_avg.toFixed(2)}`,
          "Y-Axis Range,1,2,3,4,5",
          "",
          `Overall Percentage: ${row.total_percentage.toFixed(2)}%`,
        ];

        const csvContent = "data:text/csv;charset=utf-8," + csvLines.join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${row.subject_name}-${row.teacher_name}_${row.section_name}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success("Report(s) downloaded!");
    } catch (err) {
      toast.dismiss("csv-loading");
      toast.error("Failed to download CSV");
      console.error(err);
    }
  };

  // Download single combined CSV with all individual student feedback
  const downloadCombinedCSV = async () => {
    if (filteredReport.length === 0) {
      toast.error("No data to download");
      return;
    }

    try {
      toast.loading("Fetching feedback details...", { id: "csv-loading" });
      const res = await fetchFeedbackDetails();
      const allFeedback = res.data.feedback || [];
      toast.dismiss("csv-loading");

      if (allFeedback.length === 0) {
        toast.error("No feedback data found");
        return;
      }

      // Filter feedback based on current filters
      let filteredFeedback = allFeedback;
      if (filterSection) {
        filteredFeedback = filteredFeedback.filter(
          (f) => f.section_id === parseInt(filterSection)
        );
      }
      if (filterTeacher) {
        filteredFeedback = filteredFeedback.filter(
          (f) => f.teacher_id === parseInt(filterTeacher)
        );
      }

      const headers = [
        "Teacher",
        "Subject",
        "Section",
        "Batch",
        "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10",
        "Total (out of 50)",
        "Average",
        "Suggestion",
      ];

      const rows = filteredFeedback.map((f) => [
        f.teacher_name,
        f.subject_name,
        f.section_name,
        f.batch_name,
        f.q1, f.q2, f.q3, f.q4, f.q5, f.q6, f.q7, f.q8, f.q9, f.q10,
        f.total,
        f.average,
        `"${(f.suggestion || "").replace(/"/g, '""')}"`,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `faculty_evaluation_feedback_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Combined report downloaded!");
    } catch (err) {
      toast.dismiss("csv-loading");
      toast.error("Failed to download CSV");
      console.error(err);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 4) return "text-emerald-600";
    if (score >= 3) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBg = (score) => {
    if (score >= 4) return "bg-emerald-50";
    if (score >= 3) return "bg-amber-50";
    return "bg-red-50";
  };

  const buildQuestionSeries = (row) => {
    if (!row) return [];
    return Array.from({ length: 10 }, (_, idx) => {
      const q = idx + 1;
      return {
        label: `Q${q}`,
        value: Number(row[`q${q}_avg`] || 0),
      };
    });
  };

  const downloadGraph = () => {
    if (!chartRef.current) {
      toast.error("Chart not available.");
      return;
    }

    html2canvas(chartRef.current.canvas.parentNode, {
      backgroundColor: "#ffffff",
      scale: 2,
    }).then((canvas) => {
      const link = document.createElement("a");
      link.download = `teacher-performance-graph.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Graph downloaded!");
    });
  };

  const chartData = {
    labels: buildQuestionSeries(selectedGraphRow).map(s => s.label),
    datasets: [
      {
        label: "Average Rating",
        data: buildQuestionSeries(selectedGraphRow).map(s => s.value),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `Question-wise Average Ratings`,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: {
          top: 10,
          bottom: 30,
        }
      },
      datalabels: {
        anchor: 'end',
        align: 'top',
        formatter: (value) => {
          return value.toFixed(2);
        },
        font: {
          weight: 'bold',
          size: 12,
        },
        color: '#374151'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5.5,
        ticks: {
          stepSize: 1,
        },
        grid: {
          color: 'rgba(200, 200, 200, 0.2)',
        }
      },
      x: {
        grid: {
          display: false,
        }
      }
    },
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50">
      {/* Subtle Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-cyan-50/20 to-gray-50" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-80 h-80 bg-cyan-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 min-h-screen">
        <header className="border-b border-gray-200 bg-white/90 backdrop-blur-lg sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/admin/dashboard" className="text-gray-400 hover:text-gray-900 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Evaluation Reports</h1>
              </div>
              <button
                onClick={logout}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className={`bg-white rounded-2xl p-6 mb-6 border border-gray-100 shadow-sm transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2 font-medium">Filter by Section</label>
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:outline-none transition-all"
                  >
                    <option value="">All Sections</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Section {s.name} (Batch {s.batch_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2 font-medium">Filter by Teacher</label>
                  <select
                    value={filterTeacher}
                    onChange={(e) => setFilterTeacher(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:outline-none transition-all"
                  >
                    <option value="">All Teachers</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subject_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="px-5 py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center gap-2 border border-gray-200"
                >
                  <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <button
                  onClick={downloadCSV}
                  disabled={filteredReport.length === 0}
                  className="px-5 py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center gap-2 border border-gray-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Individual CSVs
                </button>
                <button
                  onClick={downloadCombinedCSV}
                  disabled={filteredReport.length === 0}
                  className="px-5 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Combined CSV
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {overallAvg && (
            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 transition-all duration-500 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="bg-white rounded-2xl p-4 text-center border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-105">
                <p className="text-2xl font-bold text-gray-900">{filteredReport.length}</p>
                <p className="text-xs text-gray-500 mt-1">Total Reports</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border border-blue-100 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-105">
                <p className="text-2xl font-bold text-blue-600">{filteredReport.reduce((sum, r) => sum + r.total_responses, 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Total Responses</p>
              </div>
              <div className={`bg-white rounded-2xl p-4 text-center border shadow-sm transition-all duration-300 hover:shadow-md hover:scale-105 ${Number(overallAvg) >= 4 ? 'border-emerald-100' : Number(overallAvg) >= 3 ? 'border-amber-100' : 'border-red-100'}`}>
                <p className={`text-2xl font-bold ${getScoreColor(Number(overallAvg))}`}>{overallAvg}</p>
                <p className="text-xs text-gray-500 mt-1">Overall Avg</p>
              </div>
              <div className={`bg-white rounded-2xl p-4 text-center border shadow-sm transition-all duration-300 hover:shadow-md hover:scale-105 ${Number(overallPercentage) >= 80 ? 'border-emerald-100' : Number(overallPercentage) >= 60 ? 'border-amber-100' : 'border-red-100'}`}>
                <p className={`text-2xl font-bold ${Number(overallPercentage) >= 80 ? 'text-emerald-600' : Number(overallPercentage) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{overallPercentage}%</p>
                <p className="text-xs text-gray-500 mt-1">Percentage</p>
              </div>
            </div>
          )}

          {/* Teacher Individual Graph */}
          {filteredReport.length > 0 && (
            <div className={`bg-white rounded-2xl p-6 mb-6 border border-gray-100 shadow-sm transition-all duration-500 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800 mb-2 sm:mb-0">Teacher Individual Graph</h2>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <select
                    value={selectedGraphKey}
                    onChange={(e) => setSelectedGraphKey(e.target.value)}
                    className="w-full sm:w-72 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:outline-none transition-all text-sm"
                  >
                    {filteredReport.map((r) => (
                      <option key={`${r.teacher_id}-${r.section_id}-${r.batch_id}`} value={`${r.teacher_id}-${r.section_id}-${r.batch_id}`}>
                        {r.teacher_name} - {r.subject_name} ({r.section_name})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={downloadGraph}
                    className="p-2 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all border border-gray-200"
                    title="Download Graph"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>

              {selectedGraphRow ? (
                <div className="h-80 w-full">
                  <Bar ref={chartRef} data={chartData} options={chartOptions} />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>Select a teacher to view the graph.</p>
                </div>
              )}
            </div>
          )}

          {/* Report Table */}
          <div className={`bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span className="text-gray-500">Loading report...</span>
                </div>
              </div>
            ) : filteredReport.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Report Data</h3>
                <p className="text-gray-500 text-sm">
                  {report.length === 0
                    ? "No feedback has been submitted yet."
                    : "No data matches your current filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50">Section</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Teacher</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Subject</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Forms</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q1</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q2</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q3</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q4</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q5</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q6</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q7</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q8</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q9</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Q10</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-purple-600 uppercase">Avg</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-emerald-600 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReport.map((row, i) => {
                      return (
                        <tr
                          key={`${row.section_id}-${row.teacher_id}`}
                          className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors"
                          style={{ animationDelay: `${i * 30}ms` }}
                        >
                          <td className="px-3 py-3 sticky left-0 bg-white">
                            <span className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                              {row.section_name}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-gray-900 font-medium text-xs">{row.teacher_name}</span>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{row.subject_name}</td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                              {row.total_responses}
                            </span>
                          </td>
                          {/* Q1-Q10 Averages */}
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((q) => (
                            <td key={q} className={`px-3 py-3 text-center text-xs font-medium ${getScoreColor(row[`q${q}_avg`])}`}>
                              <div>{row[`q${q}_avg`].toFixed(2)}</div>
                              <div className="text-[10px] text-gray-400">({row[`q${q}_total`]})</div>
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(row.overall_avg)} ${getScoreBg(row.overall_avg)}`}>
                              {row.overall_avg.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(row.total_percentage / 20)} ${getScoreBg(row.total_percentage / 20)}`}>
                              {row.total_percentage.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className={`mt-6 flex flex-wrap justify-center gap-4 text-xs transition-all duration-500 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-gray-500">Excellent (4-5)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-gray-500">Good (3-4)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-500">Needs Improvement (&lt;3)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
