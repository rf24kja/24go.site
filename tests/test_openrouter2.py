import urllib.request, json

key = "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"

# First check if model exists
models_to_try = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "deepseek/deepseek-chat",
    "deepseek/deepseek-v3.2",
]

for model in models_to_try:
    try:
        data = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": 'Classify: "I want to buy an apartment in Phuket for $200k". Return JSON: {"intent_score":"HOT","confidence":0.8}'}],
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
        print("OK  %s: %s" % (model, content[:200]))
    except Exception as e:
        err = str(e)
        if hasattr(e, 'read'):
            err = e.read().decode()[:200]
        print("ERR %s: %s" % (model, err[:200]))
