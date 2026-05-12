# Crane Discovery & Vendor Repository Platform
# Project Timeline & Effort Breakdown (15 Weeks)

## Scope
Full standalone software including all 23 screens, 6 functional modules, Google Maps/GIS integration, recommendation engine, RFQ automation, vendor portal, analytics, WhatsApp integration, and alerts engine. **SAP integration is excluded** from this timeline (enquiries will be managed via manual entry and CSV import until SAP scope is separately addressed).

---

## Cloud Infrastructure (DigitalOcean — Best Value for Medium-Scale)

| Resource | Specification | Monthly Cost (USD) | Monthly Cost (INR) |
|----------|--------------|-------------------|-------------------|
| App Platform — API Server | 2x Professional containers (1 vCPU, 1GB each) | $24 | 2,000 |
| App Platform — Background Worker | 1x Professional container (1 vCPU, 1GB) | $12 | 1,000 |
| Managed PostgreSQL + PostGIS | 2 vCPU, 4GB RAM, 50GB SSD, standby node | $60 | 5,000 |
| Managed Redis | 1GB RAM, single node | $15 | 1,250 |
| Spaces Object Storage + CDN | 250GB storage, built-in CDN | $5 | 420 |
| Load Balancer | 1x Regional LB with SSL termination | $12 | 1,000 |
| **Cloud Subtotal** | | **$128** | **10,670** |

| External Service | Usage Estimate | Monthly Cost (USD) | Monthly Cost (INR) |
|-----------------|---------------|-------------------|-------------------|
| Google Maps Distance Matrix API | ~5,000 requests/month | $25 | 2,080 |
| Google Maps JavaScript API | ~2,000 map loads/month | $14 | 1,170 |
| Google Geocoding API | ~500 requests/month | $3 | 250 |
| WhatsApp Business API (Gupshup/AiSensy) | ~1,000 messages/month | $40 | 3,330 |
| Email (SMTP via Brevo/Mailgun) | ~2,000 emails/month | $0 (free tier) | 0 |
| Domain + SSL | Annual amortized | $3 | 250 |
| **External Subtotal** | | **$85** | **7,080** |

| | **Monthly** | **Annual** |
|---|---|---|
| **Total (USD)** | **$213** | **$2,556** |
| **Total (INR)** | **17,750** | **2,13,000** |

**Note**: Google Cloud offers $200/month free Maps credit for new accounts — this covers the first ~8 months of Maps usage at zero cost. Effective first-year cost could be as low as **$155/month (INR 12,900)**.

---

## 15-Week Development Timeline

### Phase 1: Foundation & Core Infrastructure (Weeks 1–3)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| **Week 1** | Project scaffolding (monorepo: React + Node.js + TypeScript), CI/CD pipeline (GitHub Actions), PostgreSQL + PostGIS DB setup, Drizzle ORM schema + migrations, Docker configs, DigitalOcean infra provisioning | DevOps, Backend |
| **Week 2** | Authentication system (JWT + refresh tokens + bcrypt), User CRUD, Role-based access control (4 roles), password reset flow, session management with Redis | Backend, Security |
| **Week 3** | Base UI shell (Ant Design layout, sidebar navigation, role-based routing), Login/Logout pages, Admin user management screen, responsive layout foundation | Frontend |

**Phase 1 Output**: Deployable app skeleton with auth, roles, and CI/CD pipeline running.

---

### Phase 2: Vendor Management Module (Weeks 4–5)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| **Week 4** | Vendor master CRUD API + UI, vendor onboarding workflow (draft → pending → approved/rejected), vendor contacts management, vendor document upload (S3/Spaces), Admin onboarding approval screen | Backend, Frontend |
| **Week 5** | Vendor equipment/fleet management (CRUD with PostGIS location), vendor portal login + dashboard, vendor fleet management screen (add/edit/update cranes), availability status management, bulk CSV import for vendor fleet data | Backend, Frontend |

**Phase 2 Output**: Fully functional vendor repository with portal access for external vendors.

---

### Phase 3: Enquiry & Sourcing Workflow (Weeks 6–8)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| **Week 6** | Enquiry CRUD (manual entry + CSV import), enquiry line items with 10-stage status workflow, Sales Dashboard (counters, filters, action items), SAP Enquiry Inbox screen (manual-feed mode), Enquiry Detail screen with line item listing | Backend, Frontend |
| **Week 7** | RFQ creation screen (auto-populated from line item), RFQ dispatch engine (email via SMTP), RFQ vendor recipients tracking, RFQ tracking screen, email template system, communication log (all outbound recorded) | Backend, Frontend |
| **Week 8** | Quotation capture (manual entry + email parse helper), quotation comparison screen (side-by-side), shortlist/reject/select workflow with reason codes, vendor finalisation + crane reservation (availability calendar update), booking confirmation screen, final selection screen | Backend, Frontend |

**Phase 3 Output**: Complete sourcing lifecycle from enquiry to vendor finalisation operational via email-based RFQ.

---

### Phase 4: Recommendation Engine + Maps (Weeks 9–11)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| **Week 9** | Google Maps Distance Matrix API integration, Geocoding API integration (address → lat/lng), PostGIS spatial queries (bounding box pre-filter), distance calculation service (batch 25 origins/request), mobilisation cost computation engine (distance × cost_per_km) | Backend, Integration |
| **Week 10** | Recommendation engine (full 8-step logic), vendor fleet recommendations (ranked by distance), recommendation snapshot storage (JSONB), Line-Item Sourcing Workspace (combined view: recommendations + RFQ + quotations), SML fleet recommendations placeholder (manual data entry until SAP integration) | Backend, Frontend |
| **Week 11** | Google Maps JavaScript API frontend integration, Map View screen (vendor locations, crane pins), Heat Map screen (vendor density by region), Vendor Discovery Search screen with geo-filters (type, capacity, radius, region), Vendor Detail screen (profile + fleet + RFQ history + metrics), Equipment/Crane Detail screen | Frontend, Integration |

