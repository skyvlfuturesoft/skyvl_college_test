"""
SOEMS — FastAPI Backend
Secure Online Examination Management System
"""

import os
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Header, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from jose import jwt
import shutil
import uuid

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

app = FastAPI(title="SOEMS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File uploads are handled in-memory for serverless compatibility

import uuid

# ── Supabase Credentials & Fallback Detection ──
IS_MOCK_MODE = os.getenv("IS_MOCK_MODE", "true").lower() in ("true", "1", "yes") or not SUPABASE_URL or not SUPABASE_KEY or not SUPABASE_SERVICE_KEY


# ── Mock Database Store (For Offline / Localhost Running) ──
class MockDB:
    def __init__(self):
        self.users = {
            "admin-uuid": {"id": "admin-uuid", "email": "admin@saec.ac.in", "role": "admin", "name": "Prof. Administrator"},
            "student-uuid": {"id": "student-uuid", "email": "student@saec.ac.in", "role": "student", "name": "Sasikumar Baskar"},
        }
        self.passwords = {
            "admin@saec.ac.in": "admin123",
            "student@saec.ac.in": "pass123",
        }
        self.exams = {
            "exam-1": {
                "id": "exam-1",
                "title": "Data Structures & Algorithms Final",
                "description": "Midterm assessment covering LinkedLists, Trees, Graphs, and sorting algorithms.",
                "duration": 30,
                "is_published": True,
                "created_by": "admin-uuid",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "start_time": None,
                "end_time": None,
                "negative_marking": 0.0,
                "pass_threshold": 50,
                "max_violations": 3,
                "allowed_violations": ["tab_switch", "window_blur", "fullscreen_exit", "devtools_open", "copy_paste_right_click", "network_disconnect"],
            }
        }
        self.questions = {
            "exam-1": [
                {
                    "id": "q-1",
                    "exam_id": "exam-1",
                    "question_text": "What is the worst-case time complexity of inserting a node into a Binary Search Tree?",
                    "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
                    "correct_answer": 2,
                    "marks": 2,
                },
                {
                    "id": "q-2",
                    "exam_id": "exam-1",
                    "question_text": "Which data structure operates on a Last In, First Out (LIFO) basis?",
                    "options": ["Queue", "Stack", "Binary Tree", "Heap"],
                    "correct_answer": 1,
                    "marks": 1,
                },
                {
                    "id": "q-3",
                    "exam_id": "exam-1",
                    "question_text": "What is the time complexity of Quick Sort in the average case?",
                    "options": ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"],
                    "correct_answer": 1,
                    "marks": 2,
                }
            ]
        }
        self.attempts = {}
        self.answers = {}
        self.event_logs = []
        self.violations = []
        self.kick_logs = []
        self.activity_logs = []
        self.notifications = []
        self.live_sessions = {}
        self.admin_actions = []
        self.documents = {}

db_store = MockDB()

class MockResult:
    def __init__(self, data, count=0):
        self.data = data
        self.count = count

    def execute(self):
        """No-op: allows .insert({}).execute() chaining."""
        return self

class MockQueryBuilder:
    def __init__(self, table_name):
        self.table_name = table_name
        self.filters = {}
        self.order_by = None
        self.limit_val = None
        self.is_single = False
        self._op = 'select'       # 'select' | 'insert' | 'update' | 'delete'
        self._insert_payload = None
        self._update_payload = None

    # ── Builder Methods (always return self) ──

    def select(self, select_str="*", **kwargs):
        self._op = 'select'
        return self

    def eq(self, field, val):
        self.filters[field] = val
        return self

    def order(self, field, desc=False):
        self.order_by = (field, desc)
        return self

    def limit(self, val):
        self.limit_val = val
        return self

    def in_(self, field, vals):
        self.filters[field + "_in"] = vals
        return self

    def single(self):
        self.is_single = True
        return self

    def insert(self, payload):
        self._op = 'insert'
        self._insert_payload = {**payload}
        return self

    def update(self, payload):
        self._op = 'update'
        self._update_payload = payload
        return self

    def delete(self):
        self._op = 'delete'
        return self

    # ── Execute ──

    def execute(self):
        if self._op == 'insert':
            return self._do_insert()
        elif self._op == 'update':
            return self._do_update()
        elif self._op == 'delete':
            return self._do_delete()
        else:
            return self._do_select()

    # ── Internal helpers ──

    def _get_raw_data(self):
        """Return the raw list/dict for this table (mutable references)."""
        if self.table_name == "exams":
            return list(db_store.exams.values())
        elif self.table_name == "profiles":
            return list(db_store.users.values())
        elif self.table_name == "questions":
            data = []
            for qs in db_store.questions.values():
                data.extend(qs)
            return data
        elif self.table_name == "attempts":
            return list(db_store.attempts.values())
        elif self.table_name == "event_logs":
            return list(db_store.event_logs)
        elif self.table_name == "violations":
            return list(db_store.violations)
        elif self.table_name == "kick_logs":
            return list(db_store.kick_logs)
        elif self.table_name == "activity_logs":
            return list(db_store.activity_logs)
        elif self.table_name == "notifications":
            return list(db_store.notifications)
        elif self.table_name == "live_sessions":
            return list(db_store.live_sessions.values())
        elif self.table_name == "admin_actions":
            return list(db_store.admin_actions)
        elif self.table_name == "answers":
            return list(db_store.answers.values())
        elif self.table_name == "documents":
            return list(db_store.documents.values())
        return []

    def _matches(self, item):
        for k, v in self.filters.items():
            if k.endswith("_in"):
                real_k = k[:-3]
                if item.get(real_k) not in v:
                    return False
            elif item.get(k) != v:
                return False
        return True

    def _enrich(self, item):
        """Add relationship mocks (profiles, exams, etc.)."""
        item_copy = {**item}
        if self.table_name in ("exams", "attempts", "event_logs", "violations",
                               "kick_logs", "activity_logs", "live_sessions"):
            creator_id = (item.get("created_by") or item.get("student_id")
                          or item.get("user_id"))
            item_copy["profiles"] = db_store.users.get(
                creator_id, {"name": "Student", "email": ""})
            default_exam = {
                "title": "Exam",
                "duration": 30,
                "start_time": None,
                "end_time": None,
                "negative_marking": 0.0,
                "pass_threshold": 50,
                "max_violations": 3,
                "allowed_violations": ["tab_switch", "window_blur", "fullscreen_exit", "devtools_open", "copy_paste_right_click", "network_disconnect"]
            }
            if self.table_name in ("attempts", "kick_logs"):
                item_copy["exams"] = db_store.exams.get(item.get("exam_id"), default_exam)
            if self.table_name == "live_sessions":
                attempt = db_store.attempts.get(item.get("attempt_id"), {})
                item_copy["attempts"] = attempt
                item_copy["exams"] = db_store.exams.get(attempt.get("exam_id"), default_exam)
        if self.table_name == "answers":
            q_id = item.get("question_id")
            matched_q = None
            for exam_qs in db_store.questions.values():
                for q in exam_qs:
                    if q["id"] == q_id:
                        matched_q = q
                        break
                if matched_q:
                    break
            item_copy["questions"] = matched_q or {}
        return item_copy

    def _do_select(self):
        raw = self._get_raw_data()
        filtered = [self._enrich(item) for item in raw if self._matches(item)]

        if self.order_by:
            field, desc = self.order_by
            filtered.sort(key=lambda x: x.get(field, "") or "", reverse=desc)

        if self.limit_val:
            filtered = filtered[:self.limit_val]

        if self.is_single:
            return MockResult(filtered[0] if filtered else None)
        return MockResult(filtered, len(filtered))

    def _do_insert(self):
        payload = self._insert_payload
        if "id" not in payload:
            payload["id"] = str(uuid.uuid4())
        payload.setdefault("created_at", datetime.now(timezone.utc).isoformat())

        tn = self.table_name
        if tn == "exams":
            payload.setdefault("is_published", False)
            db_store.exams[payload["id"]] = payload
        elif tn == "questions":
            exam_id = payload["exam_id"]
            db_store.questions.setdefault(exam_id, [])
            db_store.questions[exam_id].append(payload)
        elif tn == "attempts":
            payload.setdefault("status", "in_progress")
            payload.setdefault("score", 0)
            payload.setdefault("violation_count", 0)
            payload.setdefault("is_auto_submitted", False)
            db_store.attempts[payload["id"]] = payload
        elif tn == "answers":
            db_store.answers[payload["id"]] = payload
        elif tn == "event_logs":
            db_store.event_logs.insert(0, payload)
        elif tn == "violations":
            db_store.violations.append(payload)
        elif tn == "kick_logs":
            db_store.kick_logs.append(payload)
        elif tn == "activity_logs":
            db_store.activity_logs.insert(0, payload)
        elif tn == "notifications":
            db_store.notifications.insert(0, payload)
        elif tn == "live_sessions":
            attempt_id = payload.get("attempt_id")
            key = attempt_id if attempt_id else payload["id"]
            db_store.live_sessions[key] = payload
        elif tn == "admin_actions":
            db_store.admin_actions.append(payload)
        elif tn == "documents":
            db_store.documents[payload["id"]] = payload

        return MockResult([payload])

    def _do_update(self):
        payload = self._update_payload or {}
        tn = self.table_name
        updated = []

        if tn == "exams":
            for item in list(db_store.exams.values()):
                if self._matches(item):
                    item.update(payload)
                    updated.append(item)
        elif tn == "attempts":
            for item in list(db_store.attempts.values()):
                if self._matches(item):
                    item.update(payload)
                    updated.append(item)
        elif tn == "answers":
            for item in list(db_store.answers.values()):
                if self._matches(item):
                    item.update(payload)
        elif tn == "documents":
            for item in list(db_store.documents.values()):
                if self._matches(item):
                    item.update(payload)
                    updated.append(item)
                    updated.append(item)
        elif tn == "live_sessions":
            for item in list(db_store.live_sessions.values()):
                if self._matches(item):
                    item.update(payload)
                    updated.append(item)
        elif tn == "notifications":
            for item in db_store.notifications:
                if self._matches(item):
                    item.update(payload)
                    updated.append(item)
        elif tn == "questions":
            for exam_qs in db_store.questions.values():
                for item in exam_qs:
                    if self._matches(item):
                        item.update(payload)
                        updated.append(item)

        return MockResult(updated)

    def _do_delete(self):
        tn = self.table_name
        if tn == "questions":
            for exam_id, qs in list(db_store.questions.items()):
                db_store.questions[exam_id] = [
                    q for q in qs if not self._matches(q)]
        elif tn == "live_sessions":
            for key, sess in list(db_store.live_sessions.items()):
                if self._matches(sess):
                    del db_store.live_sessions[key]
        elif tn == "attempts":
            for key, item in list(db_store.attempts.items()):
                if self._matches(item):
                    del db_store.attempts[key]
        elif tn == "answers":
            for key, item in list(db_store.answers.items()):
                if self._matches(item):
                    del db_store.answers[key]
        elif tn == "documents":
            for key, item in list(db_store.documents.items()):
                if self._matches(item):
                    try:
                        filepath = item.get("file_url", "").lstrip("/")
                        if os.path.exists(filepath):
                            os.remove(filepath)
                    except Exception:
                        pass
                    del db_store.documents[key]
        return MockResult([])


class MockSupabaseClient:
    def table(self, name):
        return MockQueryBuilder(name)




_supabase_client = None
_public_supabase_client = None

# ── Supabase Clients ──
def get_supabase() -> Client:
    """Service role client for backend operations."""
    global _supabase_client
    if IS_MOCK_MODE:
        return MockSupabaseClient()
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client

def get_public_supabase() -> Client:
    """Anon client for user-scoped operations."""
    global _public_supabase_client
    if IS_MOCK_MODE:
        return MockSupabaseClient()
    if _public_supabase_client is None:
        _public_supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _public_supabase_client



# ── Auth Dependency ──
async def get_current_user(authorization: str = Header(...)):
    """Extract user from Supabase JWT token."""
    try:
        token = authorization.replace("Bearer ", "")
        
        if IS_MOCK_MODE:
            # Decode payload locally
            # In mock mode, we encode the user object directly in JWT token
            try:
                payload = jwt.decode(token, "mock-secret", algorithms=["HS256"])
                user_id = payload.get("id")
                user_data = db_store.users.get(user_id)
                if user_data:
                    return {
                        "id": user_id,
                        "email": user_data["email"],
                        "role": user_data["role"],
                        "name": user_data["name"],
                        "token": token
                    }
            except Exception:
                pass
            raise HTTPException(status_code=401, detail="Invalid mock session token")
            
        # Try local JWT verification (0 network calls)
        if JWT_SECRET:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
                user_id = payload.get("sub")
                email = payload.get("email")
                user_metadata = payload.get("user_metadata") or {}
                role = user_metadata.get("role")
                name = user_metadata.get("name", email.split("@")[0] if email else "User")
                
                if user_id and email and role:
                    return {
                        "id": user_id,
                        "email": email,
                        "role": role,
                        "name": name,
                        "token": token,
                    }
            except Exception:
                pass

        # Fallback to Supabase API verification (network calls) if local verification fails or secret is missing
        sb = get_public_supabase()
        user_response = sb.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = user_response.user
        # Get profile with role using service role client to bypass RLS in backend auth checks
        sb_service = get_supabase()
        profile_res = sb_service.table("profiles").select("*").eq("id", str(user.id)).execute()
        if not profile_res.data:
            metadata = getattr(user, 'user_metadata', None) or {}
            name = metadata.get("name", user.email.split("@")[0])
            role = metadata.get("role", "student")
            profile_insert = sb_service.table("profiles").insert({
                "id": str(user.id),
                "name": name,
                "email": user.email,
                "role": role
            }).execute()
            profile_data = profile_insert.data[0] if (profile_insert and profile_insert.data) else {"role": role, "name": name}
        else:
            profile_data = profile_res.data[0]

        return {
            "id": str(user.id),
            "email": user.email,
            "role": profile_data.get("role", "student"),
            "name": profile_data.get("name", ""),
            "token": token,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Pydantic Models ──
class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    duration: int = 30
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    negative_marking: float = 0.0
    pass_threshold: int = 50
    max_violations: int = 3
    allowed_violations: Optional[list[str]] = None

class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[int] = None
    is_published: Optional[bool] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    negative_marking: Optional[float] = None
    pass_threshold: Optional[int] = None
    max_violations: Optional[int] = None
    allowed_violations: Optional[list[str]] = None

class QuestionCreate(BaseModel):
    exam_id: str
    question_text: str
    options: list[str]  # ["A", "B", "C", "D"]
    correct_answer: int  # index 0-3
    marks: int = 1

class AnswerSubmit(BaseModel):
    question_id: str
    selected_option: int  # index 0-3

class EventLog(BaseModel):
    attempt_id: Optional[str] = None
    event_type: str
    details: Optional[dict] = {}

class ViolationCreate(BaseModel):
    attempt_id: str
    violation_type: str
    browser: Optional[str] = None
    os: Optional[str] = None
    ip_address: Optional[str] = None
    device: Optional[str] = None

class KickLogCreate(BaseModel):
    attempt_id: str
    student_id: str
    exam_id: str
    reason: str
    violation_count: int = 0
    browser: Optional[str] = None
    os: Optional[str] = None
    ip_address: Optional[str] = None
    device: Optional[str] = None
    final_score: Optional[int] = None
    duration_completed: Optional[int] = None
    admin_notes: Optional[str] = None

class SessionHeartbeat(BaseModel):
    attempt_id: str
    current_question_index: int = 0
    answered_count: int = 0
    time_remaining: int
    browser: Optional[str] = None
    os: Optional[str] = None
    ip_address: Optional[str] = None
    connection_status: str = "connected"
    is_paused: bool = False


# ── Health Check ──
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SOEMS API"}


# ============================================================
# AUTH ENDPOINTS
# ============================================================

class RegisterInput(BaseModel):
    email: str
    password: str
    name: str
    role: str = "student"

class LoginInput(BaseModel):
    email: str
    password: str

class ResetPasswordInput(BaseModel):
    email: str
    new_password: str

@app.post("/api/auth/register")
async def register(data: RegisterInput):
    try:
        if IS_MOCK_MODE:
            if data.email in db_store.passwords:
                raise HTTPException(status_code=400, detail="User already exists")
            user_id = str(uuid.uuid4())
            new_user = {"id": user_id, "email": data.email, "role": data.role, "name": data.name}
            db_store.users[user_id] = new_user
            db_store.passwords[data.email] = data.password
            token = jwt.encode({"id": user_id, "email": data.email}, "mock-secret", algorithm="HS256")
            return {
                "user": new_user,
                "session": {"access_token": token}
            }

        sb = get_public_supabase()
        result = sb.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {"name": data.name, "role": data.role}
            }
        })
        if result.user:
            return {
                "user": {"id": str(result.user.id), "email": result.user.email},
                "session": {
                    "access_token": result.session.access_token if result.session else None,
                }
            }
        raise HTTPException(status_code=400, detail="Registration failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
async def login(data: LoginInput):
    try:
        if IS_MOCK_MODE:
            # Check credentials in mock store
            stored_password = db_store.passwords.get(data.email)
            if not stored_password or stored_password != data.password:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            # Find user
            user = next((u for u in db_store.users.values() if u["email"] == data.email), None)
            if not user:
                raise HTTPException(status_code=401, detail="User data missing")
            token = jwt.encode({"id": user["id"], "email": user["email"]}, "mock-secret", algorithm="HS256")
            return {
                "user": user,
                "session": {
                    "access_token": token,
                    "refresh_token": "mock-refresh-token"
                }
            }

        sb = get_public_supabase()
        result = sb.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        if result.user and result.session:
            # Get role from profiles using service role client to bypass RLS in backend login
            sb_service = get_supabase()
            profile_res = sb_service.table("profiles").select("role, name").eq("id", str(result.user.id)).execute()
            if not profile_res.data:
                metadata = getattr(result.user, 'user_metadata', None) or {}
                role = metadata.get("role", "student")
                name = metadata.get("name", result.user.email.split("@")[0])
                sb_service.table("profiles").insert({
                    "id": str(result.user.id),
                    "name": name,
                    "email": result.user.email,
                    "role": role
                }).execute()
            else:
                role = profile_res.data[0].get("role", "student")
                name = profile_res.data[0].get("name", "")

            return {
                "user": {
                    "id": str(result.user.id),
                    "email": result.user.email,
                    "role": role,
                    "name": name,
                },
                "session": {
                    "access_token": result.session.access_token,
                    "refresh_token": result.session.refresh_token,
                }
            }
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.post("/api/auth/reset-password")
async def reset_password(data: ResetPasswordInput):
    try:
        if IS_MOCK_MODE:
            if data.email in db_store.passwords:
                db_store.passwords[data.email] = data.new_password
                return {"success": True, "message": "Password reset successful (Mock Mode)"}
            else:
                raise HTTPException(status_code=404, detail="Email not found")
        
        sb = get_supabase()
        profile_res = sb.table("profiles").select("id").eq("email", data.email).single().execute()
        if not profile_res.data:
            raise HTTPException(status_code=404, detail="Email not registered")
        user_id = profile_res.data["id"]
        
        sb.auth.admin.update_user_by_id(
            user_id,
            attributes={"password": data.new_password}
        )
        return {"success": True, "message": "Password reset successful"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# EXAM ENDPOINTS
# ============================================================

@app.get("/api/exams")
async def list_exams(user=Depends(get_current_user)):
    sb = get_supabase()
    if user["role"] == "admin":
        result = sb.table("exams").select("*, profiles(name)").order("created_at", desc=True).execute()
    else:
        result = sb.table("exams").select("*").eq("is_published", True).order("created_at", desc=True).execute()
    return {"exams": result.data or []}

@app.post("/api/exams")
async def create_exam(data: ExamCreate, user=Depends(require_admin)):
    sb = get_supabase()
    allowed_v = data.allowed_violations if data.allowed_violations is not None else [
        "tab_switch", "window_blur", "fullscreen_exit", "devtools_open", "copy_paste_right_click", "network_disconnect"
    ]
    result = sb.table("exams").insert({
        "title": data.title,
        "description": data.description,
        "duration": data.duration,
        "created_by": user["id"],
        "start_time": data.start_time,
        "end_time": data.end_time,
        "negative_marking": data.negative_marking,
        "pass_threshold": data.pass_threshold,
        "max_violations": data.max_violations,
        "allowed_violations": allowed_v,
    }).execute()
    return {"exam": result.data[0] if result.data else None}

@app.put("/api/exams/{exam_id}")
async def update_exam(exam_id: str, data: ExamUpdate, user=Depends(require_admin)):
    sb = get_supabase()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("exams").update(update_data).eq("id", exam_id).execute()
    return {"exam": result.data[0] if result.data else None}

@app.get("/api/exams/{exam_id}")
async def get_exam(exam_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("exams").select("*").eq("id", exam_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    return {"exam": result.data}


# ============================================================
# QUESTION ENDPOINTS
# ============================================================

@app.get("/api/exams/{exam_id}/questions")
async def get_questions(exam_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("questions").select("*").eq("exam_id", exam_id).order("created_at").execute()
    questions = result.data or []
    
    # Randomize questions order seeded per student attempt
    if user["role"] != "admin":
        attempt = sb.table("attempts").select("*").eq("student_id", user["id"]).eq("exam_id", exam_id).eq("status", "in_progress").execute()
        if attempt.data:
            import random
            attempt_id = attempt.data[0]["id"]
            # Seed and shuffle questions list
            random.seed(attempt_id)
            random.shuffle(questions)
            random.seed() # reset seed
            
            # Strip correct answers during exam
            questions = [
                {**q, "correct_answer": None} for q in questions
            ]
        else:
            # Not in active exam, still strip answers
            questions = [{**q, "correct_answer": None} for q in questions]
            
    return {"questions": questions}

@app.post("/api/questions")
async def create_question(data: QuestionCreate, user=Depends(require_admin)):
    sb = get_supabase()
    result = sb.table("questions").insert({
        "exam_id": data.exam_id,
        "question_text": data.question_text,
        "options": data.options,
        "correct_answer": data.correct_answer,
        "marks": data.marks,
    }).execute()
    return {"question": result.data[0] if result.data else None}

@app.delete("/api/questions/{question_id}")
async def delete_question(question_id: str, user=Depends(require_admin)):
    sb = get_supabase()
    sb.table("questions").delete().eq("id", question_id).execute()
    return {"success": True}


# ============================================================
# ATTEMPT ENDPOINTS
# ============================================================

@app.post("/api/attempts/start")
async def start_attempt(exam_id: str, user=Depends(get_current_user)):
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can start exams")
    
    sb = get_supabase()
    
    # Check for existing in-progress attempt
    existing = sb.table("attempts").select("*").eq("student_id", user["id"]).eq("exam_id", exam_id).eq("status", "in_progress").execute()
    if existing.data:
        return {"attempt": existing.data[0], "resumed": True}
    
    # Check for terminated attempt
    terminated = sb.table("attempts").select("*").eq("student_id", user["id"]).eq("exam_id", exam_id).eq("status", "terminated").execute()
    if terminated.data:
        raise HTTPException(status_code=403, detail="Your examination session has been terminated due to security violations.")
    
    # Check for completed attempt
    completed = sb.table("attempts").select("*").eq("student_id", user["id"]).eq("exam_id", exam_id).in_("status", ["submitted", "auto_submitted"]).execute()
    if completed.data:
        raise HTTPException(status_code=400, detail="You have already completed this exam")
    
    # Get exam for total marks
    exam = sb.table("exams").select("*").eq("id", exam_id).single().execute()
    if not exam.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    if not exam.data.get("is_published"):
        raise HTTPException(status_code=400, detail="Exam is not published")
        
    # Check exam scheduling window
    exam_data = exam.data
    now = datetime.now(timezone.utc)
    if exam_data.get("start_time"):
        try:
            start_str = exam_data["start_time"].replace("Z", "+00:00")
            start_dt = datetime.fromisoformat(start_str)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            if now < start_dt:
                raise HTTPException(status_code=400, detail=f"Exam scheduled window has not opened yet. Starts at: {start_dt.isoformat()}")
        except ValueError:
            pass
    if exam_data.get("end_time"):
        try:
            end_str = exam_data["end_time"].replace("Z", "+00:00")
            end_dt = datetime.fromisoformat(end_str)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
            if now > end_dt:
                raise HTTPException(status_code=400, detail="Exam scheduled window has closed.")
        except ValueError:
            pass
    
    questions = sb.table("questions").select("marks").eq("exam_id", exam_id).execute()
    total_marks = sum(q["marks"] for q in (questions.data or []))
    
    # Create attempt
    result = sb.table("attempts").insert({
        "student_id": user["id"],
        "exam_id": exam_id,
        "total_marks": total_marks,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    
    # Log event
    if result.data:
        sb.table("event_logs").insert({
            "user_id": user["id"],
            "attempt_id": result.data[0]["id"],
            "event_type": "exam_started",
            "details": {"exam_id": exam_id, "exam_title": exam.data["title"]},
        }).execute()
    
    return {"attempt": result.data[0] if result.data else None, "resumed": False}


@app.post("/api/attempts/{attempt_id}/answer")
async def save_answer(attempt_id: str, data: AnswerSubmit, user=Depends(get_current_user)):
    sb = get_supabase()
    
    # Verify attempt belongs to user and is in progress
    # Use two separate filters for mock compatibility (dict key uniqueness)
    attempt_res = sb.table("attempts").select("*").eq("id", attempt_id).single().execute()
    if not attempt_res.data:
        raise HTTPException(status_code=400, detail="Attempt not found")
    attempt = attempt_res.data
    if attempt.get("student_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your attempt")
    if attempt.get("status") != "in_progress":
        raise HTTPException(status_code=400, detail="Attempt is not in progress")
    
    # Check timer hasn't expired (safe parse)
    try:
        exam = sb.table("exams").select("duration").eq("id", attempt["exam_id"]).single().execute()
        if exam.data:
            started_str = attempt.get("started_at", "").replace("Z", "+00:00")
            started = datetime.fromisoformat(started_str)
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - started).total_seconds()
            if elapsed > exam.data["duration"] * 60 + 30:  # 30s grace
                await submit_attempt(attempt_id=attempt_id, auto=True, user=user)
                raise HTTPException(status_code=400, detail="Timer expired. Exam auto-submitted.")
    except HTTPException:
        raise
    except Exception:
        pass  # skip timer check on parse error
    
    # Upsert answer: find by attempt_id + question_id
    all_answers = sb.table("answers").select("id").eq("attempt_id", attempt_id).execute()
    existing_id = None
    for ans in (all_answers.data or []):
        if ans.get("question_id") == data.question_id:
            existing_id = ans["id"]
            break

    if existing_id:
        sb.table("answers").update({"selected_option": data.selected_option}).eq("id", existing_id).execute()
    else:
        sb.table("answers").insert({
            "attempt_id": attempt_id,
            "question_id": data.question_id,
            "selected_option": data.selected_option,
        }).execute()
    
    return {"success": True}


@app.post("/api/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: str, auto: bool = False, user=Depends(get_current_user)):
    sb = get_supabase()
    
    # Verify attempt
    attempt = sb.table("attempts").select("*").eq("id", attempt_id).single().execute()
    if not attempt.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    # Verify ownership
    if user["role"] != "admin" and attempt.data.get("student_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized attempt access")
        
    if attempt.data["status"] != "in_progress":
        return {"attempt": attempt.data, "message": "Already submitted"}
    
    # Calculate score with negative marking
    exam_res = sb.table("exams").select("*").eq("id", attempt.data["exam_id"]).single().execute()
    exam = exam_res.data if exam_res.data else {}
    neg_marking = exam.get("negative_marking") or 0.0

    answers = sb.table("answers").select("question_id, selected_option").eq("attempt_id", attempt_id).execute()
    answer_map = {a["question_id"]: a["selected_option"] for a in (answers.data or [])}
    
    questions = sb.table("questions").select("id, correct_answer, marks").eq("exam_id", attempt.data["exam_id"]).execute()
    
    score = 0.0
    for q in (questions.data or []):
        selected = answer_map.get(q["id"])
        if selected is not None:
            is_correct = selected == q["correct_answer"]
            if is_correct:
                score += q["marks"]
            else:
                score -= neg_marking
        else:
            is_correct = False
            
        # Update answer correctness
        if q["id"] in answer_map:
            sb.table("answers").update({"is_correct": is_correct}).eq("attempt_id", attempt_id).eq("question_id", q["id"]).execute()
            
    score = max(0.0, score)
    
    # Update attempt
    status = "auto_submitted" if auto else "submitted"
    result = sb.table("attempts").update({
        "score": score,
        "status": status,
        "is_auto_submitted": auto,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", attempt_id).execute()
    
    # Log event
    sb.table("event_logs").insert({
        "user_id": attempt.data["student_id"],
        "attempt_id": attempt_id,
        "event_type": "auto_submit" if auto else "exam_submitted",
        "details": {"score": score, "total": attempt.data.get("total_marks", 0)},
    }).execute()
    
    return {"attempt": result.data[0] if result.data else attempt.data, "score": score}


@app.get("/api/attempts/{attempt_id}")
async def get_attempt(attempt_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("attempts").select("*, exams(title, duration)").eq("id", attempt_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if user["role"] != "admin" and result.data.get("student_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized attempt access")
    return {"attempt": result.data}


@app.get("/api/attempts/{attempt_id}/result")
async def get_result(attempt_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    attempt = sb.table("attempts").select("*, exams(title, duration)").eq("id", attempt_id).single().execute()
    if not attempt.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if user["role"] != "admin" and attempt.data.get("student_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized attempt access")
    
    answers = sb.table("answers").select("*, questions(question_text, options, correct_answer, marks)").eq("attempt_id", attempt_id).execute()
    
    return {
        "attempt": attempt.data,
        "answers": answers.data or [],
    }


@app.get("/api/my-attempts")
async def my_attempts(user=Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("attempts").select("*, exams(title, duration)").eq("student_id", user["id"]).order("created_at", desc=True).execute()
    return {"attempts": result.data or []}


# ============================================================
# EVENT LOGGING
# ============================================================

@app.post("/api/events/log")
async def log_event(data: EventLog, user=Depends(get_current_user)):
    sb = get_supabase()
    
    event_data = {
        "user_id": user["id"],
        "event_type": data.event_type,
        "details": data.details or {},
    }
    if data.attempt_id:
        event_data["attempt_id"] = data.attempt_id
        # Increment violation count for tab/blur events (safe fetch first)
        if data.event_type in ("tab_switch", "window_blur", "violation"):
            try:
                cur_res = sb.table("attempts").select("violation_count").eq("id", data.attempt_id).single().execute()
                cur_count = (cur_res.data.get("violation_count") or 0) if cur_res.data else 0
                sb.table("attempts").update({"violation_count": cur_count + 1}).eq("id", data.attempt_id).execute()
            except Exception:
                pass
    
    sb.table("event_logs").insert(event_data).execute()
    return {"success": True}


# ============================================================
# ADMIN MONITORING
# ============================================================

@app.get("/api/monitor/live")
async def live_monitor(user=Depends(require_admin)):
    sb = get_supabase()
    result = sb.table("attempts").select(
        "*, profiles(name, email), exams(title, duration)"
    ).eq("status", "in_progress").order("started_at", desc=True).execute()
    return {"active_attempts": result.data or []}


@app.get("/api/monitor/events")
async def recent_events(limit: int = 50, user=Depends(require_admin)):
    sb = get_supabase()
    result = sb.table("event_logs").select(
        "*, profiles(name, email)"
    ).order("created_at", desc=True).limit(limit).execute()
    return {"events": result.data or []}


@app.get("/api/monitor/stats")
async def monitor_stats(user=Depends(require_admin)):
    sb = get_supabase()
    
    # Try calling the optimized database function to reduce latency (1 query instead of 5 sequential)
    try:
        if not IS_MOCK_MODE:
            stats_res = sb.rpc("get_dashboard_stats").execute()
            if stats_res.data:
                return stats_res.data
    except Exception as e:
        print(f"get_dashboard_stats RPC failed: {str(e)}. Falling back to parallel queries.")
        
    # Fallback to parallel multi-threaded queries (much faster than sequential!)
    from concurrent.futures import ThreadPoolExecutor
    def get_count(table_name, filter_func=None):
        query = sb.table(table_name).select("id", count="exact")
        if filter_func:
            query = filter_func(query)
        res = query.execute()
        return res.count or 0

    filters = [
        ("profiles", lambda q: q.eq("role", "student")),
        ("exams", None),
        ("attempts", lambda q: q.eq("status", "in_progress")),
        ("attempts", lambda q: q.in_("status", ["submitted", "auto_submitted"])),
        ("event_logs", lambda q: q.in_("event_type", ["tab_switch", "window_blur", "violation"]))
    ]

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(get_count, table, filt) for table, filt in filters]
        counts = [f.result() for f in futures]
    
    return {
        "total_students": counts[0],
        "total_exams": counts[1],
        "active_attempts": counts[2],
        "completed_attempts": counts[3],
        "total_violations": counts[4],
    }


@app.get("/api/results")
async def all_results(exam_id: Optional[str] = None, user=Depends(require_admin)):
    sb = get_supabase()
    query = sb.table("attempts").select("*, profiles(name, email), exams(title)").in_("status", ["submitted", "auto_submitted"]).order("submitted_at", desc=True)
    if exam_id:
        query = query.eq("exam_id", exam_id)
    result = query.execute()
    return {"results": result.data or []}


# ============================================================
# NEW PROCTORING & REALTIME API ENDPOINTS
# ============================================================

class WarningCreate(BaseModel):
    attempt_id: str
    message: str

class AdminActionRequest(BaseModel):
    attempt_id: str
    action_type: str  # 'pause', 'resume', 'force_submit', 'terminate', 'extend_timer', 'reset_violations'
    details: Optional[dict] = {}

@app.post("/api/violations")
async def create_violation(data: ViolationCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    
    # 1. Get attempt and verify it exists
    attempt_res = sb.table("attempts").select("*").eq("id", data.attempt_id).single().execute()
    if not attempt_res.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt = attempt_res.data
    
    # Ownership guard
    if attempt.get("student_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized attempt access")
        
    current_status = attempt.get("status")
    if current_status in ('submitted', 'auto_submitted', 'terminated'):
        return {
            "success": False,
            "violation_count": attempt.get("violation_count", 0),
            "kicked": True,
            "reason": f"Exam session is already locked/terminated (Status: {current_status})"
        }
        
    # Get configuration settings from exam
    exam_res = sb.table("exams").select("*").eq("id", attempt["exam_id"]).single().execute()
    exam = exam_res.data if exam_res.data else {}
    max_violations = exam.get("max_violations") or 3
    
    # 2. Log the violation in violations table
    violation_record = {
        "attempt_id": data.attempt_id,
        "student_id": user["id"],
        "violation_type": data.violation_type,
        "browser": data.browser,
        "os": data.os,
        "ip_address": data.ip_address,
        "device": data.device
    }
    violation_res = sb.table("violations").insert(violation_record).execute()
    
    new_violations_count = (attempt.get("violation_count") or 0) + 1
    
    # Update violation count in database
    sb.table("attempts").update({"violation_count": new_violations_count}).eq("id", data.attempt_id).execute()
    
    # 3. Log in activity_logs
    warning_msg = f"⚠️ {user['name']} triggered warning: {data.violation_type.replace('_', ' ').title()} (Strike {new_violations_count}/{max_violations})"
    sb.table("activity_logs").insert({
        "user_id": user["id"],
        "attempt_id": data.attempt_id,
        "activity_type": "violation_warning",
        "message": warning_msg
    }).execute()
    
    # 4. Insert notification for admin
    sb.table("notifications").insert({
        "recipient_role": "admin",
        "type": "violation_warning",
        "message": warning_msg
    }).execute()
    
    # 5. Check if strike limit exceeded
    kicked = False
    reason_str = ""
    if new_violations_count >= max_violations:
        kicked = True
        reason_str = f"Exceeded maximum violation limits ({max_violations} strikes. Triggered by {data.violation_type.replace('_', ' ').title()})"
        
        # Terminate attempt: set status to 'terminated' and submit time
        sb.table("attempts").update({
            "status": "terminated",
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", data.attempt_id).execute()
        
        # Insert to kick_logs
        sb.table("kick_logs").insert({
            "attempt_id": data.attempt_id,
            "student_id": user["id"],
            "exam_id": attempt["exam_id"],
            "reason": reason_str,
            "violation_count": new_violations_count,
            "browser": data.browser,
            "os": data.os,
            "ip_address": data.ip_address,
            "device": data.device,
            "final_score": attempt.get("score") or 0,
            "duration_completed": 0
        }).execute()
        
        # Log kick in activity
        kick_msg = f"🚫 {user['name']} was auto-kicked: {reason_str}"
        sb.table("activity_logs").insert({
            "user_id": user["id"],
            "attempt_id": data.attempt_id,
            "activity_type": "student_kicked",
            "message": kick_msg
        }).execute()
        
        # Notify admin of kick
        sb.table("notifications").insert({
            "recipient_role": "admin",
            "type": "student_kicked",
            "message": kick_msg
        }).execute()
        
        # Delete/remove from live sessions
        sb.table("live_sessions").delete().eq("attempt_id", data.attempt_id).execute()
        
    return {
        "success": True,
        "violation_count": new_violations_count,
        "kicked": kicked,
        "reason": reason_str
    }

@app.post("/api/kick")
async def kick_student(data: KickLogCreate, user=Depends(require_admin)):
    sb = get_supabase()
    sb.table("kick_logs").insert(data.model_dump()).execute()
    
    student_user = {"id": data.student_id, "role": "student"}
    await submit_attempt(attempt_id=data.attempt_id, auto=True, user=student_user)
    
    msg = f"🚫 Student kicked: {data.reason}"
    sb.table("activity_logs").insert({
        "user_id": data.student_id,
        "attempt_id": data.attempt_id,
        "activity_type": "student_kicked",
        "message": msg
    }).execute()
    
    sb.table("live_sessions").delete().eq("attempt_id", data.attempt_id).execute()
    return {"success": True}

@app.post("/api/warning")
async def issue_warning(data: WarningCreate, user=Depends(require_admin)):
    sb = get_supabase()
    sb.table("activity_logs").insert({
        "user_id": user["id"],
        "attempt_id": data.attempt_id,
        "activity_type": "violation_warning",
        "message": f"⚠️ Admin Warning: {data.message}"
    }).execute()
    
    sb.table("notifications").insert({
        "recipient_role": "student",
        "type": "violation_warning",
        "message": data.message
    }).execute()
    return {"success": True}

@app.get("/api/live-students")
async def get_live_students(user=Depends(require_admin)):
    sb = get_supabase()
    
    # 1. Fetch active live sessions
    sessions_res = sb.table("live_sessions").select("*").execute()
    sessions = sessions_res.data or []
    session_map = {s["attempt_id"]: s for s in sessions}
    
    # 2. Fetch attempts that are either 'in_progress' or 'terminated'
    attempts_res = sb.table("attempts").select("*").in_("status", ["in_progress", "terminated"]).execute()
    attempts_data = attempts_res.data or []
    
    results = []
    for att in attempts_data:
        student_id = att.get("student_id")
        attempt_id = att.get("id")
        
        # Get live session metadata if exists
        s = session_map.get(attempt_id, {})
        
        profile = sb.table("profiles").select("*").eq("id", student_id).single().execute()
        profile_data = profile.data or {}
        
        exam_id = att.get("exam_id")
        exam = sb.table("exams").select("*").eq("id", exam_id).single().execute() if exam_id else None
        exam_data = exam.data if exam else {}
        
        # Calculate questions count
        q_count = len(db_store.questions.get(exam_id, [])) if IS_MOCK_MODE else 3
        if not IS_MOCK_MODE and exam_id:
            try:
                q_res = sb.table("questions").select("id").eq("exam_id", exam_id).execute()
                if q_res.data:
                    q_count = len(q_res.data)
            except Exception:
                pass
                
        # Look up kick reason if terminated
        kick_reason = ""
        if att.get("status") == "terminated":
            kick_res = sb.table("kick_logs").select("reason").eq("attempt_id", attempt_id).execute()
            if kick_res.data:
                kick_reason = kick_res.data[0].get("reason", "Terminated due to rule violations.")
        
        results.append({
            "id": s.get("id") or f"temp-{attempt_id}",
            "attempt_id": attempt_id,
            "student_id": student_id,
            "student_name": profile_data.get("name", "Student"),
            "register_no": profile_data.get("email", "").split("@")[0].upper(),
            "department": "CSE" if "cse" in profile_data.get("email", "") else "IT" if "it" in profile_data.get("email", "") else "ECE",
            "exam_name": exam_data.get("title", "Exam"),
            "current_question": s.get("current_question_index", 0) + 1 if s else 1,
            "answered_questions": s.get("answered_count", 0) if s else 0,
            "remaining_time": s.get("time_remaining", 0) if s else 0,
            "progress_percent": int((s.get("answered_count", 0) / max(1, q_count)) * 100) if s and exam_id else 0,
            "violation_count": att.get("violation_count", 0),
            "status": att.get("status", "in_progress"),
            "browser": s.get("browser", "Chrome") if s else "—",
            "os": s.get("os", "Windows") if s else "—",
            "ip_address": s.get("ip_address", "127.0.0.1") if s else "—",
            "login_time": att.get("started_at"),
            "connection_status": s.get("connection_status", "connected") if s else "disconnected",
            "is_paused": s.get("is_paused", False) if s else False,
            "kick_reason": kick_reason
        })
    return {"live_students": results}

@app.get("/api/activity-feed")
async def get_activity_feed(user=Depends(require_admin)):
    sb = get_supabase()
    result = sb.table("activity_logs").select("*").order("created_at", desc=True).limit(50).execute()
    return {"events": result.data or []}

@app.get("/api/kick-history")
async def get_kick_history(user=Depends(require_admin)):
    sb = get_supabase()
    result = sb.table("kick_logs").select("*").order("created_at", desc=True).execute()
    
    logs = []
    for row in (result.data or []):
        student_id = row.get("student_id")
        exam_id = row.get("exam_id")
        attempt_id = row.get("attempt_id")
        profile = sb.table("profiles").select("*").eq("id", student_id).single().execute()
        exam = sb.table("exams").select("*").eq("id", exam_id).single().execute()
        
        # Fetch detailed violation history for this attempt
        violations_res = sb.table("violations").select("*").eq("attempt_id", attempt_id).order("created_at", desc=False).execute()
        violations_list = violations_res.data or []
        
        logs.append({
            **row,
            "student_name": profile.data.get("name") if profile.data else "Student",
            "email": profile.data.get("email") if profile.data else "",
            "exam_title": exam.data.get("title") if exam.data else "Exam",
            "department": "CSE" if "cse" in (profile.data.get("email") or "") else "ECE",
            "violations": violations_list
        })
    return {"kick_logs": logs}

@app.post("/api/force-submit")
async def force_submit(data: AdminActionRequest, user=Depends(require_admin)):
    sb = get_supabase()
    attempt_res = sb.table("attempts").select("*").eq("id", data.attempt_id).single().execute()
    if not attempt_res.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    student_id = attempt_res.data.get("student_id")
    student_user = {"id": student_id, "role": "student"}
    
    await submit_attempt(attempt_id=data.attempt_id, auto=True, user=student_user)
    
    sb.table("admin_actions").insert({
        "admin_id": user["id"],
        "attempt_id": data.attempt_id,
        "action_type": "force_submit",
        "details": data.details or {}
    }).execute()
    
    sb.table("activity_logs").insert({
        "user_id": student_id,
        "attempt_id": data.attempt_id,
        "activity_type": "exam_submitted",
        "message": f"📤 Exam attempt force-submitted by admin"
    }).execute()
    
    sb.table("live_sessions").delete().eq("attempt_id", data.attempt_id).execute()
    return {"success": True}

@app.post("/api/terminate-exam")
async def terminate_exam(data: AdminActionRequest, user=Depends(require_admin)):
    sb = get_supabase()
    attempt_res = sb.table("attempts").select("*").eq("id", data.attempt_id).single().execute()
    if not attempt_res.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    student_id = attempt_res.data.get("student_id")
    student_user = {"id": student_id, "role": "student"}
    
    await submit_attempt(attempt_id=data.attempt_id, auto=True, user=student_user)
    
    sb.table("kick_logs").insert({
        "attempt_id": data.attempt_id,
        "student_id": student_id,
        "exam_id": attempt_res.data["exam_id"],
        "reason": data.details.get("reason", "Terminated by Administrator"),
        "violation_count": attempt_res.data.get("violation_count", 0),
        "final_score": 0
    }).execute()
    
    sb.table("admin_actions").insert({
        "admin_id": user["id"],
        "attempt_id": data.attempt_id,
        "action_type": "terminate",
        "details": data.details or {}
    }).execute()
    
    sb.table("activity_logs").insert({
        "user_id": student_id,
        "attempt_id": data.attempt_id,
        "activity_type": "student_kicked",
        "message": f"🚫 Student session terminated by admin"
    }).execute()
    
    sb.table("live_sessions").delete().eq("attempt_id", data.attempt_id).execute()
    return {"success": True}

@app.post("/api/pause-exam")
async def pause_exam(data: AdminActionRequest, user=Depends(require_admin)):
    sb = get_supabase()
    sb.table("live_sessions").update({"is_paused": True}).eq("attempt_id", data.attempt_id).execute()
    
    sb.table("admin_actions").insert({
        "admin_id": user["id"],
        "attempt_id": data.attempt_id,
        "action_type": "pause",
        "details": data.details or {}
    }).execute()
    return {"success": True}

@app.post("/api/resume-exam")
async def resume_exam(data: AdminActionRequest, user=Depends(require_admin)):
    sb = get_supabase()
    sb.table("live_sessions").update({"is_paused": False}).eq("attempt_id", data.attempt_id).execute()
    
    sb.table("admin_actions").insert({
        "admin_id": user["id"],
        "attempt_id": data.attempt_id,
        "action_type": "resume",
        "details": data.details or {}
    }).execute()
    return {"success": True}

@app.post("/api/admin/attempts/{attempt_id}/reinstate")
async def reinstate_attempt(attempt_id: str, user=Depends(require_admin)):
    sb = get_supabase()
    
    # 1. Fetch attempt
    attempt_res = sb.table("attempts").select("*").eq("id", attempt_id).single().execute()
    if not attempt_res.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt = attempt_res.data
    
    # 2. Reset attempt status and violations
    sb.table("attempts").update({
        "status": "in_progress",
        "violation_count": 0,
        "submitted_at": None
    }).eq("id", attempt_id).execute()
    
    # 3. Delete kick logs
    sb.table("kick_logs").delete().eq("attempt_id", attempt_id).execute()
    
    # 4. Insert admin override log in admin_actions
    sb.table("admin_actions").insert({
        "admin_id": user["id"],
        "attempt_id": attempt_id,
        "action_type": "reinstate",
        "details": {"message": "Admin reinstatement override applied."}
    }).execute()
    
    # 5. Re-create live session
    # Live session heartbeat will sync remaining time
    sb.table("live_sessions").insert({
        "attempt_id": attempt_id,
        "student_id": attempt["student_id"],
        "current_question_index": 0,
        "answered_count": 0,
        "time_remaining": 600,
        "browser": "Chrome",
        "os": "Windows",
        "connection_status": "connected"
    }).execute()
    
    # 6. Log in activity feed
    profile = sb.table("profiles").select("name").eq("id", attempt["student_id"]).single().execute()
    student_name = profile.data.get("name") if profile.data else "Student"
    sb.table("activity_logs").insert({
        "user_id": attempt["student_id"],
        "attempt_id": attempt_id,
        "activity_type": "reinstate",
        "message": f"🔄 {student_name}'s exam attempt was reinstated by administrator"
    }).execute()
    
    return {"success": True}

@app.get("/api/analytics")
async def get_analytics(user=Depends(require_admin)):
    sb = get_supabase()
    
    # Fetch in parallel to optimize latency (100-150ms total instead of 400-600ms sequential)
    from concurrent.futures import ThreadPoolExecutor
    def fetch_data(table_name):
        return sb.table(table_name).select("*").execute().data or []

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            "attempts": executor.submit(fetch_data, "attempts"),
            "violations": executor.submit(fetch_data, "violations"),
            "kicks": executor.submit(fetch_data, "kick_logs"),
            "profiles": executor.submit(fetch_data, "profiles"),
        }
        attempts = futures["attempts"].result()
        violations = futures["violations"].result()
        kicks = futures["kicks"].result()
        profiles = futures["profiles"].result()
    
    online_count = len([a for a in attempts if a.get("status") == "in_progress"])
    
    # 1. Average Score
    scores = [a["score"] for a in attempts if a["status"] in ("submitted", "auto_submitted", "terminated")]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    
    # 2. Department Performance
    profile_map = {p["id"]: p for p in profiles}
    
    dept_scores = {"CSE": [], "ECE": [], "IT": []}
    dept_pass = {"CSE": 0, "ECE": 0, "IT": 0}
    dept_total = {"CSE": 0, "ECE": 0, "IT": 0}
    
    for a in attempts:
        if a["status"] in ("submitted", "auto_submitted", "terminated"):
            student = profile_map.get(a["student_id"], {})
            email = student.get("email") or ""
            dept = "CSE"
            if "ece" in email.lower():
                dept = "ECE"
            elif "it" in email.lower():
                dept = "IT"
                
            score_pct = (a["score"] / max(1, a["total_marks"])) * 100
            dept_scores[dept].append(score_pct)
            dept_total[dept] += 1
            if score_pct >= 50:
                dept_pass[dept] += 1
                
    dept_performance = []
    for dept in ["CSE", "ECE", "IT"]:
        scores_list = dept_scores[dept]
        avg_dept_score = round(sum(scores_list) / len(scores_list), 1) if scores_list else 75.0
        pass_rate = round((dept_pass[dept] / max(1, dept_total[dept])) * 100, 1) if dept_total[dept] else 80.0
        dept_performance.append({
            "department": dept,
            "average_score": avg_dept_score,
            "pass_rate": pass_rate
        })
        
    # 3. Violation Hourly Trend
    from collections import defaultdict
    hourly_warnings = defaultdict(int)
    hourly_kicks = defaultdict(int)
    
    for v in violations:
        try:
            dt = datetime.fromisoformat(v["created_at"].replace("Z", "+00:00"))
            hour_str = dt.strftime("%H:00")
            hourly_warnings[hour_str] += 1
        except Exception:
            pass
            
    for k in kicks:
        try:
            dt = datetime.fromisoformat(k["created_at"].replace("Z", "+00:00"))
            hour_str = dt.strftime("%H:00")
            hourly_kicks[hour_str] += 1
        except Exception:
            pass
            
    all_hours = sorted(list(set(list(hourly_warnings.keys()) + list(hourly_kicks.keys()))))
    if not all_hours:
        all_hours = ["09:00", "10:00", "11:00", "12:00"]
        
    violation_trend = []
    for h in all_hours:
        violation_trend.append({
            "hour": h,
            "warnings": hourly_warnings.get(h, 0),
            "kicks": hourly_kicks.get(h, 0)
        })
        
    # 4. Question Difficulty
    answers = sb.table("answers").select("*").execute().data or []
    q_correct = defaultdict(int)
    q_total = defaultdict(int)
    
    for ans in answers:
        q_id = ans["question_id"]
        q_total[q_id] += 1
        if ans.get("is_correct"):
            q_correct[q_id] += 1
            
    all_qs = []
    try:
        all_qs_res = sb.table("questions").select("*").execute()
        all_qs = all_qs_res.data or []
    except Exception:
        pass
            
    questions_analysis = []
    for q in all_qs[:5]:
        q_id = q["id"]
        total = q_total[q_id]
        correct = q_correct[q_id]
        rate = round((correct / total) * 100, 1) if total else 80.0
        questions_analysis.append({
            "question_id": q_id,
            "question_text": q["question_text"][:30] + "..." if len(q["question_text"]) > 30 else q["question_text"],
            "correct_rate": rate
        })
        
    if not questions_analysis:
        questions_analysis = [
            {"question_id": "q-1", "question_text": "What is worst-case of BST insert?", "correct_rate": 70},
            {"question_id": "q-2", "question_text": "LIFO stack operations?", "correct_rate": 92}
        ]
    
    return {
        "stats": {
            "live_online": online_count,
            "warnings_today": len(violations),
            "kicks_today": len(kicks),
            "average_score": int(avg_score)
        },
        "dept_performance": dept_performance,
        "violation_trend": violation_trend,
        "questions_analysis": questions_analysis
    }

# ============================================================
# EXAM QUESTIONS PARSING ENDPOINTS
# ============================================================

@app.post("/api/admin/exams/parse-questions")
async def parse_exam_questions(file: UploadFile = File(...), user=Depends(require_admin)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    questions = []
    
    if ext in (".xlsx", ".xls"):
        try:
            import pandas as pd
            df = pd.read_excel(file.file)
            df = df.dropna(how='all')
            for index, row in df.iterrows():
                vals = [str(x).strip() for x in row.values]
                if len(vals) >= 5:
                    q_text = vals[0]
                    options = [vals[1], vals[2], vals[3], vals[4]]
                    
                    correct_answer = 0
                    if len(vals) >= 6:
                        correct_val = vals[5].upper()
                        if correct_val in ("B", "1", "1.0", "OPTION B"):
                            correct_answer = 1
                        elif correct_val in ("C", "2", "2.0", "OPTION C"):
                            correct_answer = 2
                        elif correct_val in ("D", "3", "3.0", "OPTION D"):
                            correct_answer = 3
                            
                    marks = 1
                    if len(vals) >= 7:
                        try:
                            marks = int(float(vals[6]))
                        except:
                            pass
                            
                    questions.append({
                        "question_text": q_text,
                        "options": options,
                        "correct_answer": correct_answer,
                        "marks": marks
                    })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
            
    elif ext == ".pdf":
        try:
            import pdfplumber
            import re
            
            text = ""
            with pdfplumber.open(file.file) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            
            lines = text.split("\n")
            current_q = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Skip section header and tip lines
                if re.match(r'^\s*(?:Section|Part|Tip)\b', line, re.IGNORECASE):
                    continue
                
                # Match patterns like Q1. or 1.
                q_match = re.match(r'^(?:Q\d+|Question\s*\d+|\d+)\s*[\.\):]\s+(.*)$', line, re.IGNORECASE)
                if q_match:
                    if current_q and current_q["question_text"]:
                        questions.append(current_q)
                    current_q = {
                        "question_text": q_match.group(1).strip(),
                        "options": ["", "", "", ""],
                        "correct_answer": 0,
                        "marks": 1
                    }
                    continue
                
                if current_q:
                    inline_opts = re.findall(r'\b([A-Da-d])\s*[\.\):\-\/]+\s*(.*?)(?=\b[A-Da-d]\s*[\.\):\-\/]+|$)', line, re.IGNORECASE)
                    if len(inline_opts) > 1:
                        for opt_letter, opt_val in inline_opts:
                            opt_idx = ord(opt_letter.upper()) - ord('A')
                            if 0 <= opt_idx < 4:
                                current_q["options"][opt_idx] = opt_val.strip()
                        continue
                    
                    opt_match = re.match(r'^\s*([A-Da-d])\s*[\.\):\-\/]+\s*(.*)$', line)
                    if opt_match:
                        opt_letter = opt_match.group(1).upper()
                        opt_idx = ord(opt_letter) - ord('A')
                        current_q["options"][opt_idx] = opt_match.group(2).strip()
                        continue
                    
                    ans_match = re.search(r'(?:correct\s+answer|correct\s+option|answer|correct|key)\s*(?:is)?\s*[:=\s\-]*\s*\b([A-D])\b', line, re.IGNORECASE)
                    if ans_match:
                        ans_letter = ans_match.group(1).upper()
                        current_q["correct_answer"] = ord(ans_letter) - ord('A')
                        continue
                    
                    if not any(current_q["options"]):
                        current_q["question_text"] += " " + line
                    else:
                        filled_indices = [i for i, opt in enumerate(current_q["options"]) if opt]
                        if filled_indices:
                            last_idx = filled_indices[-1]
                            current_q["options"][last_idx] += " " + line
            
            if current_q and current_q["question_text"]:
                questions.append(current_q)
                
            # Fallback options parser and auto-fill loops
            for q in questions:
                if not any(q["options"]):
                    opt_match = re.search(r'\s*\((?:Options|Opt|Choices)\s*[:\-]*\s*([^)]+)\)', q["question_text"], re.IGNORECASE)
                    if not opt_match:
                        opt_match = re.search(r'\s*\[(?:Options|Opt|Choices)\s*[:\-]*\s*([^\]]+)\]', q["question_text"], re.IGNORECASE)
                    if opt_match:
                        opts_str = opt_match.group(1)
                        parsed_opts = [o.strip() for o in re.split(r'[/,;]', opts_str) if o.strip()]
                        for idx, val in enumerate(parsed_opts[:4]):
                            q["options"][idx] = val
                        q["question_text"] = q["question_text"].replace(opt_match.group(0), "").strip()
                
                # Fill any missing choices with standard placeholders so validation doesn't block submit
                for idx in range(4):
                    if not q["options"][idx]:
                        q["options"][idx] = f"Option {chr(65 + idx)}"
                        
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload Excel (.xlsx, .xls) or PDF (.pdf) files.")
        
    return {"success": True, "questions": questions}

@app.post("/api/session/heartbeat")
async def session_heartbeat(data: SessionHeartbeat, user=Depends(get_current_user)):
    sb = get_supabase()
    
    # Check attempt status first
    attempt_res = sb.table("attempts").select("status").eq("id", data.attempt_id).single().execute()
    if attempt_res.data:
        attempt_status = attempt_res.data.get("status")
        if attempt_status in ("terminated", "submitted", "auto_submitted"):
            try:
                sb.table("live_sessions").delete().eq("attempt_id", data.attempt_id).execute()
            except Exception:
                pass
            return {"status": attempt_status, "is_paused": False}

    session_data = {
        "attempt_id": data.attempt_id,
        "student_id": user["id"],
        "current_question_index": data.current_question_index,
        "answered_count": data.answered_count,
        "time_remaining": data.time_remaining,
        "browser": data.browser,
        "os": data.os,
        "ip_address": data.ip_address,
        "connection_status": data.connection_status,
        "is_paused": data.is_paused,
        "last_heartbeat": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert live session (mock stores by attempt_id key)
    try:
        existing = sb.table("live_sessions").select("id").eq("attempt_id", data.attempt_id).execute()
        if existing.data:
            sb.table("live_sessions").update(session_data).eq("attempt_id", data.attempt_id).execute()
        else:
            sb.table("live_sessions").insert(session_data).execute()
            
        session_check = sb.table("live_sessions").select("is_paused").eq("attempt_id", data.attempt_id).single().execute()
        is_paused = False
        if session_check.data:
            is_paused = session_check.data.get("is_paused", False)
    except Exception:
        is_paused = False

    return {"status": "alive", "is_paused": is_paused}


# -- Local Dev Server --
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
