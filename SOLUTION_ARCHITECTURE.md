# Crane Discovery & Vendor Repository Platform — Standalone Solution Architecture

## 1. Executive Summary

This document provides a complete production-ready architecture for the **Crane Discovery and Vendor Repository Platform** for Sanghvi Movers Limited (SML), built as a **standalone custom application** (no Frappe/ERPNext). The system covers the full cross-rental sourcing lifecycle: SAP enquiry ingestion, equipment discovery, vendor recommendation, RFQ automation, quotation comparison, vendor finalisation, and analytics.

- **23 screens** across 4 user roles (Sales, Vendor, Admin, Management)
- **6 functional modules**: Sales Workspace, Vendor Portal, Admin & Config, Recommendation Engine, RFQ Automation, Analytics
- SAP S/4HANA bidirectional integration
- Google Maps Distance Matrix API
- WhatsApp Business API + SMTP email
- Role-based access control (RBAC) with full audit trail
- Cloud-deployed with auto-scaling

---

## 2. Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18 + TypeScript | Component-driven, strong typing for complex ERP-style forms |
| **UI Library** | Ant Design (antd) | Enterprise-grade tables, forms, dashboards, filters |
| **Maps** | Google Maps JS API + Distance Matrix API | BRD requirement for geo-visualisation and distance calc |
| **State** | Zustand + TanStack Query | Lightweight global state + server-state caching |
| **Backend** | Node.js + Express.js + TypeScript | Same-language stack, excellent async I/O for integrations |
| **API** | REST with OpenAPI 3.0 spec | Clean contract for SAP, vendor portal, internal use |
| **Database** | PostgreSQL 16 + PostGIS | ACID, JSONB for snapshots, PostGIS for geospatial |
| **ORM** | Drizzle ORM | Type-safe, SQL-first, great migrations |
| **Cache/Queue** | Redis 7 + BullMQ | Sessions, rate limiting, background job queues |
| **Auth** | JWT (access+refresh) + bcrypt | Stateless API auth, secure passwords |
| **File Storage** | AWS S3 | Vendor docs, RFQ attachments, quotation PDFs |
| **Email** | Nodemailer + SMTP | RFQ dispatch, alerts, vendor comms |
| **WhatsApp** | WhatsApp Business API via BSP (Twilio/Gupshup) | RFQ dispatch, response capture via webhooks |
| **SAP** | OData V2/V4 or RFC via SAP CPI | Bidirectional enquiry sync, fleet data, booking confirm |
| **Logging** | Pino (structured JSON) | High-perf structured logging |
| **Monitoring** | Prometheus + Grafana | Metrics, dashboards, alerting |
| **Testing** | Vitest (unit), Playwright (E2E), Supertest (API) | Full coverage |

---

## 3. High-Level Architecture

```
CLIENTS: Sales UI | Vendor Portal | Admin UI | Management Dashboard
            |              |            |              |
            +---------- HTTPS/TLS -----+--------------+
                           |
                    [AWS ALB + WAF]
                           |
              +------------+------------+
              |                         |
     [React SPA on CloudFront]   [API Server (ECS)]
                                        |
                    +--------+----------+----------+
                    |        |          |          |
              [PostgreSQL] [Redis]  [BullMQ     [S3]
               (RDS)      (Elasti-  Workers]
                           Cache)
                                        |
                    +--------+----------+----------+
                    |        |                     |
              [SAP S/4HANA] [Google Maps API] [WhatsApp BSP]
```

---

## 4. Database Schema (PostgreSQL + PostGIS)

### Core Tables

