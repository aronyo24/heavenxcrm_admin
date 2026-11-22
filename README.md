# HeavenXCRM Developer Control Center

Internal console for the HeavenXCRM team: companies, subdomains, databases,
storage, backups, health, plans, developer accounts and the audit log.

It is a separate app from the company CRM (`../heavenxcrm_web`), which every
company keeps using on its own subdomain. Both apps share the same design
system. The backend is `../heavenxcrm_api` (`apps/control`); see
`../heavenxcrm_api/apps/control/README.md` for architecture and deployment.

```bash
npm install
npm run dev      # http://localhost:5175 (proxies /api to Django on :8000)
npm run build    # dist/ -> serve on control.heavenxcrm.com
```

Sign in with a developer account (`python manage.py create_developer ...`).
Company administrator logins never work here.

| Page | What it does |
|---|---|
| Overview | KPIs, registrations, plan mix, storage by company, health, recent activity |
| Companies | Search and filter. **New company** creates and provisions a workspace |
| Company page | Settings, subscription, logo, status, maintenance, database and migrations, storage history, backups and restore, audited data inspector, activity, delete |
| Storage | Database, documents and images for each company, limits, alerts |
| System health | Server, control database, each company database, pending migrations, migrate all |
| Subscription plans | Plans with storage and user limits |
| Developer team | Roles, extra permissions, 2FA reset, session revoke |
| Audit log | Every developer action and data read |
| My security | 2FA setup, password, sessions |
