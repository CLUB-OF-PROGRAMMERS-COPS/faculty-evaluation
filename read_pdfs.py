import PyPDF2
import os

pdfs = [
    'Application Flow.pdf',
    'Backend Schema.pdf', 
    'FinalChecklist.pdf',
    'Frontend Guidelines.pdf',
    'Implementation Plan.pdf',
    'Product Requirement Document.pdf',
    'Technical Stack & Architecture.pdf'
]

base = r'c:\Users\Kiran\OneDrive\Desktop\Feedback_tech'

for pdf in pdfs:
    path = os.path.join(base, pdf)
    print("\n" + "="*60)
    print(f"FILE: {pdf}")
    print("="*60)
    try:
        with open(path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    print(text)
    except Exception as e:
        print(f"Error: {e}")
