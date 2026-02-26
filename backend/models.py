"""
models.py – SQLAlchemy ORM models.

Schema copied verbatim from the Backend Schema document with all
constraints applied:
  • FeedbackEntry has NO student_id column (anonymity guarantee).
  • scores column is JSON (holds the 10 evaluation criteria).
"""

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    JSON,
    Index,
    DateTime,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


# ────────────────────────────────────────────────
# 1. Master Data
# ────────────────────────────────────────────────

class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)           # e.g. "2023"
    is_active = Column(Boolean, default=True)

    sections = relationship("Section", back_populates="batch")


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)                        # e.g. "A"
    batch_id = Column(Integer, ForeignKey("batches.id"))

    batch = relationship("Batch", back_populates="sections")
    teachers = relationship("Teacher", secondary="section_teacher_map")


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    subject_name = Column(String)


# ── Many-to-Many Mapping (The "Time Table" Logic) ──────────
class SectionTeacherMap(Base):
    __tablename__ = "section_teacher_map"

    section_id = Column(Integer, ForeignKey("sections.id"), primary_key=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), primary_key=True)


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)  # Plain text or hashed
    created_at = Column(DateTime, default=datetime.utcnow)


# ────────────────────────────────────────────────
# 2. User Data
# ────────────────────────────────────────────────

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    usn = Column(String, unique=True, index=True)  # e.g. "1CK23CS020"
    password_hash = Column(String)
    section_id = Column(Integer, ForeignKey("sections.id"))

    # Flag reset every semester
    has_voted = Column(Boolean, default=False)


# ────────────────────────────────────────────────
# 3. Transactional Data (The Feedback)
#    CRITICAL: No student_id — anonymity guaranteed.
# ────────────────────────────────────────────────

class FeedbackEntry(Base):
    __tablename__ = "feedback_entries"

    id = Column(Integer, primary_key=True, index=True)

    # Context — where did this come from?
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)

    # The Data — the 10 Questions
    # Stored as JSON: {"q1": 5, "q2": 4, ... "q10": 5}
    scores = Column(JSON, nullable=False)
    comments = Column(String, nullable=True)

    # Composite index for fast report generation
    __table_args__ = (
        Index("idx_feedback_metrics", "batch_id", "section_id", "teacher_id"),
    )


# ────────────────────────────────────────────────
# 4. System Settings (singleton row, id=1)
# ────────────────────────────────────────────────

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, default=1)
    registration_open = Column(Boolean, default=False)     # gate: is registration allowed?
    registration_code = Column(String, nullable=True)       # secret code students must enter
