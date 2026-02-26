"""
schemas.py – Pydantic request / response models.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Auth ────────────────────────────────────────
class StudentRegister(BaseModel):
    usn: str = Field(..., min_length=5, examples=["1CK23CS020"])
    password: str = Field(..., min_length=4)
    confirm_password: str = Field(..., min_length=4)
    section_id: int
    registration_code: str = Field("", description="Secret code provided by admin")


class StudentLogin(BaseModel):
    usn: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    has_voted: bool
    section_id: int
    batch_id: int
    batch_name: str


# ── Feedback ────────────────────────────────────
class TeacherScore(BaseModel):
    teacher_id: int
    scores: dict = Field(
        ...,
        description="10 Likert-scale scores: {'q1': 1..5, …, 'q10': 1..5}",
        examples=[{"q1": 5, "q2": 4, "q3": 3, "q4": 5, "q5": 4,
                   "q6": 3, "q7": 5, "q8": 4, "q9": 3, "q10": 5}],
    )
    comments: Optional[str] = None


class FeedbackSubmission(BaseModel):
    """All-or-Nothing: must contain one entry per assigned teacher."""
    section_id: int
    batch_id: int
    ratings: list[TeacherScore]


# ── Admin ───────────────────────────────────────
class AdminLogin(BaseModel):
    username: str
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "admin"


class ResetRequest(BaseModel):
    confirmation: str = Field(..., description="Must be 'DELETE-CONFIRM' to proceed")


# ── Read helpers ────────────────────────────────
class TeacherOut(BaseModel):
    id: int
    name: str
    subject_name: str

    class Config:
        from_attributes = True


class SectionOut(BaseModel):
    id: int
    name: str
    batch_id: int
    batch_name: str = ""

    class Config:
        from_attributes = True


class SectionWithTeachers(BaseModel):
    id: int
    name: str
    batch_id: int
    batch_name: str = ""
    teachers: list[TeacherOut] = []

    class Config:
        from_attributes = True


class BatchOut(BaseModel):
    id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class BatchWithSections(BaseModel):
    id: int
    name: str
    is_active: bool
    sections: list[SectionOut] = []

    class Config:
        from_attributes = True


# ── Admin CRUD ──────────────────────────────────
class BatchCreate(BaseModel):
    name: str = Field(..., examples=["2023"])


class SectionCreate(BaseModel):
    name: str = Field(..., examples=["A"])
    batch_id: int


class TeacherCreate(BaseModel):
    name: str = Field(..., examples=["Dr. John Smith"])
    subject_name: str = Field(..., examples=["Data Structures"])


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    subject_name: Optional[str] = None


class SectionTeacherMapCreate(BaseModel):
    section_id: int
    teacher_id: int


class SectionTeacherMapDelete(BaseModel):
    section_id: int
    teacher_id: int


# ── Report ──────────────────────────────────────
class TeacherReportRow(BaseModel):
    teacher_id: int
    teacher_name: str
    subject_name: str
    section_id: int
    section_name: str
    batch_name: str
    total_responses: int
    # Totals for each question (sum of all scores)
    q1_total: int
    q2_total: int
    q3_total: int
    q4_total: int
    q5_total: int
    q6_total: int
    q7_total: int
    q8_total: int
    q9_total: int
    q10_total: int
    # Averages for each question
    q1_avg: float
    q2_avg: float
    q3_avg: float
    q4_avg: float
    q5_avg: float
    q6_avg: float
    q7_avg: float
    q8_avg: float
    q9_avg: float
    q10_avg: float
    # Overall metrics
    overall_avg: float  # Average of all 10 question averages
    total_percentage: float  # (overall_avg / 5) * 100


# ── Individual Feedback Details (for CSV) ──────
class IndividualFeedbackRow(BaseModel):
    """Each student's individual feedback as a separate row."""
    feedback_id: int
    teacher_id: int
    teacher_name: str
    subject_name: str
    section_id: int
    section_name: str
    batch_name: str
    # Individual scores (what student entered)
    q1: int
    q2: int
    q3: int
    q4: int
    q5: int
    q6: int
    q7: int
    q8: int
    q9: int
    q10: int
    # Calculated for this student
    total: int  # Sum of all 10 scores (max 50)
    average: float  # total / 10
    # Suggestion/comment
    suggestion: Optional[str] = None


# ── System Settings ─────────────────────────────

class RegistrationSettingsOut(BaseModel):
    registration_open: bool
    registration_code: Optional[str] = None   # only returned to admin

    class Config:
        from_attributes = True


class RegistrationSettingsUpdate(BaseModel):
    registration_open: Optional[bool] = None
    registration_code: Optional[str] = None


class RegistrationStatusOut(BaseModel):
    """Public-facing: only tells students if registration is open (not the code)."""
    registration_open: bool
    requires_code: bool
