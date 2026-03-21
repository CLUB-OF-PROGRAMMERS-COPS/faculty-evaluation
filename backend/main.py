"""
main.py – FastAPI application entry-point.

Implements:
  • parse_usn()              – extract batch year from USN
  • POST /register           – create student account
  • POST /login              – authenticate, return JWT
  • GET  /teachers           – teachers for student's section
  • POST /submit_feedback    – atomic "all-or-nothing" submission
  • POST /admin/reset_semester – wipe feedback, keep accounts
  • GET  /health             – Docker healthcheck
"""

import os
import re
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import engine, get_db, Base
from models import (
    Admin,
    Batch,
    Section,
    SectionTeacherMap,
    Student,
    Teacher,
    FeedbackEntry,
    SystemSettings,
)
from schemas import (
    StudentRegister,
    StudentLogin,
    TokenResponse,
    FeedbackSubmission,
    ResetRequest,
    TeacherOut,
    AdminLogin,
    AdminTokenResponse,
    BatchCreate,
    BatchOut,
    BatchWithSections,
    SectionCreate,
    SectionOut,
    SectionWithTeachers,
    TeacherCreate,
    TeacherUpdate,
    SectionTeacherMapCreate,
    SectionTeacherMapDelete,
    RegistrationSettingsOut,
    RegistrationSettingsUpdate,
    RegistrationStatusOut,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_student,
    get_current_admin,
)

load_dotenv()

ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "DELETE-CONFIRM")

# ── CORS origins (production + local dev) ────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "")   # e.g. https://your-app.vercel.app
ALLOWED_ORIGINS = [
    "http://localhost:5173",        # Vite dev server
    "http://localhost:4173",        # Vite preview
    "http://127.0.0.1:5173",
]
if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL.rstrip("/"))

# ── 10 evaluation criteria (canonical) ──────────────────
EVALUATION_CRITERIA = [
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
]

EXPECTED_SCORE_KEYS = {f"q{i}" for i in range(1, 11)}

def get_settings(db: Session) -> SystemSettings:
    """Get or create the singleton settings row (id=1)."""
    settings = db.query(SystemSettings).filter(SystemSettings.id == 1).first()
    if not settings:
        settings = SystemSettings(id=1, registration_open=False, registration_code=None)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

# ── Lifespan ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


# ── Rate Limiter Setup ──────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Automated Faculty Evaluation System",
    version="1.0.0",
    lifespan=lifespan,
)

# Add rate limiter to app state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────────────────

def parse_usn(usn: str) -> str:
    """
    Extract the 2-digit batch year from a USN and return the full year.
    Example: '1CK23CS020' → '2023'

    USN pattern assumed: <college><2-digit-year><branch><roll>
    """
    match = re.search(r"[A-Za-z]{2,4}(\d{2})", usn)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid USN format – cannot extract batch year.",
        )
    year_short = match.group(1)
    return f"20{year_short}"


def _validate_scores(scores: dict) -> None:
    """Ensure the scores dict has exactly q1..q10 with values 1-5."""
    if set(scores.keys()) != EXPECTED_SCORE_KEYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"scores must contain exactly keys {sorted(EXPECTED_SCORE_KEYS)}",
        )
    for key, val in scores.items():
        if not isinstance(val, int) or val < 1 or val > 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Score '{key}' must be an integer between 1 and 5.",
            )


# ─────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/criteria")
def get_criteria():
    """Return the 10 evaluation criteria labels."""
    return {"criteria": EVALUATION_CRITERIA}


# ── Registration ────────────────────────────────────────

@app.get("/registration-status", response_model=RegistrationStatusOut)
def registration_status(db: Session = Depends(get_db)):
    """Public endpoint: tells frontend if registration is open and whether a code is needed."""
    settings = get_settings(db)
    return RegistrationStatusOut(
        registration_open=settings.registration_open,
        requires_code=bool(settings.registration_code),
    )

