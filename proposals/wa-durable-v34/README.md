# WA durable guard v34 — NOT INSTALLED

This directory is a reviewed candidate, deliberately separate from installed `services/wa-sidecar/src`.

The sender persists an exclusive intent before the SDK is called, synchronizes the file/directory/parent, preserves uncertain sends across process restart and stores terminal tenant/cooldown state before releasing the intent. It never stores message text, recipient or session keys. No automatic timeout expiry, retry or reconciliation is provided. Provider ACK still does not establish delivery/read or exactly-once messaging.

The candidate was strictly compiled with the existing TypeScript5.9.3/Node type toolchain and tested on the packaged sidecar image without application-source overlays or network/production volumes. `test_restart.mjs` accepts the absolute path to a compiled sender module and exercises separate real Node processes with synthetic sockets. It tests process-restart quarantine, tenant binding, storage failure before provider invocation, terminal cleanup and parent-directory durability ordering.

Packaged image: `sha256:d44faf20703b4bca9f5f9730913beae7211f82b22ff7c64bf9a99a3b0fc60a65`.

## Installation gate
Deployment would interrupt current WA sockets. The scoped consent request was unanswered, so production was not changed. Preserve the exact existing session mount, full six-file Compose chain and all other services. Before replacing v29, explicitly dispose of any legacy process-local unknown sends: the new ledger cannot infer or reconstruct them. No auto reconnect/send or retry is authorized by this source export.

Do not overwrite the installed source merely because this candidate exists. Integrate into a separate sidecar build with its actual dependencies/type configuration, exercise the final packaged image, then obtain the missing maintenance authority and perform independent runtime readback.