- **vendors** — id, name, legal_entity, registered_address, operating_regions (JSONB), tax_details (JSONB), communication_preferences (JSONB), onboarding_status (ENUM: draft/pending/approved/rejected/suspended), approved_at, approved_by
- **vendor_contacts** — id, vendor_id (FK), name, designation, mobile, email, whatsapp_number, is_primary, is_active
- **vendor_equipment** — id, vendor_id (FK), equipment_ref_id, crane_type, capacity_mt (DECIMAL), make, model, year_of_manufacture, current_location_address, current_location (PostGIS GEOGRAPHY POINT), availability_status (ENUM), last_updated_at, last_updated_by
- **crane_availability** — id, equipment_id, equipment_source (sml/vendor), from_date, to_date, status (booked/maintenance/available), linked_enquiry_line_item_id
- **crane_enquiries** — id, sap_enquiry_number (UNIQUE), enquiry_date, customer_name, site_location_address, site_location (PostGIS POINT), region, sales_owner_id (FK users), sap_reference_fields (JSONB), overall_status (ENUM: received/in_progress/fulfilled_internal/fulfilled_vendor/closed/cancelled)
- **enquiry_line_items** — id, enquiry_id (FK), line_number, crane_type, capacity_required_mt, quantity, required_start_date, required_end_date, duration_days, sourcing_status (10-stage ENUM workflow), selected_source (sml/vendor), selected_vendor_id, selected_equipment_id
- **rfq_headers** — id, rfq_number (UNIQUE auto-gen), enquiry_id (FK), line_item_id (FK), crane_requirement_details (JSONB snapshot), site_location (PostGIS), contract_start/end_date, quote_deadline, dispatched_at, overall_status
- **rfq_vendor_recipients** — id, rfq_id (FK), vendor_id (FK), contact_id (FK), communication_channel (email/whatsapp/both/portal), dispatch_status, response_status, reminder_count, last_reminder_at
- **vendor_quotations** — id, rfq_id (FK), line_item_id (FK), vendor_id (FK), crane_reference, rental_rate, mobilisation_charges, total_quoted_value, availability_confirmation, quote_validity_date, remarks, response_timestamp, source_channel, quotation_status (under_review/shortlisted/rejected/selected/not_awarded), rejection_reason
- **recommendation_snapshots** — id, line_item_id (FK), snapshot_timestamp, sml_results (JSONB), vendor_results (JSONB), generated_by
- **communication_logs** — id, direction, channel, timestamp, sender, recipient, enquiry_id, line_item_id, rfq_id, message_summary, delivery_status, business_event_triggered
- **users** — id, email (UNIQUE), password_hash (bcrypt), full_name, role (sales/vendor/admin/management), vendor_id (FK nullable), is_active, last_login_at
- **cost_configuration** — id, crane_category, region, cost_per_km_inr, effective_from, effective_to
- **audit_logs** — id, table_name, record_id, action (create/update/delete), changed_fields (JSONB before/after), performed_by, performed_at, ip_address

### Key Indexes
- `vendor_equipment(crane_type, capacity_mt, availability_status)` — recommendation queries
- `vendor_equipment USING GIST(current_location)` — PostGIS spatial index
- `crane_enquiries(sap_enquiry_number)` — SAP sync lookups
- `enquiry_line_items(enquiry_id, sourcing_status)` — workspace queries
- `crane_availability(equipment_id, from_date, to_date)` — date range overlap checks
- `audit_logs(table_name, record_id, performed_at)` — audit trail lookups

---

## 5. API Design (Key Endpoints)

### Auth
- `POST /api/auth/login` — JWT login (returns access + refresh token)
- `POST /api/auth/refresh` — Refresh token rotation
- `POST /api/auth/forgot-password` / `POST /api/auth/reset-password`

### Enquiries (Sales)
- `GET /api/enquiries` — List with filters (status, date, region, crane category, sales owner)
- `GET /api/enquiries/:id` — Full detail with all line items
- `PATCH /api/enquiries/:id/status` — Update status

### Line Items
- `GET /api/line-items/:id/recommendations` — Trigger/fetch recommendations (SML + vendor, separate)
- `POST /api/line-items/:id/shortlist-vendors` — Shortlist vendors for RFQ
- `PATCH /api/line-items/:id/finalise` — Finalise vendor selection + crane reservation

