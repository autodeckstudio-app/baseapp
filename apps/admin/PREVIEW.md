# Review deployments

- `instinct/preview` is the single working preview. Every milestone lands here.
  Its stable Vercel hostname is the only one that needs to be in Firebase
  Authorized domains for Google sign-in on preview.
- `main` is the safe backup and the only branch that goes to production.
