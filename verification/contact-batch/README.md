# Contact batch route contracts

Run only with Docker access and the accepted application image plus locally available postgres:16-alpine:

```
python3 verification/contact-batch/run.py generator-ad-backend:contact-batch-v44
```

Three unique unittest methods exercise registered HTTP routes with real JWT authentication/role guards, tenant-scoped SQLAlchemy queries and disposable PostgreSQL16. Provider functions are AsyncMock boundaries: no real number lookup, WhatsApp session use or social delivery.

The runner starts only its exact named fixture PostgreSQL with tmpfs data and Unix sockets, no Docker network or TCP listener. The API fixture is network-none/read-only/cap-drop with synthetic settings, no production volumes and no application-source overlays. It never invokes backend/tests/conftest.py. Do not pass real database/broker settings or run the production test suite on the host. The accepted image is not distributed by this fixture; a repo clone alone is not a reproducible production build.

Coverage: canonical/uppercase duplicate contact UUIDs count once; foreign/missing IDs do not trigger providers; unknown results preserve existing TG/VK/WA fields; repeated normalized input phones reuse checks while retaining response order/cardinality; only the actor tenant's connected WA account is selected; viewer writes and unauthenticated checks are denied without provider calls. This is not RLS, concurrent account revocation or live provider verification.
