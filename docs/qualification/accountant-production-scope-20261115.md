# Accountant production studio selection correction

State: LOCAL REVIEW ONLY, not pushed or deployed.

The released Accountant route selects a studio from the session whenever the connected visit release is enabled. A tenant admin deliberately has no studio claim, so this leaves the read-only page without a request. The original production studio choice should apply outside the actual demo preview.

Change: use CONNECTED_VISIT_LOCAL, not the compatibility alias that also includes production release, solely for choosing the studio. No financial calculation, data, role, policy or design change.

Production scope checked read-only: current Admin account is enabled, role admin, tenant automodz, studio null. The established FIRST_STUDIO_ID, studio-ahmedabad, resolves to AutoDeck Ahmedabad with tenant automodz. Backend getAccountantMoney independently validates the requested studio's tenant.

Qualification: five mounted Accountant cases pass, including production null-studio claim and demo null-studio refusal; seven release/backend-gate unit cases pass; Admin typecheck passes; focused ESLint has no errors, eight existing-style warnings. Before/proposed captures at 320, 390 and 1280 use the actual Accountant page and Admin layout/shell with a read-only sample projection. They are local fixtures, not live totals. The live current route was separately read and captured without mutation. An initial screenshot compositor issue was corrected in the local renderer with GPU disabled, not by changing application CSS.

Review action: approve the small route correction before source publication. After approval, qualify hosted CI and the exact Admin deployment, then verify the live scoped request and read-only view. No backend redeploy or Customer/Studio rebuild is needed for this patch.
