#!/usr/bin/env python3
"""Find catch / .catch() sites in a TS/JS codebase and flag high-risk swallow shapes.

This does NOT classify — it surfaces candidates with enough context for a human (or
Claude) to assign one of the three buckets. Heuristic flags are hints, not verdicts.

Usage: python find_catches.py [path]   (default path: src/)
"""
import os
import re
import sys

EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs")
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".wrangler", "coverage", ".next"}

# High-risk swallow shapes: handler returns a default and discards the error.
SWALLOW_PATTERNS = [
    (re.compile(r"\.catch\(\s*\(\s*\)\s*=>\s*(\[\]|\{\}|null|undefined|false|''|\"\")"),
     "catch-returns-default"),
    (re.compile(r"\.catch\(\s*\(?\s*\w+\s*\)?\s*=>\s*(\[\]|\{\}|null|undefined|false)"),
     "catch-ignores-err-returns-default"),
    (re.compile(r"catch\s*\(\s*\w*\s*\)\s*\{\s*\}"),
     "empty-catch-block"),
]
# Lower-confidence: any catch / .catch reference worth reading.
GENERAL = re.compile(r"(\.catch\s*\(|catch\s*\()")

# Words near a site that hint at bucket 2 (must-fix) territory.
RISK_HINTS = ("db", "query", "insert", "update", "delete", "stripe", "payment",
              "auth", "session", "webhook", "neon", "sql", "transaction")


def scan(path):
    hits = []
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in files:
            if not fn.endswith(EXTS):
                continue
            fp = os.path.join(root, fn)
            try:
                lines = open(fp, encoding="utf-8", errors="replace").read().splitlines()
            except OSError:
                continue
            for i, line in enumerate(lines):
                if not GENERAL.search(line):
                    continue
                flag = ""
                for pat, name in SWALLOW_PATTERNS:
                    if pat.search(line):
                        flag = name
                        break
                ctx = " ".join(lines[max(0, i - 2):i + 3]).lower()
                risk = sorted({w for w in RISK_HINTS if w in ctx})
                hits.append((fp, i + 1, line.strip(), flag, risk))
    return hits


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "src/"
    if not os.path.exists(path):
        print(f"path not found: {path}", file=sys.stderr)
        sys.exit(1)
    hits = scan(path)
    flagged = [h for h in hits if h[3]]
    print(f"# Catch sites in {path}: {len(hits)} total, {len(flagged)} flagged as likely swallows\n")
    for fp, ln, src, flag, risk in hits:
        marker = f"  [!{flag}]" if flag else ""
        risk_s = f"  risk:{','.join(risk)}" if risk else ""
        print(f"{fp}:{ln}{marker}{risk_s}")
        print(f"    {src}")
    print(f"\n# Read each site in context before classifying. Flagged + risk-tagged = check first.")


if __name__ == "__main__":
    main()
