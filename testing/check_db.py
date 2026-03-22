"""Quick DB check for load test prerequisites."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database import SessionLocal
from models import SectionTeacherMap, Teacher, Student, FeedbackEntry

db = SessionLocal()

# Check teachers mapped to section 16
maps = db.query(SectionTeacherMap).filter(SectionTeacherMap.section_id == 16).all()
print(f"\n{len(maps)} teachers mapped to section 16 (Batch 2023, Section A):")
for m in maps:
    t = db.query(Teacher).filter(Teacher.id == m.teacher_id).first()
    print(f"  teacher_id={m.teacher_id}: {t.name if t else 'MISSING'} ({t.subject_name if t else ''})")

# Count existing test students (USN pattern 1CK23CS9xx — our k6 test range)
test_students = db.query(Student).filter(Student.usn.like("1CK23CS9%")).count()
print(f"\nExisting test students (1CK23CS9xx): {test_students}")

# Count total feedback
total_feedback = db.query(FeedbackEntry).count()
print(f"Total feedback entries in DB: {total_feedback}")

db.close()
print("\n✅ DB check complete. Ready to run load test.")
