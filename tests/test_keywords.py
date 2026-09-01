text = 'I need to purchase an apartment in Thailand, budget $200k, can we schedule a call?'
lower = text.lower()
hot_kws = ['buy', 'price', 'order', 'purchase', 'cost', 'contract', 'sign', 'budget', 'invest', 'roi', 'ready to']
warm_kws = ['interested', 'tell me more', 'catalog', 'options', 'recommend', 'available', 'properties', 'listings', 'can you', 'do you have', 'what do you']
spam_kws = ['casino', 'crypto', 'earn money', 'click here', 'you won', 'congratulations', 'claim now', 'free money', 'buy followers', 'cheap followers', 'nigerian prince', 'viagra', 'pills', 'weight loss', 'miracle cure']

hot_hits = sum(1 for kw in hot_kws if kw.lower() in lower)
warm_hits = sum(1 for kw in warm_kws if kw.lower() in lower)
spam_hits = sum(1 for kw in spam_kws if kw.lower() in lower)
print(f"Hot hits: {hot_hits} -> {[kw for kw in hot_kws if kw.lower() in lower]}")
print(f"Warm hits: {warm_hits} -> {[kw for kw in warm_kws if kw.lower() in lower]}")
print(f"Spam hits: {spam_hits}")

# test gibberish
text2 = "asdkjfh askjdhfkajshdfkjahsdfkjah"
lower2 = text2.lower()
spam_hits2 = sum(1 for kw in spam_kws if kw.lower() in lower2)
print(f"\nGibberish spam hits: {spam_hits2}")

# test ready to sign
text3 = "I'm ready to sign the contract for unit 42B. When can we meet?"
lower3 = text3.lower()
hot_hits3 = sum(1 for kw in hot_kws if kw.lower() in lower3)
print(f"\nReady to sign hot hits: {hot_hits3} -> {[kw for kw in hot_kws if kw.lower() in lower3]}")

# test catalog
text4 = "Can you send me your catalog of available properties?"
lower4 = text4.lower()
warm_hits4 = sum(1 for kw in warm_kws if kw.lower() in lower4)
print(f"\nCatalog warm hits: {warm_hits4} -> {[kw for kw in warm_kws if kw.lower() in lower4]}")