**Phase 4 Output**: Distance-based recommendation engine live with map visualisation and geographic vendor discovery.

---

### Phase 5: Analytics, WhatsApp, Alerts & Final Polish (Weeks 12–15)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| **Week 12** | Management Dashboard (KPI cards: enquiry volumes, fulfillment ratio, turnaround, response rates), Reports & Analytics screen (vendor performance, mobilisation metrics, crane category views), report export (CSV/PDF), date/region/vendor filter controls | Frontend, Backend |
| **Week 13** | WhatsApp Business API integration (outbound RFQ dispatch via BSP), WhatsApp inbound webhook (response capture), response parsing + auto-match to RFQ, validation queue for unmatched responses (Admin screen), multi-channel dispatch (email + WhatsApp simultaneously) | Backend, Integration |
| **Week 14** | Alerts & notification engine (all 8 alert types via BullMQ scheduled jobs), in-app notification system (bell icon, notification panel, mark-as-read), email alert delivery, Communication History screen (full chronological log), Admin Configuration screen (cost params, templates, SLA thresholds, region mapping) | Backend, Frontend |
| **Week 15** | End-to-end testing (Playwright E2E suite), performance testing + optimization, security hardening (rate limiting, input validation audit, CORS tightening), production deployment on DigitalOcean, DNS + SSL setup, monitoring + alerting (uptime checks, error tracking), user documentation + handover | QA, DevOps, All |

**Phase 5 Output**: Production-ready platform with full analytics, multi-channel communication, automated alerts, and deployed on cloud.

---

## Effort Breakdown by Role (15 Weeks)

| Role | Weeks Active | Weekly Hours | Total Hours | Key Deliverables |
|------|-------------|-------------|-------------|-----------------|
| **Full-Stack Lead / Architect** | Weeks 1–15 | 45 | 675 | Architecture decisions, DB design, recommendation engine, integration layer, code reviews, deployment |
| **Frontend Developer** | Weeks 3–15 | 45 | 585 | All 23 screens (React + Ant Design + TypeScript), Google Maps UI, dashboards, responsive design, vendor portal |
| **Backend Developer** | Weeks 1–14 | 45 | 630 | REST APIs, business logic, BullMQ workers, email/WhatsApp dispatch, alert engine, audit system |
| **DevOps Engineer (part-time)** | Weeks 1–2, 14–15 | 25 | 100 | CI/CD pipeline, Docker, DigitalOcean infra, monitoring, security hardening, production deploy |
| **QA Engineer** | Weeks 6–15 | 40 | 400 | Test plans, API testing (Supertest), E2E tests (Playwright), UAT coordination, bug verification |

| | **Total** |
|---|---|
| **Person-Hours** | **2,390 hours** |
| **Person-Weeks** | **~60 person-weeks** |
| **Person-Months** | **~15 person-months** |

---

## Effort Breakdown by Category

| Category | Hours | % of Total |
|----------|-------|-----------|
| Backend Development (APIs, logic, integrations) | 780 | 33% |
| Frontend Development (23 screens, maps, dashboards) | 650 | 27% |
| Architecture & Design (DB, API design, decisions) | 280 | 12% |
| Testing & QA (unit, integration, E2E, UAT) | 360 | 15% |
| DevOps & Infrastructure (CI/CD, cloud, monitoring) | 160 | 7% |
| Documentation & Handover | 80 | 3% |
| Project Management & Coordination | 80 | 3% |
| **Total** | **2,390** | **100%** |

---

## Deliverables Summary

| Milestone | Week | What Ships |
|-----------|------|-----------|
| M1: App Skeleton | End of Week 3 | Auth, RBAC, base UI, CI/CD, deployed staging environment |
| M2: Vendor Module | End of Week 5 | Vendor repo, portal, fleet management, onboarding |
| M3: Sourcing Workflow | End of Week 8 | Full enquiry-to-finalisation lifecycle with email RFQ |
| M4: Maps & Recommendations | End of Week 11 | Distance-ranked recommendations, map view, geo-search |
| M5: Production Release | End of Week 15 | Full platform: analytics, WhatsApp, alerts, production-deployed |

---

## Technology Stack Summary

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Ant Design + Google Maps JS API |
| Backend | Node.js + Express.js + TypeScript |
| Database | PostgreSQL 16 + PostGIS (DigitalOcean Managed) |
| ORM | Drizzle ORM (type-safe, SQL-first) |
| Cache & Queue | Redis + BullMQ |
| File Storage | DigitalOcean Spaces (S3-compatible) |
| Email | Nodemailer + SMTP (Brevo/Mailgun free tier) |
| WhatsApp | WhatsApp Business API via Gupshup/AiSensy |
| Maps | Google Maps Platform (Distance Matrix + JS API + Geocoding) |
| Auth | JWT (access + refresh) + bcrypt |
| CI/CD | GitHub Actions → Docker → DigitalOcean App Platform |
| Monitoring | DigitalOcean built-in + Sentry (error tracking) |

---

## What Is Excluded (Future Scope)

- SAP S/4HANA bidirectional integration (enquiry sync, SML fleet read, booking push-back)
- SML internal fleet real-time data (will use manual entry/CSV until SAP is connected)
- Mobile native app (responsive web covers mobile use for now)
- Advanced ML-based vendor scoring (manual metrics in V1)

---

*End of Timeline Document*