### Vendor Fleet (Vendor Portal)
- `GET /api/vendor/equipment` — List own fleet
- `POST /api/vendor/equipment` — Add crane
- `PUT /api/vendor/equipment/:id` — Update crane details/location/status
- `GET /api/vendor/rfqs` — View open RFQs addressed to this vendor
- `POST /api/vendor/quotations` — Submit quotation response

### RFQs
- `POST /api/rfqs` — Create RFQ for line item + selected vendors
- `GET /api/rfqs/:id` — Detail with vendor recipients and statuses
- `POST /api/rfqs/:id/dispatch` — Dispatch via email/WhatsApp
- `POST /api/rfqs/:id/remind` — Send reminder to non-responding vendors

### Quotations
- `GET /api/line-items/:id/quotations` — All quotations for comparison view
- `PATCH /api/quotations/:id/status` — Shortlist/reject/select with reason code

### Vendor Discovery
- `GET /api/vendors/search` — Search by crane type, capacity, location radius, region
- `GET /api/vendors/:id` — Vendor profile with fleet, RFQ history, metrics

### Admin
- `GET /api/admin/onboarding-requests` — Pending vendor approvals
- `PATCH /api/admin/vendors/:id/approve` — Approve/reject vendor
- `GET /api/admin/validation-queue` — Unmatched quotation responses
- `PUT /api/admin/config/:key` — Update cost params, templates
- `GET /api/admin/integration-errors` — SAP sync failures

### Analytics
- `GET /api/analytics/overview` — KPI summary (enquiry volumes, turnaround, ratios)
- `GET /api/analytics/vendor-performance` — Response rates, win rates
- `GET /api/analytics/mobilisation` — Avg distance, avg cost
- `GET /api/analytics/reports/:type` — Detailed reports with date/region/vendor filters

### Webhooks (Inbound)
- `POST /api/webhooks/sap` — SAP enquiry push
- `POST /api/webhooks/whatsapp` — WhatsApp BSP webhook for vendor responses

---

## 6. Recommendation Engine Logic

```
Input: line_item { crane_type, capacity, site_location, start_date, end_date }

FOR EACH source IN [sml_fleet, vendor_fleet]:
  1. MATCH cranes WHERE type = required AND capacity >= required
  2. FILTER by availability (no overlapping bookings in date range)
  3. GET current_location coordinates for each matched crane
  4. Pre-filter by PostGIS bounding box (~200km radius) to reduce Maps API calls
  5. CALL Google Maps Distance Matrix API (batch 25 origins per request)
  6. COMPUTE mobilisation_cost = distance_km * cost_per_km (from cost_configuration)
  7. RANK by ascending distance
  8. RETURN sorted results — SML and Vendor ALWAYS separate, NEVER merged

STORE recommendation_snapshot { sml_results: JSONB, vendor_results: JSONB, timestamp }
```

**SML Fleet**: Read from SAP on-demand, never replicated into our DB. Cached only in recommendation_snapshot.

---

## 7. Integration Architecture

### 7.1 SAP S/4HANA
| Direction | Data | Method | Frequency |
|-----------|------|--------|-----------|
| SAP to Platform | New sales enquiries | Webhook (CPI) or Polling (OData) | Real-time or 5 min |
| SAP to Platform | SML fleet data | OData API on-demand | Per recommendation request |
| Platform to SAP | Booking confirmation | OData POST/PATCH | On vendor finalisation |

Integration runs as a **dedicated BullMQ worker service** with error handling, retry logic, and dead-letter queue. Failed syncs logged to `integration_errors` table and surfaced on Admin dashboard.

### 7.2 Google Maps API
- **Distance Matrix API** — batch distance calculations
- **Maps JS API** — frontend map views, vendor clusters, heat maps
- **Geocoding API** — address to lat/lng for new crane entries

### 7.3 WhatsApp Business API
- **Outbound**: RFQ dispatch via BSP (Twilio/Gupshup) REST API with message templates
- **Inbound**: Webhook from BSP parses response, matches to RFQ, creates quotation or routes to validation queue
- **Fallback**: Email-only mode if no WhatsApp BSP access

