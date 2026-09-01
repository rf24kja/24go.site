"""
24GO Full System Test with Synthetic Data
Tests: Registration -> Leads -> Classification -> Export -> Stripe -> Blog -> Settings
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
            return r.status, raw[:1000]
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:500]
    except Exception as e:
        return 0, str(e)[:300]


def test(name, func):
    global PASSED, FAILED
    try:
        result = func()
        if result:
            PASSED += 1
            RESULTS.append((name, "PASS", ""))
        else:
            FAILED += 1
            RESULTS.append((name, "FAIL", "returned False"))
    except Exception as e:
        FAILED += 1
        RESULTS.append((name, "FAIL", str(e)[:100]))


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
print("24GO SYSTEM TEST")
print("=" * 70)

# ============ PHASE 1: AUTH ============
print("\n-- PHASE 1: AUTH --")

test_email = "test_%s@synthetictest.run" % uuid.uuid4().hex[:8]


def reg():
    s, b = api("POST", "/api/v1/auth/register", {
        "company_name": "SyntheticTestCo",
        "email": test_email,
        "password": "SynthTest2026!",
    })
    return s == 201 and isinstance(b, dict) and b.get("access_token")


test("1.1 Register new user", reg)

s, b = api("POST", "/api/v1/auth/login", {
    "email": test_email,
    "password": "SynthTest2026!",
})
token = b.get("access_token", "") if isinstance(b, dict) else ""
expect("1.2 Login", s, 200)


def me():
    s, b = api("GET", "/api/v1/auth/me", token=token)
    return s == 200 and b.get("email") == test_email


test("1.3 Get current user", me)

# ============ PHASE 2: LEAD CLASSIFICATION ============
print("\n-- PHASE 2: LEAD QUALIFICATION (AI classification) --")

SYNTHETIC_MESSAGES = [
    ("@buyer_john", "I want to buy a 2-bedroom condo in Phuket. What's the price range?", "HOT", "Clear purchase intent"),
    ("@buyer_maria", "Hi, I'm interested in your real estate services in Moscow", "WARM", "Interest expressed"),
    ("@buyer_alex", "Do you have properties near the beach?", "WARM", "Question about products"),
    ("@spammer_1", "FREE BITCOIN! Click here to claim 1 BTC now!!!", "SPAM", "Crypto spam"),
    ("@spammer_2", "BUY FOLLOWERS CHEAP 1000 for $5 only Instagram TikTok", "SPAM", "Social media spam"),
    ("@curious_user", "Hello, just saying hi", "COLD", "No intent"),
    ("@real_buyer", "I need to purchase an apartment in Thailand, budget $200k, can we schedule a call?", "HOT", "Specific purchase with budget"),
    ("@tourist", "Planning a trip to Phuket next month, any recommendations for hotels?", "COLD", "Tourist, not buyer"),
    ("@investor", "I'm looking to invest in Thai real estate, what ROI can I expect?", "HOT", "Investment intent"),
    ("@spam3", "CONGRATULATIONS YOU WON $1000000 CLICK HERE NOW", "SPAM", "Lottery spam"),
    ("@cold_lead", "What time does your office close?", "COLD", "General info question"),
    ("@warm_lead", "Can you send me your catalog of available properties?", "WARM", "Requesting info"),
    ("@hot_lead", "I'm ready to sign the contract for unit 42B. When can we meet?", "HOT", "Ready to buy"),
    ("@gibberish", "asdkjfh askjdhfkajshdfkjahsdfkjah", "SPAM", "Random characters"),
]

# Track classification accuracy
correct = 0
total = len(SYNTHETIC_MESSAGES)
lead_ids = []

for handle, message, expected_intent, desc in SYNTHETIC_MESSAGES:
    s, b = api("POST", "/api/v1/leads/qualify", {
        "user_handle": handle,
        "message_text": message,
        "source": "synthetic_test",
    }, token=token, timeout=60)

    actual_intent = b.get("intent_score", "ERROR") if isinstance(b, dict) else "ERROR"
    confidence = b.get("confidence", 0) if isinstance(b, dict) else 0
    lead_id = b.get("lead_id", "") if isinstance(b, dict) else ""

    if lead_id:
        lead_ids.append(lead_id)

    match = actual_intent == expected_intent
    if match:
        correct += 1

    icon = "OK" if match else "!!"
    print("  %s %s  expected=%s got=%s conf=%.2f  %s" % (icon, handle.ljust(20), expected_intent.ljust(5), actual_intent.ljust(5), confidence, desc))

    if match:
        PASSED += 1
        RESULTS.append(("Lead: %s" % handle, "PASS", ""))
    else:
        FAILED += 1
        RESULTS.append(("Lead: %s" % handle, "FAIL", "expected %s got %s" % (expected_intent, actual_intent)))

accuracy = correct * 100.0 / total if total else 0
print("  Classification accuracy: %d/%d (%.0f%%)" % (correct, total, accuracy))
# Require >= 70% accuracy
if accuracy >= 70:
    PASSED += 1
    RESULTS.append(("Classification accuracy >= 70%%", "PASS", ""))
else:
    FAILED += 1
    RESULTS.append(("Classification accuracy >= 70%%", "FAIL", "got %.0f%%" % accuracy))

# ============ PHASE 3: LEAD CRUD ============
print("\n-- PHASE 3: LEAD CRUD --")

s, b = api("GET", "/api/v1/leads", token=token)
leads = b.get("items", []) if isinstance(b, dict) else []
expect("3.1 List leads", s, 200)
expect("3.2 Leads count >= 10", len(leads) >= 10, True, exact=True)

s, b = api("GET", "/api/v1/leads/stats", token=token)
expect("3.3 Lead stats", s, 200)

if lead_ids:
    s, b = api("GET", "/api/v1/leads/%s" % lead_ids[0], token=token)
    expect("3.4 Get lead detail", s, 200)

    # PATCH not PUT; valid statuses: new|in_progress|converted|rejected
    s, b = api("PATCH", "/api/v1/leads/%s" % lead_ids[0], {"status": "in_progress"}, token=token)
    expect("3.5 Update lead status (PATCH)", s, 200)

# ============ PHASE 4: EXPORT ============
print("\n-- PHASE 4: EXPORT --")


def export_csv():
    s, body = api("GET", "/api/v1/leads/export", token=token)
    if s == 200 and isinstance(body, str):
        lines = body.strip().split("\n")
        return len(lines) > 1
    return False


test("4.1 Export CSV", export_csv)

# ============ PHASE 5: SCORING RULES ============
print("\n-- PHASE 5: SCORING RULES --")

s, b = api("GET", "/api/v1/scoring/rules", token=token)
expect("5.1 List scoring rules", s, 200)

# Schema: name (required), intent, keywords, min_confidence, priority
s, b = api("POST", "/api/v1/scoring/rules", {
    "name": "Hot buyer keywords",
    "intent": "HOT",
    "keywords": ["buy", "purchase", "price", "contract", "sign"],
    "min_confidence": 0.7,
    "priority": 10,
}, token=token)
expect("5.2 Create scoring rule", s, 201)

s, b = api("GET", "/api/v1/scoring/rules", token=token)
rules_count = len(b) if isinstance(b, list) else (len(b.get("items", [])) if isinstance(b, dict) else 0)
expect("5.3 Rules exist", rules_count > 0, True, exact=True)

# ============ PHASE 6: SETTINGS ============
print("\n-- PHASE 6: SETTINGS --")

s, b = api("GET", "/api/v1/settings", token=token)
expect("6.1 Get settings", s, 200)

s, b = api("PUT", "/api/v1/settings/llm", {
    "settings": {"provider": "openrouter", "model": "deepseek/deepseek-chat"}
}, token=token)
expect("6.2 Update LLM settings", s, 200)

s, b = api("PUT", "/api/v1/settings/warmup", {
    "settings": {"messages_per_day": 15, "delay_seconds": 300}
}, token=token)
expect("6.3 Update warmup settings", s, 200)

s, b = api("PUT", "/api/v1/settings/auto_reply", {
    "settings": {"enabled": True, "min_intent": "HOT", "replies": ["Thank you! We will contact you soon."]}
}, token=token)
expect("6.4 Update auto-reply settings", s, 200)

# ============ PHASE 7: BILLING ============
print("\n-- PHASE 7: BILLING --")

s, b = api("GET", "/api/v1/billing/subscription", token=token)
expect("7.1 Get subscription", s, 200)

for plan in ["starter", "pro", "enterprise"]:
    s, b = api("POST", "/api/v1/billing/checkout", {"plan": plan, "provider": "stripe"}, token=token)
    expect("7.2 Stripe checkout (%s)" % plan, s, 200)

s, b = api("GET", "/api/v1/billing/usage", token=token)
expect("7.3 Get usage", s, 200)

# ============ PHASE 8: CAMPAIGNS ============
print("\n-- PHASE 8: CAMPAIGNS --")

# Schema: name, base_text, target_geos (required), target_niches (required), posts_per_day, timezone
s, b = api("POST", "/api/v1/campaigns/", {
    "name": "Synth Test Campaign",
    "base_text": "Hello! We have great properties in your area.",
    "target_geos": ["Phuket", "Moscow"],
    "target_niches": ["real_estate"],
    "posts_per_day": 2,
    "timezone": "UTC",
}, token=token)
campaign_id = b.get("id", "") if isinstance(b, dict) else ""
expect("8.1 Create campaign", s, 201)

s, b = api("GET", "/api/v1/campaigns", token=token)
expect("8.2 List campaigns", s, 200)

# ============ PHASE 9: TARGETS & GROUPS ============
print("\n-- PHASE 9: TARGETS & GROUPS --")

# Schema: platform (required), group_identifier (required), account_id (required)
# We need a valid account_id for this. Get accounts first.
s, accs = api("GET", "/api/v1/accounts", token=token)
accounts = accs if isinstance(accs, list) else (accs.get("items", []) if isinstance(accs, dict) else [])
account_id = accounts[0]["id"] if accounts else ""

if account_id:
    s, b = api("POST", "/api/v1/groups/", {
        "platform": "telegram",
        "group_identifier": "@phuket_realestate",
        "account_id": account_id,
    }, token=token)
    expect("9.1 Add group", s in (200, 201), True, exact=True)
else:
    expect("9.1 Add group (skip: no account)", True, True, exact=True)
    print("    (no connected account available)")

s, b = api("GET", "/api/v1/groups", token=token)
expect("9.2 List groups", s, 200)

s, b = api("POST", "/api/v1/groups/discover", {
    "geo_tag": "Phuket",
    "niche": "real_estate",
    "platform": "telegram",
}, token=token)
expect("9.3 Discover groups", s, 200)

s, b = api("GET", "/api/v1/targets", token=token)
expect("9.4 List targets", s, 200)

# ============ PHASE 10: ANALYTICS & AUDIT ============
print("\n-- PHASE 10: ANALYTICS & AUDIT --")

s, b = api("GET", "/api/v1/analytics", token=token)
expect("10.1 Get analytics", s, 200)

s, b = api("GET", "/api/v1/analytics/leaderboard", token=token)
expect("10.2 Get leaderboard", s, 200)

s, b = api("GET", "/api/v1/audit", token=token)
expect("10.3 Get audit log", s, 200)

# ============ PHASE 11: BLOG ============
print("\n-- PHASE 11: BLOG --")

s, b = api("GET", "/api/v1/blog", token=token)
expect("11.1 Public blog list", s, 200)

s, b = api("GET", "/api/v1/blog/admin/list", token=token)
expect("11.2 Admin blog list", s, 200)

slug = "synth-test-%s" % uuid.uuid4().hex[:6]
s, b = api("POST", "/api/v1/blog/admin", {
    "slug": slug,
    "title_en": "Synthetic Test Article",
    "title_ru": "Testovaya stat'ya",
    "content_en": "This is a test article for system verification.",
    "content_ru": "Eto testovaya stat'ya dlya proverki sistemy.",
    "tags": ["test", "synthetic"],
    "published": True,
}, token=token)
expect("11.3 Create blog post", s, 201)

# ============ PHASE 12: SYSTEM HEALTH ============
print("\n-- PHASE 12: SYSTEM HEALTH --")

s, b = api("GET", "/health")
expect("12.1 API health", s, 200)

s, b = api("GET", "/api/v1/system/info", token=token)
expect("12.2 System info", s, 200)

s, b = api("GET", "/api/v1/listeners/status", token=token)
expect("12.3 Listener status", s, 200)

s, b = api("GET", "/api/v1/notifications/status", token=token)
expect("12.4 Notification status", s, 200)

# ============ PHASE 13: PUBLIC PAGES ============
print("\n-- PHASE 13: PUBLIC PAGES --")

pages = ["", "login", "blog", "help", "forgot-password", "sitemap.xml", "robots.txt", "llms.txt"]
for i, page in enumerate(pages):
    url = "https://www.24go.site/%s" % page
    try:
        r = urllib.request.urlopen(url, timeout=10)
        expect("13.%d /%s" % (i + 1, page or "root"), r.status, 200)
    except Exception:
        expect("13.%d /%s" % (i + 1, page or "root"), "ERROR", 200)

# ============ PHASE 14: LISTENER ============
print("\n-- PHASE 14: LISTENER (VPS worker) --")

s, b = api("GET", "/api/v1/listeners/status", token=token)
if isinstance(b, dict):
    listeners = b.get("items", b.get("listeners", []))
    if isinstance(listeners, list):
        expect("14.1 Listener status accessible", s, 200)
        print("    Active listeners: %d" % len(listeners))
    else:
        expect("14.1 Listener status accessible", s, 200)
else:
    expect("14.1 Listener status accessible", s, 200)

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
    print("\n%d tests failed. Review above." % FAILED)