@app.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("60/hour")  # classroom-safe limit for burst student registrations
def register(request: Request, payload: StudentRegister, db: Session = Depends(get_db)):
    # ── Registration gate check ──
    settings = get_settings(db)
    if not settings.registration_open:
        raise HTTPException(
            status_code=403,
            detail="Registration is currently closed. Contact your admin/HOD.",
        )

    # ── Secret code check ──
    if settings.registration_code:
        if payload.registration_code.strip() != settings.registration_code.strip():
            raise HTTPException(
                status_code=403,
                detail="Invalid registration code. Contact your admin/HOD for the correct code.",
            )

    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    # Check USN uniqueness
    if db.query(Student).filter(Student.usn == payload.usn.upper()).first():
        raise HTTPException(status_code=409, detail="USN already registered.")

    # Validate section exists
    section = db.query(Section).filter(Section.id == payload.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")

    # Derive batch from USN
    batch_name = parse_usn(payload.usn)
    batch = db.query(Batch).filter(Batch.name == batch_name).first()
    if not batch:
        # Auto-create batch if it doesn't exist
        batch = Batch(name=batch_name)
        db.add(batch)
        db.flush()

    # Ensure section belongs to the derived batch
    if section.batch_id != batch.id:
        raise HTTPException(
            status_code=400,
            detail=f"Section does not belong to Batch {batch_name}.",
        )

    student = Student(
        usn=payload.usn.upper(),
        password_hash=hash_password(payload.password),
        section_id=payload.section_id,
    )
    db.add(student)
    db.commit()
    return {"message": "Registration successful.", "batch": batch_name}


# ── Login ───────────────────────────────────────────────

@app.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")  # Max 10 login attempts per IP per minute
def login(request: Request, payload: StudentLogin, db: Session = Depends(get_db)):
    student = (
        db.query(Student)
        .filter(Student.usn == payload.usn.upper())
        .first()
    )
    if not student or not verify_password(payload.password, student.password_hash):
        raise HTTPException(status_code=401, detail="Invalid USN or password.")

    section = db.query(Section).filter(Section.id == student.section_id).first()
    batch = db.query(Batch).filter(Batch.id == section.batch_id).first()

    token = create_access_token(data={"sub": student.usn, "sid": student.id})
    return TokenResponse(
        access_token=token,
        has_voted=student.has_voted,
        section_id=student.section_id,
        batch_id=batch.id,
        batch_name=batch.name,
    )


# ── Teachers for a section ──────────────────────────────

@app.get("/teachers", response_model=list[TeacherOut])
def get_teachers(
    section_id: int,
    db: Session = Depends(get_db),
    _student: Student = Depends(get_current_student),
):
    teacher_ids = (
        db.query(SectionTeacherMap.teacher_id)
        .filter(SectionTeacherMap.section_id == section_id)
        .all()
    )
    ids = [t[0] for t in teacher_ids]
    teachers = db.query(Teacher).filter(Teacher.id.in_(ids)).all()
    return teachers


# ── Submit Feedback (Atomic Transaction) ────────────────

@app.post("/submit_feedback", status_code=status.HTTP_201_CREATED)
@limiter.limit("120/hour")  # classroom-safe limit for submission bursts
def submit_feedback(
    request: Request,
    payload: FeedbackSubmission,
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    # Guard: already voted
    if student.has_voted:
        raise HTTPException(status_code=403, detail="You have already submitted feedback.")

    # Fetch expected teachers for this section
    expected_teacher_ids = {
        row[0]
        for row in db.query(SectionTeacherMap.teacher_id)
        .filter(SectionTeacherMap.section_id == payload.section_id)
        .all()
    }
    submitted_teacher_ids = {r.teacher_id for r in payload.ratings}

    # All-or-Nothing: must rate every assigned teacher
    if submitted_teacher_ids != expected_teacher_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You must rate ALL assigned teachers. Partial submissions are not allowed.",
        )

    # Validate each score dict
    for rating in payload.ratings:
        _validate_scores(rating.scores)

    # ── Atomic transaction ──────────────────────────────
    try:
        with db.begin_nested():
            for rating in payload.ratings:
                entry = FeedbackEntry(
                    teacher_id=rating.teacher_id,
                    section_id=payload.section_id,
                    batch_id=payload.batch_id,
                    scores=rating.scores,
                    comments=rating.comments,
                )
                db.add(entry)

            # Mark student as voted (anonymity: no student_id in FeedbackEntry)
            student.has_voted = True

        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Submission failed — rolled back. Please retry.",
        )

    return {"message": "Feedback submitted successfully."}


