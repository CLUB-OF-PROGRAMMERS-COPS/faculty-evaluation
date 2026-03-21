# Testing Pack

This folder contains a practical test setup for your deployed system.

## 1) Postman Collection

File: testing/postman/faculty-eval.postman_collection.json

What it includes:
- Public smoke checks
- Student register and login flow
- Fetch teachers (auth)
- Submit feedback (auth)
- Admin login

How to use:
1. Open Postman.
2. Import testing/postman/faculty-eval.postman_collection.json.
3. Create an Environment with:
   - baseUrl = your backend URL (example: https://your-render-service.onrender.com)
   - sectionId = valid section id
   - batchId = valid batch id
   - registrationCode = code from admin settings (or keep empty if not required)
   - studentPassword = any test password
   - adminUsername = your admin username
   - adminPassword = your admin password
4. Run the Public Smoke folder first.
5. Run the remaining requests one by one.

## 2) k6 Load Test

File: testing/k6/classroom-load.js

Purpose:
- Simulate realistic classroom traffic end-to-end.
- Flow per virtual student: registration -> login -> fetch teachers -> submit feedback.
- Check success rate and latency.

Run locally:
1. Install k6.
2. Run:

   k6 run testing/k6/classroom-load.js -e BASE_URL=https://your-render-service.onrender.com -e SECTION_ID=1 -e BATCH_YY=23

Optional env values:
- USERS (default 20) : total students to simulate
- VUS (default 10) : concurrent virtual users
- DURATION (default 5m) : maximum test time
- SECTION_ID (default 1) : section id used during registration
- BATCH_YY (default 23) : 2-digit year used in generated USN
- USN_PREFIX (default 1CK)
- BRANCH (default CS)
- STUDENT_PASSWORD (default pass1234)
- REGISTRATION_CODE (default empty)

Example:

   k6 run testing/k6/classroom-load.js -e BASE_URL=https://your-render-service.onrender.com -e USERS=30 -e VUS=15 -e DURATION=6m -e SECTION_ID=2 -e BATCH_YY=24 -e REGISTRATION_CODE=CBIT2026

## 3) GitHub Action (API Smoke)

File: .github/workflows/api-smoke.yml

What it does:
- Runs Postman smoke tests automatically using Newman.
- Triggered on push to main and manual workflow dispatch.

Required GitHub secret:
- API_BASE_URL (your Render backend URL)

Example value:
- https://your-render-service.onrender.com