---

## 8. Security Architecture

| Concern | Implementation |
|---------|---------------|
| **Authentication** | JWT access tokens (15 min) + refresh tokens (7 days), bcrypt cost 12 |
| **RBAC** | Role-based middleware on every route; 4 roles with granular permissions |
| **Vendor Isolation** | Vendor users see ONLY their own data; queries always scoped by vendor_id |
| **API Security** | Rate limiting (Redis), input validation (Zod schemas), parameterized queries (Drizzle) |
| **Transport** | TLS 1.3, HSTS, strict CORS origin whitelist |
| **Audit Trail** | All CUD operations logged with user, timestamp, IP, before/after JSONB diff |
| **Secrets** | AWS Secrets Manager in production — never in code/env files |
| **File Uploads** | S3 presigned URLs, file type validation, size limits |
| **CSP** | Content Security Policy headers on frontend |

---

## 9. Alert and Notification Engine

Implemented as **BullMQ scheduled/recurring jobs**:

| Alert | Schedule | Logic |
|-------|----------|-------|
| RFQ awaiting response beyond SLA | Hourly | rfq_vendor_recipients WHERE response_status=pending AND deadline passed |
| Quotation nearing expiry | Daily 9 AM | vendor_quotations WHERE validity_date within 3 days |
| Line items with no responses | Daily | Line items in awaiting_quotes beyond deadline |
| Crane booking without confirmation | Daily | Selected quotations without booking confirm near start date |
| Vendor fleet data stale | Weekly | vendor_equipment WHERE last_updated_at > 30 days ago |
| SAP integration failure | Real-time | On sync error, immediate admin alert |
| Unmatched quotation in queue | Real-time | On parse failure, immediate admin notification |
| New vendor onboarding request | Real-time | On submission, admin notification |

**Delivery**: In-app notifications (stored in DB, shown on dashboards) + email. Optional push notifications.

---

## 10. Screen to Route Mapping (All 23 BRD Screens)

| # | Screen (BRD Ref) | Route | Role |
|---|-----------------|-------|------|
| 1 | Sales Dashboard (6.1) | `/sales` | Sales |
| 2 | Management Dashboard (6.2) | `/management` | Management |
| 3 | SAP Enquiry Inbox (6.3) | `/sales/enquiries` | Sales |
| 4 | Enquiry Detail (6.4) | `/sales/enquiries/:id` | Sales |
| 5 | Line-Item Sourcing Workspace (6.5) | `/sales/line-items/:id` | Sales |
| 6 | SML Fleet Recommendations (6.6) | Tab within #5 | Sales |
| 7 | Vendor Fleet Recommendations (6.7) | Tab within #5 | Sales |
| 8 | Manual Vendor Discovery (6.8) | `/sales/vendor-search` | Sales |
| 9 | Map View and Heat Map (6.9) | `/sales/map` | Sales |
| 10 | Vendor Detail (6.10) | `/vendors/:id` | Sales, Admin |
| 11 | Crane/Equipment Detail (6.11) | `/equipment/:id` | Sales, Admin |
| 12 | RFQ Creation (6.12) | `/sales/rfqs/new?lineItem=:id` | Sales |
| 13 | RFQ Tracking (6.13) | `/sales/rfqs` | Sales |
| 14 | Quotation Capture (6.14) | `/sales/quotations/:rfqId` | Sales, Admin |
| 15 | Quote Comparison (6.15) | `/sales/line-items/:id/compare` | Sales |
| 16 | Final Selection (6.16) | `/sales/line-items/:id/finalise` | Sales |
| 17 | Booking Confirmation (6.17) | `/sales/bookings/:id` | Sales |
| 18 | Vendor Portal Dashboard (6.18) | `/vendor` | Vendor |
| 19 | Vendor Fleet Management (6.19) | `/vendor/fleet` | Vendor |
| 20 | Vendor Onboarding (6.20) | `/admin/onboarding` | Admin |
| 21 | Communication History (6.21) | `/admin/communications` | Admin |
| 22 | Admin Configuration (6.22) | `/admin/config` | Admin |
| 23 | Reports and Analytics (6.23) | `/analytics` | Management, Admin |

