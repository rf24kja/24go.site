"""
24GO Full Feature Test v2 — Correct schemas
"""
import json, urllib.request, urllib.error, uuid

BASE = "https://api.24go.site"
PASSED = 0
FAILED = 0
RESULTS = []


def api(method, path, data=None, token=None, timeout=30):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        raw = r.read().decode()
        try:
            return r.status, json.loads(raw)
        except Exception:
            return r.status, raw[:2000]
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:500]
    except Exception as e:
        return 0, str(e)[:300]


def expect(name, actual, expected, exact=False):
    global PASSED, FAILED
    if exact:
        ok = actual == expected
    else:
        ok = str(expected) in str(actual) or actual == expected
    if ok:
        PASSED += 1
        RESULTS.append((name, "PASS", ""))
    else:
        FAILED += 1
        RESULTS.append((name, "FAIL", "expected %s, got %s" % (expected, actual)))


print("=" * 70)
print("24GO FULL FEATURE TEST v2")
print("=" * 70)

# ============ AUTH ============
print("\n-- AUTH --")
email = "v2test_%s@synthetictest.run" % uuid.uuid4().hex[:8]
s, b = api("POST", "/api/v1/auth/register", {
    "company_name": "V2TestCo",
    "email": email,
    "password": "V2Test2026!"
})
expect("Register", s, 201)
token = b.get("access_token", "") if isinstance(b, dict) else ""
expect("Has token", bool(token), True, exact=True)

# ============ MAILINGS ============
print("\n-- MAILINGS --")

# Create mailing (correct schema: name, message_text, platform, delay_seconds)
s, b = api("POST", "/api/v1/mailings/", {
    "name": "Test Mailing Campaign",
    "message_text": "Hi {first_name}! Check out our offers at 24go.site",
    "platform": "telegram",
    "delay_seconds": 60,
}, token=token)
mailing_id = b.get("id", "") if isinstance(b, dict) else ""
expect("Create mailing", s in (200, 201), True, exact=True)
print("  Mailing ID:", mailing_id)

# List mailings
s, b = api("GET", "/api/v1/mailings/", token=token)
mailings = b.get("items", []) if isinstance(b, dict) else []
expect("List mailings", s, 200)
expect("Mailings count >= 1", len(mailings) >= 1, True, exact=True)

# Get mailing detail
if mailing_id:
    s, b = api("GET", "/api/v1/mailings/%s" % mailing_id, token=token)
    expect("Get mailing detail", s, 200)

# Import recipients (correct schema: {file: "csv_content"})
csv_content = "username,first_name\n@user1,John\n@user2,Maria\n@user3,Alex\n@user4,Sara\n@user5,Mike"
s, b = api("POST", "/api/v1/mailings/import?mailing_id=%s" % mailing_id, {
    "file": csv_content,
}, token=token)
expect("Import recipients", s in (200, 201), True, exact=True)
imported = b.get("imported", 0) if isinstance(b, dict) else 0
expect("Imported 5 recipients", imported, 5, exact=True)
print("  Imported:", imported)

# Start mailing (will fail without connected accounts but should accept)
s, b = api("POST", "/api/v1/mailings/%s/start" % mailing_id, token=token)
expect("Start mailing accepted", s in (200, 201, 400), True, exact=True)

# Pause
s, b = api("POST", "/api/v1/mailings/%s/pause" % mailing_id, token=token)
expect("Pause mailing", s in (200, 400), True, exact=True)

# Stop
s, b = api("POST", "/api/v1/mailings/%s/stop" % mailing_id, token=token)
expect("Stop mailing", s in (200, 400), True, exact=True)

# ============ ACCOUNTS ============
print("\n-- ACCOUNTS --")

# List accounts
s, b = api("GET", "/api/v1/accounts", token=token)
accounts = b.get("items", []) if isinstance(b, dict) else []
expect("List accounts", s, 200)

# Add account (correct schema: platform, account_identifier)
s, b = api("POST", "/api/v1/accounts/", {
    "platform": "telegram",
    "account_identifier": "+66920009999",
    "session_data": "",
}, token=token)
new_acc_id = b.get("id", "") if isinstance(b, dict) else ""
expect("Add account", s in (200, 201), True, exact=True)
print("  New account ID:", new_acc_id)

# Bulk import endpoint
s, b = api("POST", "/api/v1/accounts/bulk-import", {
    "files": []
}, token=token)
expect("Bulk import endpoint", s in (200, 226, 400, 422), True, exact=True)

# ============ TG CONNECT (asyncpg fix check) ============
print("\n-- TG CONNECT (asyncpg fix) --")

if new_acc_id:
    s, b = api("POST", "/api/v1/accounts/%s/connect" % new_acc_id, {
        "phone": "+66920009999"
    }, token=token)
    # Should NOT crash with 'asyncpg is not defined'
    is_asyncpg_error = "asyncpg" in str(b) and "not defined" in str(b)
    expect("No asyncpg crash", not is_asyncpg_error, True, exact=True)
    print("  TG connect:", s, str(b)[:150])

# ============ LEAD CLASSIFICATION ============
print("\n-- LEAD CLASSIFICATION --")

test_msgs = [
    ("@test_buy", "I want to buy an apartment", "HOT"),
    ("@test_spam", "FREE BITCOIN CLICK HERE", "SPAM"),
    ("@test_cold", "Hello", "COLD"),
    ("@test_warm", "Tell me more about your services", "WARM"),
]