# ── Admin: Login ────────────────────────────────────────

@app.post("/admin/login", response_model=AdminTokenResponse)
@limiter.limit("5/minute")  # Max 5 admin login attempts per IP per minute
def admin_login(request: Request, payload: AdminLogin, db: Session = Depends(get_db)):
    # Query all admins and match with trimmed username (handles trailing spaces in DB)
    admins = db.query(Admin).all()
    admin = next((a for a in admins if a.username.strip() == payload.username.strip()), None)
    if not admin or admin.password_hash.strip() != payload.password:
        raise HTTPException(status_code=401, detail="Invalid admin credentials.")
    token = create_access_token(data={"sub": admin.username.strip(), "role": "admin"})
    return AdminTokenResponse(access_token=token)


# ── Admin: Dashboard Stats ──────────────────────────────

@app.get("/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    total_students = db.query(Student).count()
    voted_students = db.query(Student).filter(Student.has_voted == True).count()
    total_feedback = db.query(FeedbackEntry).count()
    total_teachers = db.query(Teacher).count()
    total_batches = db.query(Batch).count()
    total_sections = db.query(Section).count()
    return {
        "total_students": total_students,
        "voted_students": voted_students,
        "total_feedback": total_feedback,
        "total_teachers": total_teachers,
        "total_batches": total_batches,
        "total_sections": total_sections,
    }


# ── Admin: Reset Semester ───────────────────────────────

@app.post("/admin/reset_semester")
def reset_semester(
    payload: ResetRequest,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    if payload.confirmation != "DELETE-CONFIRM":
        raise HTTPException(status_code=403, detail="Invalid confirmation code. Type DELETE-CONFIRM.")

    try:
        # Wipe all feedback rows
        db.query(FeedbackEntry).delete()

        # Reset all student has_voted flags
        db.query(Student).update({Student.has_voted: False})

        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Reset failed — rolled back.",
        )

    return {"message": "Semester reset complete. All feedback purged; student accounts retained."}


# ─────────────────────────────────────────────────────────
# Admin: Registration Settings
# ─────────────────────────────────────────────────────────

@app.get("/admin/registration-settings", response_model=RegistrationSettingsOut)
def get_registration_settings(
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Admin-only: get current registration settings (including the secret code)."""
    return get_settings(db)


@app.put("/admin/registration-settings", response_model=RegistrationSettingsOut)
def update_registration_settings(
    payload: RegistrationSettingsUpdate,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Admin-only: toggle registration open/close and set/change the registration code."""
    settings = get_settings(db)

    if payload.registration_open is not None:
        settings.registration_open = payload.registration_open

    if payload.registration_code is not None:
        # Allow setting to empty string to remove code requirement
        settings.registration_code = payload.registration_code.strip() or None

    db.commit()
    db.refresh(settings)
    return settings


# ─────────────────────────────────────────────────────────
# Admin: Batch CRUD
# ─────────────────────────────────────────────────────────

@app.get("/batches", response_model=list[BatchOut])
def list_batches(db: Session = Depends(get_db)):
    """Public endpoint to list all batches (for registration dropdown)."""
    return db.query(Batch).order_by(Batch.name.desc()).all()


@app.get("/batches/{batch_name}/sections", response_model=list[SectionOut])
def get_sections_by_batch_name(batch_name: str, db: Session = Depends(get_db)):
    """Public endpoint to get sections for a specific batch (for registration)."""
    batch = db.query(Batch).filter(Batch.name == batch_name).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_name}' not found.")
    return db.query(Section).filter(Section.batch_id == batch.id).order_by(Section.name).all()


@app.get("/admin/batches", response_model=list[BatchWithSections])
def admin_list_batches(
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Admin endpoint to list all batches with their sections."""
    batches = db.query(Batch).order_by(Batch.name.desc()).all()
    result = []
    for batch in batches:
        sections = db.query(Section).filter(Section.batch_id == batch.id).all()
        result.append(BatchWithSections(
            id=batch.id,
            name=batch.name,
            is_active=batch.is_active,
            sections=[SectionOut(id=s.id, name=s.name, batch_id=s.batch_id) for s in sections]
        ))
    return result


@app.post("/admin/batches", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    existing = db.query(Batch).filter(Batch.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Batch '{payload.name}' already exists.")
    batch = Batch(name=payload.name)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@app.delete("/admin/batches/{batch_id}")
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    
    # Extract batch year pattern from batch name (e.g., "2024" -> "24", "2023" -> "23")
    batch_year = batch.name[-2:] if len(batch.name) >= 2 else batch.name
    
    # Get all section IDs in this batch first
    sections = db.query(Section).filter(Section.batch_id == batch_id).all()
    section_ids = [s.id for s in sections]
    
    # Cascade delete: feedback entries for this batch only
    db.query(FeedbackEntry).filter(FeedbackEntry.batch_id == batch_id).delete(synchronize_session=False)
    
    # Cascade delete: students whose USN contains the batch year pattern
    # USN format: 1CK24CS000 - where "24" is the batch year
    # Match pattern like '%24%' but more specifically at position 3-4 (0-indexed)
    # Using LIKE with the batch year pattern
    from sqlalchemy import func
    all_students = db.query(Student).all()
    students_to_delete = []
    for student in all_students:
        usn = student.usn.upper()
        # USN format: 1CK24CS000 - batch year is typically at position 3-4 (after college code)
        # Check if batch_year appears in the USN (position 3-4 typically)
        if len(usn) >= 5 and usn[3:5] == batch_year:
            students_to_delete.append(student.id)
    
    if students_to_delete:
        db.query(Student).filter(Student.id.in_(students_to_delete)).delete(synchronize_session=False)
    
    # Delete teacher mappings for each section
    for section in sections:
        db.query(SectionTeacherMap).filter(SectionTeacherMap.section_id == section.id).delete(synchronize_session=False)
    
    # Delete all sections in this batch
    db.query(Section).filter(Section.batch_id == batch_id).delete(synchronize_session=False)
    
    # Finally delete the batch
    db.delete(batch)
    db.commit()
    return {"message": f"Batch {batch.name} deleted with all related data (students with USN containing '{batch_year}')."}


# ─────────────────────────────────────────────────────────
# Admin: Section CRUD
# ─────────────────────────────────────────────────────────

@app.get("/admin/sections", response_model=list[SectionWithTeachers])
def admin_list_sections(
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Admin endpoint to list all sections with their mapped teachers."""
    sections = db.query(Section).all()
    result = []
    for section in sections:
        # Get batch name
        batch = db.query(Batch).filter(Batch.id == section.batch_id).first()
        batch_name = batch.name if batch else ""
        
        teacher_ids = [
            row[0] for row in 
            db.query(SectionTeacherMap.teacher_id)
            .filter(SectionTeacherMap.section_id == section.id).all()
        ]
        teachers = db.query(Teacher).filter(Teacher.id.in_(teacher_ids)).all() if teacher_ids else []
        result.append(SectionWithTeachers(
            id=section.id,
            name=section.name,
            batch_id=section.batch_id,
            batch_name=batch_name,
            teachers=[TeacherOut(id=t.id, name=t.name, subject_name=t.subject_name) for t in teachers]
        ))
    return result


@app.post("/admin/sections", response_model=SectionOut, status_code=status.HTTP_201_CREATED)
def create_section(
    payload: SectionCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    # Validate batch exists
    batch = db.query(Batch).filter(Batch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    # Check duplicate
    existing = db.query(Section).filter(
        Section.batch_id == payload.batch_id,
        Section.name == payload.name.upper()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Section '{payload.name}' already exists in this batch.")
    section = Section(name=payload.name.upper(), batch_id=payload.batch_id)
    db.add(section)
    db.commit()
    db.refresh(section)
    return SectionOut(
        id=section.id,
        name=section.name,
        batch_id=section.batch_id,
        batch_name=batch.name
    )


@app.delete("/admin/sections/{section_id}")
def delete_section(
    section_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")
    
    # Cascade delete: feedback entries for this section
    db.query(FeedbackEntry).filter(FeedbackEntry.section_id == section_id).delete()
    
    # Cascade delete: students in this section
    db.query(Student).filter(Student.section_id == section_id).delete()
    
    # Remove teacher mappings
    db.query(SectionTeacherMap).filter(SectionTeacherMap.section_id == section_id).delete()
    
    db.delete(section)
    db.commit()
    return {"message": "Section deleted with all related data."}


# ─────────────────────────────────────────────────────────
# Admin: Teacher CRUD
# ─────────────────────────────────────────────────────────

@app.get("/admin/teachers", response_model=list[TeacherOut])
def admin_list_teachers(
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    return db.query(Teacher).order_by(Teacher.name).all()


@app.post("/admin/teachers", response_model=TeacherOut, status_code=status.HTTP_201_CREATED)
def create_teacher(
    payload: TeacherCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    teacher = Teacher(name=payload.name, subject_name=payload.subject_name)
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


@app.put("/admin/teachers/{teacher_id}", response_model=TeacherOut)
def update_teacher(
    teacher_id: int,
    payload: TeacherUpdate,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    if payload.name is not None:
        teacher.name = payload.name
    if payload.subject_name is not None:
        teacher.subject_name = payload.subject_name
    db.commit()
    db.refresh(teacher)
    return teacher


@app.delete("/admin/teachers/{teacher_id}")
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    # Remove mappings
    db.query(SectionTeacherMap).filter(SectionTeacherMap.teacher_id == teacher_id).delete()
    db.delete(teacher)
    db.commit()
    return {"message": "Teacher deleted."}


# ─────────────────────────────────────────────────────────
# Admin: Section-Teacher Mapping
# ─────────────────────────────────────────────────────────

@app.post("/admin/section-teacher-map", status_code=status.HTTP_201_CREATED)
def map_teacher_to_section(
    payload: SectionTeacherMapCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    # Validate section and teacher exist
    section = db.query(Section).filter(Section.id == payload.section_id).first()
    teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    
    # Check if already mapped
    existing = db.query(SectionTeacherMap).filter(
        SectionTeacherMap.section_id == payload.section_id,
        SectionTeacherMap.teacher_id == payload.teacher_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Teacher already mapped to this section.")
    
    mapping = SectionTeacherMap(section_id=payload.section_id, teacher_id=payload.teacher_id)
    db.add(mapping)
    db.commit()
    return {"message": f"Teacher '{teacher.name}' mapped to Section '{section.name}'."}


@app.delete("/admin/section-teacher-map")
def unmap_teacher_from_section(
    payload: SectionTeacherMapDelete,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    deleted = db.query(SectionTeacherMap).filter(
        SectionTeacherMap.section_id == payload.section_id,
        SectionTeacherMap.teacher_id == payload.teacher_id
    ).delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="Mapping not found.")
    db.commit()
    return {"message": "Mapping removed."}


# ─────────────────────────────────────────────────────────
# Admin: Reports & Analytics
# ─────────────────────────────────────────────────────────

@app.get("/admin/report")
def get_report(
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """
    Generate aggregated teacher evaluation report with averages.
    Returns JSON data (can be converted to CSV on frontend).
    """
    from sqlalchemy import func, cast, Float
    from sqlalchemy.dialects.postgresql import JSONB
    
    # Get all feedback entries grouped by teacher/section/batch
    report_data = []
    
    # Get distinct teacher-section-batch combinations from feedback
    combinations = db.query(
        FeedbackEntry.teacher_id,
        FeedbackEntry.section_id,
        FeedbackEntry.batch_id
    ).distinct().all()
    
    for teacher_id, section_id, batch_id in combinations:
        teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
        section = db.query(Section).filter(Section.id == section_id).first()
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        
        if not teacher or not section or not batch:
            continue
        
        # Get all feedback for this combination
        feedback_entries = db.query(FeedbackEntry).filter(
            FeedbackEntry.teacher_id == teacher_id,
            FeedbackEntry.section_id == section_id,
            FeedbackEntry.batch_id == batch_id
        ).all()
        
        if not feedback_entries:
            continue
        
        total_responses = len(feedback_entries)
        
        # Calculate totals and averages for each of the 10 questions
        q_totals = {f"q{i}": 0 for i in range(1, 11)}
        for entry in feedback_entries:
            scores = entry.scores
            for i in range(1, 11):
                q_totals[f"q{i}"] += scores.get(f"q{i}", 0)
        
        # Calculate averages for each question
        q_avgs = {k: round(v / total_responses, 7) for k, v in q_totals.items()}
        
        # Overall average = average of all 10 question averages
        overall_avg = round(sum(q_avgs.values()) / 10, 7)
        
        # Total percentage = (overall_avg / 5) * 100
        total_percentage = round((overall_avg / 5) * 100, 3)
        
        report_data.append({
            "teacher_id": teacher_id,
            "teacher_name": teacher.name,
            "subject_name": teacher.subject_name,
            "section_id": section_id,
            "section_name": section.name,
            "batch_id": batch_id,
            "batch_name": batch.name,
            "total_responses": total_responses,
            "q1_total": q_totals["q1"],
            "q2_total": q_totals["q2"],
            "q3_total": q_totals["q3"],
            "q4_total": q_totals["q4"],
            "q5_total": q_totals["q5"],
            "q6_total": q_totals["q6"],
            "q7_total": q_totals["q7"],
            "q8_total": q_totals["q8"],
            "q9_total": q_totals["q9"],
            "q10_total": q_totals["q10"],
            "q1_avg": q_avgs["q1"],
            "q2_avg": q_avgs["q2"],
            "q3_avg": q_avgs["q3"],
            "q4_avg": q_avgs["q4"],
            "q5_avg": q_avgs["q5"],
            "q6_avg": q_avgs["q6"],
            "q7_avg": q_avgs["q7"],
            "q8_avg": q_avgs["q8"],
            "q9_avg": q_avgs["q9"],
            "q10_avg": q_avgs["q10"],
            "overall_avg": overall_avg,
            "total_percentage": total_percentage,
        })
    
    return {"report": report_data, "criteria": EVALUATION_CRITERIA}


@app.get("/admin/feedback-details")
def get_feedback_details(
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """
    Get individual student feedback entries (each row = 1 student's feedback for 1 teacher).
    Used for CSV download with raw student entries.
    """
    feedback_data = []
    
    # Get all feedback entries
    all_feedback = db.query(FeedbackEntry).all()
    
    for entry in all_feedback:
        teacher = db.query(Teacher).filter(Teacher.id == entry.teacher_id).first()
        section = db.query(Section).filter(Section.id == entry.section_id).first()
        batch = db.query(Batch).filter(Batch.id == entry.batch_id).first()
        
        if not teacher or not section or not batch:
            continue
        
        scores = entry.scores
        # Get individual scores
        q1 = scores.get("q1", 0)
        q2 = scores.get("q2", 0)
        q3 = scores.get("q3", 0)
        q4 = scores.get("q4", 0)
        q5 = scores.get("q5", 0)
        q6 = scores.get("q6", 0)
        q7 = scores.get("q7", 0)
        q8 = scores.get("q8", 0)
        q9 = scores.get("q9", 0)
        q10 = scores.get("q10", 0)
        
        # Calculate total and average for this student
        total = q1 + q2 + q3 + q4 + q5 + q6 + q7 + q8 + q9 + q10
        average = round(total / 10, 2)
        
        feedback_data.append({
            "feedback_id": entry.id,
            "teacher_id": entry.teacher_id,
            "teacher_name": teacher.name,
            "subject_name": teacher.subject_name,
            "section_id": entry.section_id,
            "section_name": section.name,
            "batch_name": batch.name,
            "q1": q1,
            "q2": q2,
            "q3": q3,
            "q4": q4,
            "q5": q5,
            "q6": q6,
            "q7": q7,
            "q8": q8,
            "q9": q9,
            "q10": q10,
            "total": total,
            "average": average,
            "suggestion": entry.comments or "",
        })
    
    return {"feedback": feedback_data}
