import urllib.request, json

key = "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"

# Get list of free models
req = urllib.request.Request(
    "https://openrouter.ai/api/v1/models",
    headers={"Authorization": "Bearer " + key},
)
r = urllib.request.urlopen(req, timeout=15)
data = json.loads(r.read())
free_models = [m["id"] for m in data.get("data", []) if ":free" in m["id"]]
print("Free models found: %d" % len(free_models))
for m in free_models:
    print("  %s" % m)

# Test first 3
for model in free_models[:3]:
    try:
        payload = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": 'Classify: "I want to buy an apartment". Return JSON: {"intent_score":"HOT","confidence":0.8}'}],
            "temperature": 0.1,
            "max_tokens": 200,
        }).encode()
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            payload,
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        )
        r = urllib.request.urlopen(req, timeout=30)
        body = json.loads(r.read())
        content = body["choices"][0]["message"]["content"]
        print("OK  %s: %s" % (model, content[:150]))
    except Exception as e:
        err = str(e)
        if hasattr(e, "read"):
            err = e.read().decode()[:200]
        print("ERR %s: %s" % (model, err[:200]))
