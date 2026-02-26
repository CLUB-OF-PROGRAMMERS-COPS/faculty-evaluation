import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request if available
api.interceptors.request.use((config) => {
  // Use admin_token for admin routes, otherwise use regular token
  const isAdminRoute = config.url?.includes("/admin");
  const token = isAdminRoute 
    ? localStorage.getItem("admin_token") 
    : localStorage.getItem("token");
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses - redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAdminRoute = error.config?.url?.includes("/admin");
      if (isAdminRoute) {
        localStorage.removeItem("admin_token");
        // Only redirect if we're in a browser context
        if (typeof window !== 'undefined' && !window.location.pathname.includes("/admin/login")) {
          window.location.href = "/admin/login";
        }
      } else {
        localStorage.removeItem("token");
        if (typeof window !== 'undefined' && !window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────

export const registerStudent = (data) => api.post("/register", data);

export const loginStudent = (data) => api.post("/login", data);

// ── Teachers ──────────────────────────────────────────

export const fetchTeachers = (sectionId) =>
  api.get("/teachers", { params: { section_id: sectionId } });

// ── Criteria ──────────────────────────────────────────

export const fetchCriteria = () => api.get("/criteria");

// ── Feedback ──────────────────────────────────────────

export const submitFeedback = (payload) =>
  api.post("/submit_feedback", payload);

// ── Admin ─────────────────────────────────────────────

export const adminLogin = (data) => api.post("/admin/login", data);

export const fetchAdminStats = () => api.get("/admin/stats");

export const resetSemester = (confirmation) =>
  api.post("/admin/reset_semester", { confirmation });

// ── Public: Batches & Sections (for registration) ─────

export const fetchBatches = () => api.get("/batches");

export const fetchSectionsByBatch = (batchName) =>
  api.get(`/batches/${batchName}/sections`);

// ── Admin: Batch CRUD ─────────────────────────────────

export const fetchAdminBatches = () => api.get("/admin/batches");

export const createBatch = (data) => api.post("/admin/batches", data);

export const deleteBatch = (batchId) => api.delete(`/admin/batches/${batchId}`);

// ── Admin: Section CRUD ───────────────────────────────

export const fetchAdminSections = () => api.get("/admin/sections");

export const createSection = (data) => api.post("/admin/sections", data);

export const deleteSection = (sectionId) =>
  api.delete(`/admin/sections/${sectionId}`);

// ── Admin: Teacher CRUD ───────────────────────────────

export const fetchAdminTeachers = () => api.get("/admin/teachers");

export const createTeacher = (data) => api.post("/admin/teachers", data);

export const updateTeacher = (teacherId, data) =>
  api.put(`/admin/teachers/${teacherId}`, data);

export const deleteTeacher = (teacherId) =>
  api.delete(`/admin/teachers/${teacherId}`);

// ── Admin: Section-Teacher Mapping ────────────────────

export const mapTeacherToSection = (data) =>
  api.post("/admin/section-teacher-map", data);

export const unmapTeacherFromSection = (data) =>
  api.delete("/admin/section-teacher-map", { data });

// ── Admin: Reports ────────────────────────────────────

export const fetchAdminReport = () => api.get("/admin/report");

export const fetchFeedbackDetails = () => api.get("/admin/feedback-details");

// ── Admin: Registration Settings ──────────────────────

export const fetchRegistrationSettings = () =>
  api.get("/admin/registration-settings");

export const updateRegistrationSettings = (data) =>
  api.put("/admin/registration-settings", data);

// ── Public: Registration Status ───────────────────────

export const fetchRegistrationStatus = () =>
  api.get("/registration-status");

export default api;
