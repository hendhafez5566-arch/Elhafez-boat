# Security baseline

Private repository preferred; no secrets, tokens, API credentials or personal data committed.
Tenant isolation at API, repository and database policy levels; test cross-tenant access. RBAC with deny-by-default, server-side validation, audit logs, encryption in transit/at rest, key rotation, webhook signature verification, secure token storage, rate limiting and CSRF protection where relevant.
Sensitive traveler documents stored privately with least privilege, retention limits and deletion procedures. Mask logs and analytics. Backup with periodic restore test, incident response, dependency scans and least-privilege CI credentials.
Confirm applicable Egyptian and other destination privacy, consumer and travel rules with qualified advisers before production.
