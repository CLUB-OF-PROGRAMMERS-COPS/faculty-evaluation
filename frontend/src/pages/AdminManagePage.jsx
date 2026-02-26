import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchAdminBatches,
  createBatch,
  deleteBatch,
  fetchAdminSections,
  createSection,
  deleteSection,
  fetchAdminTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  mapTeacherToSection,
  unmapTeacherFromSection,
} from "../api";
import toast from "react-hot-toast";

// Helper to extract error message from FastAPI validation errors
const getErrorMessage = (err, fallback) => {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map(e => e.msg || e.message).join(", ");
  }
  return fallback;
};

const TABS = [
  { id: "batches", label: "Batches", icon: "📚" },
  { id: "sections", label: "Sections", icon: "📂" },
  { id: "teachers", label: "Teachers", icon: "👨‍🏫" },
  { id: "mapping", label: "Mapping", icon: "🔗" },
];

export default function AdminManagePage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("batches");
  
  // Data states
  const [batches, setBatches] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newBatch, setNewBatch] = useState("");
  const [newSection, setNewSection] = useState({ name: "", batch_id: "" });
  const [newTeacher, setNewTeacher] = useState({ name: "", subject_name: "" });
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [mapping, setMapping] = useState({ section_id: "", teacher_id: "" });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
    }
  }, [navigate]);

  // Load data when tab changes (only if authenticated)
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      loadData();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "batches" || activeTab === "sections" || activeTab === "mapping") {
        const { data } = await fetchAdminBatches();
        setBatches(data);
      }
      if (activeTab === "sections" || activeTab === "mapping") {
        const { data } = await fetchAdminSections();
        setSections(data);
      }
      if (activeTab === "teachers" || activeTab === "mapping") {
        const { data } = await fetchAdminTeachers();
        setTeachers(data);
      }
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Batch handlers
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!newBatch.trim()) return;
    try {
      await createBatch({ name: newBatch.trim() });
      toast.success(`Batch ${newBatch} created!`);
      setNewBatch("");
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create batch"));
    }
  };

  const handleDeleteBatch = async (id, name) => {
    if (!confirm(`Delete batch "${name}"? This will also delete ALL sections, students, and feedback in this batch!`)) return;
    try {
      await deleteBatch(id);
      toast.success(`Batch ${name} deleted!`);
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete batch"));
    }
  };

  // Section handlers
  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!newSection.name.trim() || !newSection.batch_id) return;
    try {
      await createSection({ name: newSection.name, batch_id: Number(newSection.batch_id) });
      const batch = batches.find(b => b.id === Number(newSection.batch_id));
      toast.success(`Section ${newSection.name} created in batch ${batch?.name || newSection.batch_id}!`);
      setNewSection({ name: "", batch_id: "" });
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create section"));
    }
  };

  const handleDeleteSection = async (id, name) => {
    if (!confirm(`Delete section "${name}"?`)) return;
    try {
      await deleteSection(id);
      toast.success(`Section ${name} deleted!`);
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete section"));
    }
  };

  // Teacher handlers
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.name.trim() || !newTeacher.subject_name.trim()) return;
    try {
      await createTeacher(newTeacher);
      toast.success(`Teacher ${newTeacher.name} added!`);
      setNewTeacher({ name: "", subject_name: "" });
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to add teacher"));
    }
  };

  const handleUpdateTeacher = async (e) => {
    e.preventDefault();
    if (!editingTeacher) return;
    try {
      await updateTeacher(editingTeacher.id, {
        name: editingTeacher.name,
        subject_name: editingTeacher.subject_name,
      });
      toast.success("Teacher updated!");
      setEditingTeacher(null);
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update teacher"));
    }
  };

  const handleDeleteTeacher = async (id, name) => {
    if (!confirm(`Delete teacher "${name}"?`)) return;
    try {
      await deleteTeacher(id);
      toast.success(`Teacher ${name} deleted!`);
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete teacher"));
    }
  };

  // Mapping handlers
  const handleMapTeacher = async (e) => {
    e.preventDefault();
    if (!mapping.section_id || !mapping.teacher_id) return;
    try {
      await mapTeacherToSection({
        section_id: Number(mapping.section_id),
        teacher_id: Number(mapping.teacher_id),
      });
      toast.success("Teacher mapped to section!");
      setMapping({ section_id: "", teacher_id: "" });
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to map teacher"));
    }
  };

  const handleUnmapTeacher = async (sectionId, teacherId, sectionName, teacherName) => {
    if (!confirm(`Remove ${teacherName} from Section ${sectionName}?`)) return;
    try {
      await unmapTeacherFromSection({ section_id: sectionId, teacher_id: teacherId });
      toast.success("Teacher removed from section!");
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to unmap teacher"));
    }
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50">
      {/* Subtle Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-purple-50/20 to-gray-50" />

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white/90 backdrop-blur-lg sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/admin/dashboard" className="text-gray-400 hover:text-gray-900 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Manage System</h1>
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
          {/* Tabs */}
          <div className={`flex flex-wrap gap-2 mb-6 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                    : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Batches Tab */}
            {activeTab === "batches" && (
              <div className="space-y-6">
                {/* Create Batch Form */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-sm">📚</span>
                    Add New Batch
                  </h2>
                  <form onSubmit={handleCreateBatch} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newBatch}
                      onChange={(e) => setNewBatch(e.target.value)}
                      placeholder="Enter batch year (e.g., 2023)"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 focus:outline-none transition-all"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-semibold hover:from-purple-500 hover:to-purple-400 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                    >
                      Add Batch
                    </button>
                  </form>
                </div>

                {/* Batches List */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing Batches</h2>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
                    </div>
                  ) : batches.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No batches yet. Create one to get started!</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {batches.map((batch, i) => (
                        <div
                          key={batch.name}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between group hover:border-purple-300 hover:shadow-sm transition-all"
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          <div>
                            <h3 className="font-semibold text-gray-900">Batch {batch.name}</h3>
                            <p className="text-sm text-gray-500">{batch.sections?.length || 0} sections</p>
                          </div>
                          <button
                            onClick={() => handleDeleteBatch(batch.id, batch.name)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sections Tab */}
            {activeTab === "sections" && (
              <div className="space-y-6">
                {/* Create Section Form */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center text-sm">📂</span>
                    Add New Section
                  </h2>
                  <form onSubmit={handleCreateSection} className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={newSection.batch_id}
                      onChange={(e) => setNewSection({ ...newSection, batch_id: e.target.value })}
                      className="sm:w-40 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 focus:outline-none transition-all"
                    >
                      <option value="">Select Batch</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>Batch {b.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newSection.name}
                      onChange={(e) => setNewSection({ ...newSection, name: e.target.value.toUpperCase() })}
                      placeholder="Section name (e.g., A)"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 focus:outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!newSection.batch_id}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-xl font-semibold hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50 transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                    >
                      Add Section
                    </button>
                  </form>
                </div>

                {/* Sections List */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing Sections</h2>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
                    </div>
                  ) : sections.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No sections yet. Create a batch first, then add sections!</p>
                  ) : (
                    <div className="space-y-4">
                      {batches.map((batch) => {
                        const batchSections = sections.filter((s) => s.batch_id === batch.id);
                        if (batchSections.length === 0) return null;
                        return (
                          <div key={batch.name}>
                            <h3 className="text-sm font-medium text-gray-500 mb-2">Batch {batch.name}</h3>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              {batchSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between group hover:border-cyan-300 transition-all"
                                >
                                  <div>
                                    <span className="font-semibold text-gray-900">Section {section.name}</span>
                                    <p className="text-xs text-gray-500">{section.teachers?.length || 0} teachers</p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteSection(section.id, section.name)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Teachers Tab */}
            {activeTab === "teachers" && (
              <div className="space-y-6">
                {/* Create/Edit Teacher Form */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">👨‍🏫</span>
                    {editingTeacher ? "Edit Teacher" : "Add New Teacher"}
                  </h2>
                  <form onSubmit={editingTeacher ? handleUpdateTeacher : handleCreateTeacher} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={editingTeacher ? editingTeacher.name : newTeacher.name}
                      onChange={(e) =>
                        editingTeacher
                          ? setEditingTeacher({ ...editingTeacher, name: e.target.value })
                          : setNewTeacher({ ...newTeacher, name: e.target.value })
                      }
                      placeholder="Teacher name"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 focus:outline-none transition-all"
                    />
                    <input
                      type="text"
                      value={editingTeacher ? editingTeacher.subject_name : newTeacher.subject_name}
                      onChange={(e) =>
                        editingTeacher
                          ? setEditingTeacher({ ...editingTeacher, subject_name: e.target.value })
                          : setNewTeacher({ ...newTeacher, subject_name: e.target.value })
                      }
                      placeholder="Subject"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 focus:outline-none transition-all"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-semibold hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                      >
                        {editingTeacher ? "Update" : "Add Teacher"}
                      </button>
                      {editingTeacher && (
                        <button
                          type="button"
                          onClick={() => setEditingTeacher(null)}
                          className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all border border-gray-200"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Teachers List */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">All Teachers</h2>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
                    </div>
                  ) : teachers.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No teachers yet. Add one to get started!</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {teachers.map((teacher, i) => (
                        <div
                          key={teacher.id}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-4 group hover:border-emerald-300 hover:shadow-sm transition-all"
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{teacher.name}</h3>
                              <p className="text-sm text-emerald-600">{teacher.subject_name}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => setEditingTeacher(teacher)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mapping Tab */}
            {activeTab === "mapping" && (
              <div className="space-y-6">
                {/* Map Teacher Form */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-sm">🔗</span>
                    Map Teacher to Section
                  </h2>
                  <form onSubmit={handleMapTeacher} className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={mapping.section_id}
                      onChange={(e) => setMapping({ ...mapping, section_id: e.target.value })}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 focus:outline-none transition-all"
                    >
                      <option value="">Select Section</option>
                      {batches.map((batch) => (
                        <optgroup key={batch.name} label={`Batch ${batch.name}`}>
                          {sections
                            .filter((s) => s.batch_id === batch.id)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                Section {s.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                    <select
                      value={mapping.teacher_id}
                      onChange={(e) => setMapping({ ...mapping, teacher_id: e.target.value })}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 focus:outline-none transition-all"
                    >
                      <option value="">Select Teacher</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.subject_name})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!mapping.section_id || !mapping.teacher_id}
                      className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl font-semibold hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                    >
                      Map Teacher
                    </button>
                  </form>
                </div>

                {/* Current Mappings */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Mappings</h2>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
                    </div>
                  ) : sections.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No sections yet. Create batches and sections first!</p>
                  ) : (
                    <div className="space-y-6">
                      {batches.map((batch) => {
                        const batchSections = sections.filter((s) => s.batch_id === batch.id);
                        if (batchSections.length === 0) return null;
                        return (
                          <div key={batch.name}>
                            <h3 className="text-sm font-medium text-gray-500 mb-3 pb-2 border-b border-gray-200">
                              Batch {batch.name}
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {batchSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                                >
                                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-cyan-100 flex items-center justify-center text-xs">📂</span>
                                    Section {section.name}
                                  </h4>
                                  {section.teachers?.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">No teachers assigned</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {section.teachers?.map((teacher) => (
                                        <div
                                          key={teacher.id}
                                          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 group border border-gray-100"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-semibold">
                                              {teacher.name.charAt(0)}
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium text-gray-900">{teacher.name}</p>
                                              <p className="text-xs text-gray-500">{teacher.subject_name}</p>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => handleUnmapTeacher(section.id, teacher.id, section.name, teacher.name)}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