for handle, msg, expected in test_msgs:
    s, b = api("POST", "/api/v1/leads/qualify", {
        "user_handle": handle,
        "message_text": msg,
        "source": "feature_test",
    }, token=token, timeout=60)
    intent = b.get("intent_score", "?") if isinstance(b, dict) else "?"
    conf = b.get("confidence", 0) if isinstance(b, dict) else 0
    match = intent == expected
    icon = "OK " if match else "!! "
    print("  %s%-20s expected=%-5s got=%-5s conf=%.2f" % (icon, handle, expected, intent, conf))
    if match:
        PASSED += 1
        RESULTS.append(("Classify: %s" % handle, "PASS", ""))
    else:
        FAILED += 1
        RESULTS.append(("Classify: %s" % handle, "FAIL", "expected %s got %s" % (expected, intent)))

# ============ PUBLIC PAGES ============
print("\n-- PUBLIC PAGES --")

pages = ["", "login", "blog", "help", "forgot-password", "sitemap.xml", "robots.txt", "llms.txt"]
for path in pages:
    url = "https://www.24go.site/%s" % path
    try:
        r = urllib.request.urlopen(url, timeout=10)
        body = r.read().decode()
        expect("Public /%s" % (path or "root"), r.status, 200)
        if path == "":
            expect("Grid BG class", "grid-bg" in body, True, exact=True)
            expect("Language switch", ("EN" in body and "RU" in body), True, exact=True)
            expect("Blog nav link", "blog" in body.lower(), True, exact=True)
    except Exception as e:
        expect("Public /%s" % (path or "root"), "ERROR", 200)

# ============ DASHBOARD PAGES ============
print("\n-- DASHBOARD PAGES --")

for page in ["accounts", "analytics", "audit", "billing", "blog", "blog-admin",
             "campaigns", "groups", "health", "help", "leads", "mailings",
             "scoring", "settings", "targets", "users"]:
    try:
        r = urllib.request.urlopen("https://www.24go.site/%s" % page, timeout=10)
        expect("Dashboard /%s" % page, r.status, 200)
    except urllib.error.HTTPError as e:
        expect("Dashboard /%s" % page, e.code, 200)
    except Exception:
        expect("Dashboard /%s" % page, "ERROR", 200)

# ============ CAMPAIGNS ============
print("\n-- CAMPAIGNS --")

s, b = api("POST", "/api/v1/campaigns/", {
    "name": "Test Campaign",
    "base_text": "Hello! Great deals available.",
    "target_geos": ["Phuket"],
    "target_niches": ["real_estate"],
    "posts_per_day": 1,
    "timezone": "UTC",
}, token=token)
expect("Create campaign", s, 201)

s, b = api("GET", "/api/v1/campaigns", token=token)
expect("List campaigns", s, 200)

# ============ GROUPS ============
print("\n-- GROUPS --")

s, b = api("GET", "/api/v1/groups", token=token)
expect("List groups", s, 200)

s, b = api("POST", "/api/v1/groups/discover", {
    "geo_tag": "Phuket",
    "niche": "real_estate",
    "platform": "telegram",
}, token=token)
expect("Discover groups", s, 200)

# ============ ANALYTICS ============
print("\n-- ANALYTICS --")

s, b = api("GET", "/api/v1/analytics", token=token)
expect("Analytics", s, 200)

s, b = api("GET", "/api/v1/analytics/leaderboard", token=token)
expect("Leaderboard", s, 200)

s, b = api("GET", "/api/v1/audit", token=token)
expect("Audit log", s, 200)

# ============ BILLING ============
print("\n-- BILLING --")

s, b = api("GET", "/api/v1/billing/subscription", token=token)
expect("Subscription", s, 200)

for plan in ["starter", "pro", "enterprise"]:
    s, b = api("POST", "/api/v1/billing/checkout", {"plan": plan, "provider": "stripe"}, token=token)
    expect("Checkout %s" % plan, s, 200)

# ============ BLOG ============
print("\n-- BLOG --")

s, b = api("GET", "/api/v1/blog", token=token)
expect("Public blog", s, 200)

slug = "v2-test-%s" % uuid.uuid4().hex[:6]
s, b = api("POST", "/api/v1/blog/admin", {
    "slug": slug,
    "title_en": "V2 Test Post",
    "title_ru": "V2 Test Post RU",
    "content_en": "Test.",
    "content_ru": "Test RU.",
    "tags": ["test"],
    "published": True,
}, token=token)
expect("Create blog post", s, 201)

# ============ SYSTEM ============
print("\n-- SYSTEM --")

s, b = api("GET", "/health")
expect("Health", s, 200)

s, b = api("GET", "/api/v1/system/info", token=token)
expect("System info", s, 200)

s, b = api("GET", "/api/v1/listeners/status", token=token)
expect("Listeners", s, 200)

s, b = api("GET", "/api/v1/notifications/status", token=token)
expect("Notifications", s, 200)

# ============ SETTINGS ============
print("\n-- SETTINGS --")

s, b = api("GET", "/api/v1/settings", token=token)
expect("Get settings", s, 200)

# ============ SUMMARY ============
print("\n" + "=" * 70)
print("RESULTS")
print("=" * 70)

for name, status, detail in RESULTS:
    icon = "OK " if status == "PASS" else "FAIL"
    extra = " (%s)" % detail if detail else ""
    print("  [%s] %s%s" % (icon, name, extra))

print("\n" + "=" * 70)
print("TOTAL: %d passed, %d failed, %d total" % (PASSED, FAILED, PASSED + FAILED))
print("=" * 70)

if FAILED == 0:
    print("\nALL TESTS PASSED!")
else:
    print("\n%d tests failed." % FAILED)
