# Payments: deploy rules and checks

Written after the Razorpay rollout failures. Follow it for any payment change.

1. Secrets are bound per function. A function that reads a secret, or calls `getPaymentProvider()`, must list it in `secrets`.
   `functions/src/test/unit/function-secrets.test.ts` fails CI if one is missing.
2. Key id and key secret rotate together. Add both new versions in Secret Manager, then redeploy all three:
   `createCheckoutOrder`, `verifyCheckoutPayment`, `purchaseMembership` (and `razorpayWebhook` if its secrets changed) with `--force`.
3. Deploy functions first, then the web app. Vercel deploys apps from `main` by itself; it skips apps a commit does not touch.
4. Before deploying, run `scripts/pending-functions.sh`; after, `git tag -f deployed-functions HEAD`.
5. Payment completion does not depend on the webhook: `verifyCheckoutPayment` completes the payment once the signature matches. The webhook is a backup.
6. After any payment deploy, run one test-mode payment and check: membership becomes active, and
   `gcloud logging read 'resource.labels.service_name=razorpaywebhook AND httpRequest.status=401' --freshness=30m` is empty.
   Webhook 401s mean the Razorpay dashboard webhook secret differs from `RAZORPAY_WEBHOOK_SECRET`.
7. Never put keys in chat or commits. Use the vault.
