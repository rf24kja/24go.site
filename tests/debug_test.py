import json, urllib.request, uuid

email = f"test_{uuid.uuid4().hex[:8]}@synthetic.test"
print(f"Email: {email}")

data = json.dumps({
    "company_name": "SyntheticTestCo",
    "email": email,
    "password": "SynthTest2026!"
}).encode()

req = urllib.request.Request(
    "https://api.24go.site/api/v1/auth/register",
    data,
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    r = urllib.request.urlopen(req, timeout=15)
    body = json.loads(r.read().decode())
    token = body.get("access_token", "")
    print(f"Status: {r.status}")
    print(f"Token length: {len(token)}")
    print(f"Token: {token[:30]}...")
    
    # Now test login
    data2 = json.dumps({"email": email, "password": "SynthTest2026!"}).encode()
    req2 = urllib.request.Request(
        "https://api.24go.site/api/v1/auth/login",
        data2,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    r2 = urllib.request.urlopen(req2, timeout=15)
    body2 = json.loads(r2.read().decode())
    token2 = body2.get("access_token", "")
    print(f"\nLogin: {r2.status}")
    print(f"Token2 length: {len(token2)}")
    
    # Test lead qualify
    data3 = json.dumps({
        "user_handle": "@test_synthetic",
        "message_text": "I want to buy a condo in Phuket",
        "source": "test"
    }).encode()
    req3 = urllib.request.Request(
        "https://api.24go.site/api/v1/leads/qualify",
        data3,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token2}"
        },
        method="POST"
    )
    r3 = urllib.request.urlopen(req3, timeout=30)
    body3 = json.loads(r3.read().decode())
    print(f"\nLead qualify: {r3.status}")
    print(f"Intent: {body3.get('intent_score')}")
    print(f"Confidence: {body3.get('confidence')}")
    print(f"Summary: {body3.get('summary')}")
except urllib.error.HTTPError as e:
    print(f"Error: {e.code}")
    print(f"Body: {e.read().decode()[:500]}")
except Exception as e:
    print(f"Exception: {e}")
