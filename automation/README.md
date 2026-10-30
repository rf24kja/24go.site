# Host automation source export

Layout mirrors an operator's Hermes home: `scripts/` and `skills/statejnik/tools/`. The installed scripts retain explicit site origins and deployment paths; cloning this directory does not configure a scheduler, authorize publication, install Hermes, or supply credentials. Do not run publisher/syndicator/native-CMS scripts against a production home just to test this export.

## Offline contracts
From the repository root, with a Python environment containing the existing test dependencies:

```
python -m unittest discover -s automation/skills/statejnik/tools -p 'test_final_review*.py' -v
python automation/scripts/tests/test_statejnik_daily_control.py
```

Review fixtures use synthetic transports; daily-control fixtures use temporary directories and real local subprocess locks. The two exported test path defaults are repository-relative rather than deployment-absolute. Production code bytes remain the installed snapshot. Use an isolated HERMES_HOME/TMPDIR when running fixtures; never point the installed backend's destructive test fixtures at live PostgreSQL/Redis.

## Deployment contract
Install only reviewed modules under the owning profile's scripts/skills hierarchy. Preserve the configured author/editor/verifier routes, native CMS actor/origin restrictions, publication enablement, real visual QA and exact-version admission. `statejnik_daily_control.py` is local reservation control, not a generator or permission bypass. Native terminal approval still applies.

Detailed daily operating instructions are exported as scripts/24go_site_daily_editorial.md and scripts/24go_site_daily_pipeline.md. Paths named there refer to the existing authorized deployment and must be reviewed for a different machine. No live settings, credentials, schedules, provider evidence, articles or session stores are included.
