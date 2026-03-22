"""Clean up test students (USN pattern 1CK23CS9xx) before load test."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database import SessionLocal
from models import Student, FeedbackEntry

db = SessionLocal()

# Delete test students created by previous k6 runs (USN like 1CK23CS followed by large numbers)
# The k6 test generates USNs like 1CK23CS001, 1CK23CS002, ... up to 1CK23CS090
# But also 1CK23CS1001, etc. from the __VU * 1000 formula
test_students = db.query(Student).filter(Student.usn.like("1CK23CS%")).all()
real_students = []
test_only = []

for s in test_students:
    # Real students have 3-digit roll numbers (001-999)
    # k6 test generates roll numbers > 000 via (__VU-1)*1000+__ITER+1
    # USN format: 1CK23CSXXX where XXX >= 001
    # k6 generates: 1CK23CS001 to 1CK23CS090 for VU 1-90
    roll_part = s.usn.replace("1CK23CS", "")
    try:
        roll_num = int(roll_part)
        # k6 VU formula: (__VU - 1) * 1000 + __ITER + 1
        # VU1: 001, VU2: 1001, VU3: 2001, ..., VU90: 89001
        # Keep students with "normal" roll numbers (1-200 range typical for real class)
        if roll_num > 200:  # Very likely a k6 test student
            test_only.append(s)
        else:
            real_students.append(s)
    except ValueError:
        real_students.append(s)

print(f"Total 1CK23CS students: {len(test_students)}")
print(f"Real students (kept): {len(real_students)}")
print(f"Test students (to delete): {len(test_only)}")

if test_only:
    test_ids = [s.id for s in test_only]
    deleted_students = db.query(Student).filter(Student.id.in_(test_ids)).delete(synchronize_session=False)
    db.commit()
    print(f"Deleted {deleted_students} test students")
else:
    print("No test students to clean up")

db.close()
print("✅ Cleanup done. Ready for fresh load test.")
