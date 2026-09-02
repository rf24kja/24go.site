import urllib.request, json

# Test DeepSeek
try:
    data = json.dumps({
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": 'Classify this message. Return ONLY JSON: {"intent_score": "HOT"|"WARM"|"COLD"|"SPAM", "confidence": 0.8}\nMessage: I want to buy an apartment in Phuket for $200k'}],
        "temperature": 0.1,
        "max_tokens": 200,
    }).encode()
    req = urllib.request.Request(
        "https://api.deepseek.com/v1/chat/completions",
        data,
        headers={
            "Authorization": "Bearer sk-023d351a8286474194147d024f45359e",
            "Content-Type": "application/json",
        },
    )
    r = urllib.request.urlopen(req, timeout=30)
    body = json.loads(r.read())
    content = body["choices"][0]["message"]["content"]
    print(f"DeepSeek OK: {content[:200]}")
except Exception as e:
    print(f"DeepSeek ERR: {e}")
