import sys
sys.path.insert(0, '/app')
from app.llm_classifier import DEFAULT_HOT_KEYWORDS, DEFAULT_WARM_KEYWORDS, DEFAULT_SPAM_KEYWORDS, _classify_by_keywords
print("HOT keywords:", DEFAULT_HOT_KEYWORDS)
print("WARM keywords:", DEFAULT_WARM_KEYWORDS)
print("SPAM keywords:", DEFAULT_SPAM_KEYWORDS)
print()
tests = [
    "I need to purchase an apartment in Thailand, budget $200k, can we schedule a call?",
    "I'm ready to sign the contract for unit 42B. When can we meet?",
    "Can you send me your catalog of available properties?",
    "Do you have properties near the beach?",
    "asdkjfh askjdhfkajshdfkjahsdfkjah",
    "BUY FOLLOWERS CHEAP 1000 for $5 only Instagram TikTok",
    "I'm looking to invest in Thai real estate, what ROI can I expect?",
]
for t in tests:
    r = _classify_by_keywords(t)
    print(f"  {r['intent_score']:5s} {r['confidence']:.2f}  {t[:60]}")
