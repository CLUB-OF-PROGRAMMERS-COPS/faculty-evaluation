import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://your-render-service.onrender.com";
const USERS = Number(__ENV.USERS || 20);
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || "5m";
const SECTION_ID = Number(__ENV.SECTION_ID || 1);
const REGISTRATION_CODE = __ENV.REGISTRATION_CODE || "";
const STUDENT_PASSWORD = __ENV.STUDENT_PASSWORD || "pass1234";
const USN_PREFIX = __ENV.USN_PREFIX || "1CK";
const BATCH_YY = __ENV.BATCH_YY || "23";
const BRANCH = __ENV.BRANCH || "CS";

export const options = {
  scenarios: {
    classroom: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: USERS,
      maxDuration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.15"],
    http_req_duration: ["p(95)<2000"],
  },
};

function buildUsn() {
  const serial = String((__VU - 1) * 1000 + __ITER + 1).padStart(3, "0");
  return `${USN_PREFIX}${BATCH_YY}${BRANCH}${serial}`;
}

function scoreSet() {
  return {
    q1: 5,
    q2: 4,
    q3: 5,
    q4: 4,
    q5: 5,
    q6: 4,
    q7: 5,
    q8: 4,
    q9: 5,
    q10: 4,
  };
}

export default function () {
  const commonHeaders = { "Content-Type": "application/json" };
  const usn = buildUsn();

  const health = http.get(`${BASE_URL}/health`, { tags: { name: "health" } });
  check(health, {
    "health status 200": (r) => r.status === 200,
  });

  const regStatus = http.get(`${BASE_URL}/registration-status`, {
    tags: { name: "registration_status" },
  });
  check(regStatus, {
    "registration-status 200": (r) => r.status === 200,
  });

  let registrationOpen = false;
  try {
    registrationOpen = regStatus.json("registration_open") === true;
  } catch (e) {
    registrationOpen = false;
  }
  if (!registrationOpen) {
    return;
  }

  const registerPayload = JSON.stringify({
    usn,
    password: STUDENT_PASSWORD,
    confirm_password: STUDENT_PASSWORD,
    section_id: SECTION_ID,
    registration_code: REGISTRATION_CODE,
  });
  const regRes = http.post(`${BASE_URL}/register`, registerPayload, {
    headers: commonHeaders,
    tags: { name: "register" },
  });
  check(regRes, {
    "register success or duplicate": (r) => r.status === 201 || r.status === 409,
  });

  const loginPayload = JSON.stringify({ usn, password: STUDENT_PASSWORD });
  const loginRes = http.post(`${BASE_URL}/login`, loginPayload, {
    headers: commonHeaders,
    tags: { name: "login" },
  });
  const loginOk = check(loginRes, {
    "login status 200": (r) => r.status === 200,
  });
  if (!loginOk) {
    return;
  }

  const token = loginRes.json("access_token");
  const sectionId = Number(loginRes.json("section_id"));
  const batchId = Number(loginRes.json("batch_id"));
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const teachersRes = http.get(`${BASE_URL}/teachers?section_id=${sectionId}`, {
    headers: authHeaders,
    tags: { name: "teachers" },
  });
  const teachersOk = check(teachersRes, {
    "teachers status 200": (r) => r.status === 200,
  });
  if (!teachersOk) {
    return;
  }

  let teachers = [];
  try {
    teachers = teachersRes.json();
  } catch (e) {
    teachers = [];
  }
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return;
  }

  const ratings = teachers.map((t) => ({
    teacher_id: t.id,
    scores: scoreSet(),
    comments: "k6 classroom simulation",
  }));

  const submitPayload = JSON.stringify({
    section_id: sectionId,
    batch_id: batchId,
    ratings,
  });
  const submitRes = http.post(`${BASE_URL}/submit_feedback`, submitPayload, {
    headers: authHeaders,
    tags: { name: "submit_feedback" },
  });
  check(submitRes, {
    "submit success": (r) => r.status === 201,
  });

  sleep(0.2);
}
