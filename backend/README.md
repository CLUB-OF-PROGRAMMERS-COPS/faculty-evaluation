# Automated Faculty Evaluation System

## Quick Start

### Backend
```bash
cd backend
cp ../.env.example .env   # fill in real values
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker
```bash
docker-compose up --build
```
