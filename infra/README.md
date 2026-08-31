# infra/

Non-secret, per-environment configuration (local / staging / production), per the approved technical design §3. Actual secrets (payment gateway keys, service-account credentials, webhook secrets) live exclusively in Google Secret Manager and are never committed here or anywhere else in the repository.

No AutoDeck Firebase/GCP project has been created yet, so no real environment configuration exists here yet — this directory is a placeholder for that future, separately-approved infrastructure step.