---

## 11. Deployment Architecture (AWS)

| Component | AWS Service | Spec |
|-----------|-------------|------|
| **Frontend** | S3 + CloudFront CDN | React SPA, global edge |
| **API Server** | ECS Fargate (containerized) | 2 tasks min, auto-scale to 6 |
| **Workers** | ECS Fargate (separate service) | 1-2 tasks for BullMQ |
| **Database** | RDS PostgreSQL db.r6g.large | Multi-AZ, 100GB GP3, read replica |
| **Cache/Queue** | ElastiCache Redis cache.r6g.medium | Single node |
| **File Storage** | S3 Standard | Vendor docs, attachments |
| **Load Balancer** | ALB | HTTPS termination, health checks |
| **DNS** | Route 53 | Custom domain |
| **SSL** | ACM | Free certificates |
| **Secrets** | Secrets Manager | DB creds, API keys |
| **Logging** | CloudWatch Logs | Centralized logs |
| **CI/CD** | GitHub Actions to ECR to ECS | Automated pipeline |
| **WAF** | AWS WAF | DDoS protection |

---

## 12. Cloud Cost Estimation (Monthly, Production)

### Option A: AWS (Recommended for production workloads)

| Resource | Monthly USD |
|----------|------------|
| ECS Fargate (API, 2 tasks 1vCPU/2GB) | $60 |
| ECS Fargate (Workers, 1 task) | $15 |
| RDS PostgreSQL (db.r6g.large Multi-AZ 100GB) | $250 |
| RDS Read Replica (db.r6g.medium) | $90 |
| ElastiCache Redis (cache.r6g.medium) | $80 |
| ALB + WAF | $25 |
| S3 + CloudFront (50GB + 100GB transfer) | $15 |
| Route 53 + Secrets Manager | $6 |
| CloudWatch + NAT Gateway | $65 |
| **AWS Subtotal** | **$606** |

External services:

| Service | Monthly USD |
|---------|------------|
| Google Maps APIs (~5K distance + 2K maps + 500 geocode) | $42 |
| WhatsApp BSP (~1K messages via Twilio) | $60 |
| SMTP Email via SES (~2K emails) | $2 |
| **External Subtotal** | **$104** |

**AWS Grand Total: ~$710/month (~INR 60,000/month)**

**Lean start (smaller RDS, no read replica): ~$400/month (~INR 33,000/month)**

### Option B: DigitalOcean (Budget-friendly alternative)

| Resource | Monthly USD |
|----------|------------|
| App Platform (API 2x + Worker 1x) | $36 |
| Managed PostgreSQL (2vCPU/4GB/50GB) | $60 |
| Managed Redis (1GB) | $15 |
| Spaces (S3-compatible 250GB + CDN) | $5 |
| Load Balancer | $12 |
| **DO Subtotal** | **$128** |

**DO Grand Total (with external services): ~$232/month (~INR 19,000/month)**

Trade-offs: Less auto-scaling, no WAF built-in, fewer compliance certifications than AWS.

---

## 13. Development Phases

### Phase 1: Core Platform (Weeks 1-8)
No external dependencies. Usable standalone.

- Project setup: monorepo, CI/CD, DB migrations, auth system
- User management + RBAC (4 roles)
- Vendor master CRUD + onboarding approval workflow
- Vendor equipment/fleet management
- Enquiry management (manual entry, no SAP yet)
- Enquiry line items with 10-stage status workflow
- RFQ creation, email dispatch, tracking
- Quotation capture (manual + email parse)
- Quotation comparison screen
- Vendor finalisation + crane reservation
- Sales Dashboard + Admin Dashboard
- Vendor Portal (login, fleet mgmt, RFQ response, quotation submit)
- Communication log + Audit trail
- Admin configuration screen

