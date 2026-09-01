import json
with open(r"C:\Users\rf24k\AppData\Local\Temp\opencode\openapi.json") as f:
    d = json.load(f)
paths = d["paths"]
for path, methods in sorted(paths.items()):
    for method, info in methods.items():
        if method in ("post", "put") and any(x in path for x in ["lead", "rule", "campaign", "group"]):
            print(f"{method.upper()} {path}")
            rb = info.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {})
            ref_key = rb.get("$ref", "")
            if ref_key:
                ref = ref_key.split("/")[-1]
                schema = d["components"]["schemas"].get(ref, {})
                print(f"  Schema: {ref}")
                props = schema.get("properties", {})
                for k, v in props.items():
                    print(f"    {k}: {v}")
            else:
                print(f"  {rb}")
            print()
