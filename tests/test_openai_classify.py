import urllib.request, json, time

key = "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"

messages_to_classify = [
    ("I want to buy a 2-bedroom condo in Phuket. What's the price range?", "HOT"),
    ("Hi, I'm interested in your real estate services", "WARM"),
    ("Do you have properties near the beach?", "WARM"),
    ("FREE BITCOIN! Click here to claim 1 BTC now!!!", "SPAM"),
    ("Hello, just saying hi", "COLD"),
    ("I need to purchase an apartment in Thailand, budget $200k", "HOT"),
    ("Planning a trip to Phuket next month, any recommendations for hotels?", "COLD"),
    ("I'm looking to invest in Thai real estate, what ROI can I expect?", "HOT"),
    ("CONGRATULATIONS YOU WON $1000000 CLICK HERE NOW", "SPAM"),
    ("What time does your office close?", "COLD"),
    ("Can you send me your catalog of available properties?", "WARM"),
    ("I'm ready to sign the contract for unit 42B. When can we meet?", "HOT"),
    ("asdkjfh askjdhfkajshdfkjahsdfkjah", "SPAM"),
    ("BUY FOLLOWERS CHEAP 1000 for $5 only Instagram TikTok", "SPAM"),
]

system_prompt = """You are an expert sales analyst for a B2B lead generation system.
Analyze an incoming message and extract qualification parameters.
Return strictly a valid JSON object:
{
  "intent_score": "HOT" | "WARM" | "COLD" | "SPAM",
  "confidence": 0.00 to 1.00,
  "summary": "Brief 1-sentence summary"
}
SPAM = unsolicited bulk messaging, crypto scams, phishing, lottery spam, gibberish
HOT = clear buying intent, budget mentioned, ready to act
WARM = interest shown, asking about products/services
COLD = no buying intent, general chat, questions without purchase signals
Return ONLY the JSON string."""

correct = 0
for msg, expected in messages_to_classify:
    try:
        data = json.dumps({
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"SENDER_HANDLE: (incoming message)\nMESSAGE_TEXT: {msg}\nCHANNEL_GEO_TAG: Phuket\n\nClassify this message. Return ONLY the JSON."},
            ],
            "temperature": 0.1,
            "max_tokens": 200,
        }).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data,
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        )
        r = urllib.request.urlopen(req, timeout=30)
        body = json.loads(r.read())
        raw = body["choices"][0]["message"]["content"].strip()
        # Strip markdown fences
        import re
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)
        intent = result.get("intent_score", "?")
        conf = result.get("confidence", 0)
        match = intent == expected
        if match:
            correct += 1
        icon = "OK " if match else "!! "
        print("%s%-60s expected=%-5s got=%-5s conf=%.2f" % (icon, msg[:55], expected, intent, conf))
        time.sleep(0.5)  # rate limit
    except Exception as e:
        err = str(e)
        if hasattr(e, "read"):
            err = e.read().decode()[:200]
        print("ERR %-60s %s" % (msg[:55], err[:100]))

print("\nAccuracy: %d/%d (%.0f%%)" % (correct, len(messages_to_classify), correct * 100.0 / len(messages_to_classify)))
