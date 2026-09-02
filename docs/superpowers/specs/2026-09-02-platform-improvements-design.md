# 24GO Platform Improvements — Design Spec

## Date: 2026-09-02

## Summary
Comprehensive improvements to the 24GO lead generation platform covering:
1. Lead classification fixes
2. New "Auto-replies" section
3. Billing plans redesign
4. Blog access control + content
5. UI/UX improvements (icons, layout, naming)

---

## 1. Lead Classification Fix

**Problem:** Personal DMs (URL-only, verification codes, short messages) classified as COLD instead of SPAM.

**Solution:** Add pre-classification heuristic layer in `llm_classifier.py`:
- URL-only messages (contains `t.me/` or `http` but < 50 chars) → SPAM
- Verification codes (matches `\d{4,6}` pattern) → SPAM
- Messages < 10 chars with no keywords → SPAM
- Messages with no commercial intent keywords → COLD (not SPAM)

**Add to "All" tab:**
- Add SPAM filter button alongside HOT/WARM/COLD

---

## 2. Auto-replies Section (NEW)

**Database:** `auto_replies` table
```sql
CREATE TABLE auto_replies (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(200),
    mode VARCHAR(20) NOT NULL, -- 'keyword', 'ai_agent', 'rotation'
    keywords TEXT, -- comma-separated, for keyword/ai_agent modes
    prompt TEXT, -- for ai_agent mode
    model VARCHAR(50), -- for ai_agent mode
    api_key_encrypted TEXT, -- for ai_agent mode
    is_active BOOLEAN DEFAULT true,
    daily_limit INT DEFAULT 50,
    created_at TIMESTAMPTZ
);

CREATE TABLE auto_reply_answers (
    id UUID PRIMARY KEY,
    auto_reply_id UUID REFERENCES auto_replies(id),
    text TEXT NOT NULL,
    sort_order INT DEFAULT 0
);
```

**Modes:**
- **A) Keyword:** Match keywords (substring) → random answer from list
- **B) AI Agent:** Match keywords → AI generates response using prompt + incoming message
- **C) Rotation:** Any message → random answer from list (no keywords)

**Typing simulation:** 5-30 sec random delay before sending.

**Daily limits:** Starter=50, Pro=500, Enterprise=5000

---

## 3. Billing Plans Redesign

**Plan structure:**

| Feature | Trial | Starter ($75) | Pro ($199) | Enterprise ($499) |
|---------|-------|---------------|------------|-------------------|
| Duration | 3 days | Monthly | Monthly | Monthly |
| Posts/mo | 100 | 1,500 | 7,500 | Unlimited |
| Accounts | 2 | 5 | 20 | Unlimited |
| Groups | 10 | 100 | 500 | Unlimited |
| Analytics | ✅ | ✅ | ✅ | ✅ |
| Leads | ✅ | ✅ | ✅ | ✅ |
| Scoring Rules | ✅ | ✅ | ✅ | ✅ |
| Groups | ✅ | ✅ | ✅ | ✅ |
| Accounts | ✅ | ✅ | ✅ | ✅ |
| Campaigns | ✅ | ✅ | ✅ | ✅ |
| Auto-replies | ✅ | ✅ | ✅ | ✅ |
| Targets | ✅ | ✅ | ✅ | ✅ |
| Mailings | ✅ | ❌ | ✅ | ✅ |
| Team (Users) | ✅ | ❌ | ❌ | ✅ |
| API | ❌ | ❌ | ❌ | ✅ |
| Blog | Owner | Owner | Owner | Owner |
| Audit Log | Owner | Owner | Owner | Owner |
| Health | Owner | Owner | Owner | Owner |

---

## 4. Blog Admin Access

**Problem:** Any authenticated user can CRUD blog posts.

**Solution:** Add role check in `blog.py` admin endpoints:
```python
if current_user.role != "owner":
    raise HTTPException(403, "Blog management is restricted to platform owner")
```

**Owner:** `rf24krsk@gmail.com` (hardcoded or via env var)

---

## 5. Blog Articles

Write 16 SEO-optimized articles in EN/RU covering:
1. How to use 24GO for lead generation
2. Telegram marketing for real estate
3. VK advertising for business
4. AI-powered lead qualification
5. Mass mailing best practices
6. Group monitoring strategies
7. Account warmup guide
8. Lead scoring explained
9. Campaign management tips
10. Analytics and reporting
11. Multi-platform marketing
12. Compliance and safety
13. Team collaboration
14. API integration
15. Case studies
16. Getting started guide

---

## 6. Rename "Scoring" → "Правила лидов"

Update:
- Sidebar navigation label
- i18n keys (scoring → lead_rules)
- Page title

---

## 7. Mailings Import Fix

**Current:** CSV with columns (username, first_name)
**New:** Plain text file, 1 username per line

Backend: Parse line-by-line, extract @username from each line.
Frontend: Change file input accept to `.txt`, update UI text.

---

## 8. Icon Library Replacement

**Current:** Custom SVGs in Icons.tsx + raw emoji everywhere
**New:** Install `lucide-react` (already available via Next.js)

Replace all emoji with proper lucide-react icons:
- 📊 → BarChart3
- 💬 → MessageSquare
- ✈️ → Send
- 📅 → Calendar
- 🔵 → Globe
- 💰 → CreditCard
- ⚙️ → Settings
- 📋 → FileText
- 👥 → Users
- 🎯 → Target
- 📧 → Mail
- etc.

---

## 9. Settings Page Layout

Fix `max-w-6xl mx-auto` centering.
Fix responsive layout for mobile sidebar navigation.

---

## 10. Access Control by Plan

Add plan-based route guards in frontend:
- Check user's subscription plan
- Hide/disable routes not available for their plan
- Show upgrade prompt when accessing locked features

---

## Implementation Order

1. Lead classification fix (quick, high impact)
2. Rename Scoring → Правила лидов (quick)
3. Blog admin access control (quick, security)
4. Mailings import fix (quick)
5. Auto-replies section (new feature, medium)
6. Billing plans redesign (content + UI)
7. Blog articles (content)
8. Icon library replacement (UI)
9. Settings layout fix (UI)
10. Access control by plan (medium)
