import urllib.request, json

# Test which free models work with OpenRouter
key = "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"
models = [
    "nvidia/nemotron-3.5-lightning:free",
    "z-ai/glm-5.2:free",
    "cohere/north-mini-code:free",
    "inclusionai/ling-3.0-flash-fin:free",
]

for model in models:
    try:
        data = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": 'Classify this message. Return ONLY JSON: {"intent_score": "HOT"|"WARM"|"COLD"|"SPAM", "confidence": 0.8}\nMessage: I want to buy an apartment in Phuket for $200k'}],
            "temperature": 0.1,
            "max_tokens": 200,
        }).encode()
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data,
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        )
        r = urllib.request.urlopen(req, timeout=30)
        body = json.loads(r.read())
        content = body["choices"][0]["message"]["content"]
        print(f"OK  {model}: {content[:150]}")
    except Exception as e:
        print(f"ERR {model}: {str(e)[:100]}")