### Phase 2: SAP Integration (Weeks 9-12)
Dependency: SAP landscape confirmed, integration mechanism agreed.

- SAP enquiry inbound (webhook/polling)
- SML fleet data reader (on-demand OData)
- SAP Enquiry Inbox screen (auto-populated)
- Booking confirmation push to SAP
- Integration error handling + admin monitoring

### Phase 3: Recommendation Engine + GIS (Weeks 13-16)
Dependency: Google Maps API POC validated.

- Google Maps Distance Matrix integration
- Mobilisation cost calculation engine
- SML Fleet Recommendations (SAP data + distance ranking)
- Vendor Fleet Recommendations (DB + distance ranking)
- Recommendation snapshot storage
- Map View + Heat Map screen
- Vendor Discovery Search with geo-filters

### Phase 4: Analytics, WhatsApp, Polish (Weeks 17-20)
Dependency: Phases 1-3 live, WhatsApp BSP confirmed.

- Management Dashboard with full KPIs
- Reports and Analytics screen (all BRD 6.23 metrics)
- WhatsApp Business API integration (dispatch + response capture)
- Full alerts and notification engine (all 8 alert types)
- Validation queue for unmatched responses
- Performance tuning + load testing
- Security audit + penetration test
- User documentation

---

## 14. Team Estimate

| Role | Count | Weeks | Responsibility |
|------|-------|-------|---------------|
| Full-Stack Lead | 1 | 20 | Architecture, backend core, integrations |
| Frontend Dev | 1 | 18 | All 23 screens, maps, dashboards |
| Backend Dev | 1 | 16 | API routes, business logic, jobs |
| DevOps (part-time) | 1 | 8 | Infra, CI/CD, monitoring, security |
| QA | 1 | 12 | Test plans, E2E tests, UAT support |

Total effort: ~74 person-weeks (~18.5 person-months)

---

## 15. Non-Functional Requirements

| Aspect | Target |
|--------|--------|
| Availability | 99.5% (Multi-AZ DB, container auto-restart) |
| API p95 latency | < 500ms (excluding external API calls) |
| Recommendation generation | < 5 seconds including Maps API |
| Concurrent users | 50 (scalable to 200+) |
| Data retention | Transactional: indefinite. Logs: 1 year rolling |
| Backup | Daily automated DB snapshots, 30-day retention |
| DR | RDS Multi-AZ failover. S3 cross-region optional |
| Browsers | Chrome, Edge, Firefox (latest 2 versions) |
| Mobile | Responsive design (vendor portal mobile-friendly) |

---

## 16. Key Architectural Decisions

1. **No Frappe** — Full control over UI/UX, performance, deployment, scaling. No framework lock-in.
2. **SML fleet stays in SAP** — Read on-demand, never replicated. SAP is system of record for internal equipment.
3. **Recommendations always segregated** — SML and vendor results in separate sections, never merged. Enforces internal-first sourcing.
4. **RFQ anchored to line item** — One RFQ per line item per RFQ event, multiple vendor recipients. Per BRD 7.2.
5. **Recommendation Snapshot mandatory** — JSONB snapshot preserves state at evaluation time for audit.
6. **PostGIS pre-filtering** — Spatial index reduces Google Maps API calls and costs.
7. **BullMQ for all async** — Single job queue for alerts, email, WhatsApp, SAP polling, SLA monitoring.
8. **Phased delivery** — Phase 1 works standalone. Each phase adds independent value.

---

## 17. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SAP mechanism unknown | Phase 1 works without SAP; manual enquiry entry fallback |
| Google Maps rate limits | PostGIS bounding box pre-filter, batch calls, cache results |
| WhatsApp BSP not available | Email-only fallback; WhatsApp is Phase 4 |
| Vendor adoption slow | Admin can enter fleet data on behalf; bulk CSV import |
| SAP uses PIPO not CPI/OData | Integration layer abstraction; swap transport without app changes |
| High load | Horizontal ECS scaling, read replica, Redis caching |

---

*End of Solution Architecture Document*
