# Backend verification

Run from the repository root:

```bash
.venv/bin/python -m pytest backend/tests -q
```

The 20 tests run offline. Analytical fixtures have explicit prices and session
indexes; independent NumPy calculations verify financial outputs. Provider
failure fixtures verify retained-cache behavior, invalid timestamps, refresh
concurrency, and cooldowns. API tests verify partial coverage, invalid inputs,
and identical ranking/detail observations from a versioned snapshot.

Browser integration checks live in frontend/e2e and use the running application.
They require Yahoo access or a populated local market cache. See README.md.
