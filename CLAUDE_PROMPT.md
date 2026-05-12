# Prompt for Claude (Copy-paste this entire text to Claude)

---

I need you to generate a professional **Project Timeline & Effort Estimation Document** in Word document format (.docx) for a software project. The document should be formatted with proper headings, tables, and professional styling suitable for client/stakeholder presentation.

Here is the complete project information. Convert this into a well-structured Word document with the following formatting requirements:

## Formatting Requirements:
- Title page with project name, date, version, and "Confidential" marking
- Table of contents
- Proper heading hierarchy (H1, H2, H3)
- All data tables should be properly formatted with borders, header row shading (dark blue with white text), and alternating row colors
- Use a professional color scheme (navy blue headers, clean white background)
- Page numbers in footer
- Section breaks between major sections
- Executive summary at the top (2-3 paragraphs summarizing the timeline, cost, and scope)
- Keep all content as-is — do not reduce or summarize any section
- For Gantt chart: Create a visual table-based Gantt chart with weeks as columns and phases/tasks as rows. Use colored cells (dark blue for active weeks) to show duration.
- For Process Flow: Create a professional flowchart using shapes and arrows (or a structured step-by-step diagram with boxes and connectors).
- For all diagrams: Use professional formatting suitable for Word — boxes with borders, arrows, color-coded stages.

## Project Content (use exactly as provided):

---

# Crane Discovery & Vendor Repository Platform
# Project Timeline & Effort Breakdown — 15 Weeks

## Scope
Full standalone software including all 23 screens, 6 functional modules, Google Maps/GIS integration, recommendation engine, RFQ automation, vendor portal, analytics, WhatsApp integration, alerts engine, and SAP data integration (platform-side only). Includes complete process lifecycle from master data creation through enquiry handling, crane discovery, quotation management, and booking confirmation.

---

## Cloud Infrastructure — AWS (Low-to-Medium Configuration)

### Why Each Resource Is Needed

This section explains every cloud component, what it does for the platform, and exactly how much CPU, RAM, storage, and bandwidth is allocated. The configuration is sized for low-to-medium usage: 10–50 concurrent users, ~200 vendors in the repository, and ~500 enquiries/month.

| Component | What It Does in This Platform | Why It Cannot Be Removed |
|-----------|------------------------------|--------------------------|
| EC2 / App Runner (API Server) | Runs the backend application — handles all API requests from Sales UI, Vendor Portal, Admin Panel. Processes RFQ dispatch, quotation capture, recommendation engine logic. | Without this, the application does not run. This is the core compute. |
| EC2 / App Runner (Background Worker) | Executes scheduled jobs: email dispatch, WhatsApp message sending, alert checks (SLA monitoring), recommendation pre-computation, stale data detection. | Without background workers, emails won't send, alerts won't fire, and WhatsApp responses won't be processed. Runs alongside API to avoid blocking user requests. |
| RDS PostgreSQL + PostGIS | Stores ALL application data: vendors, equipment, enquiries, line items, RFQs, quotations, users, audit logs, communication logs. PostGIS extension enables geographic queries (find cranes within X km of job site). | This is the database — the entire system's data lives here. PostGIS is needed for distance-based crane discovery without expensive Google Maps calls for every query. |
| ElastiCache Redis | Powers background job queues (BullMQ), stores user sessions (JWT refresh tokens), caches frequently accessed data (vendor lists, cost configuration), and provides pub/sub for real-time notifications. | Without Redis, background jobs cannot be scheduled, session management degrades, and the notification system cannot function. |
| S3 (Object Storage) | Stores vendor onboarding documents (registration papers, GST certificates), RFQ attachments, quotation PDFs uploaded by vendors, and exported report files. | Vendor onboarding requires document upload. These files cannot be stored in the database — S3 is the industry-standard for file storage. |
| CloudFront (CDN) | Serves the React frontend (HTML/JS/CSS) to users across India with low latency. Also serves S3-stored documents securely via signed URLs. | Without CDN, every page load hits the origin server. With CDN, the frontend loads in <1 second from edge locations across India. |
| ALB (Load Balancer) | Distributes incoming requests to healthy application containers, terminates SSL (HTTPS), and provides health-check-based auto-recovery if a container crashes. | Even with 1 server, ALB provides SSL termination and automatic container restart on failure — essential for production reliability. |

### Detailed Resource Allocation (Verified May 2026)

| Resource | Service | vCPU | RAM | Storage | Bandwidth | Monthly USD | Monthly INR |
|----------|---------|------|-----|---------|-----------|-------------|-------------|
| API Server | AWS App Runner (1 instance) | 1 vCPU | 4 GB | — (stateless) | Included | $36 | 3,000 |
| Background Worker | AWS App Runner (1 instance) | 0.5 vCPU | 1 GB | — (stateless) | Included | $9 | 750 |
| Database | RDS PostgreSQL db.t4g.medium (Single-AZ) | 2 vCPU | 4 GB | 30 GB GP3 SSD | — | $52 | 4,330 |
| Cache + Queues | ElastiCache Redis cache.t4g.micro | 2 vCPU | 0.5 GB | — | — | $12 | 1,000 |
| File Storage | S3 Standard | — | — | 20 GB (grows) | 50 GB transfer/month | $2 | 170 |
| CDN (Frontend) | CloudFront (Free Tier Plan) | — | — | — | 100 GB transfer/month | $0 | 0 |
| Load Balancer | ALB ($0.0225/hr + LCU) | — | — | — | — | $22 | 1,830 |
| SSL Certificate | ACM (AWS Certificate Manager) | — | — | — | — | $0 (free) | 0 |
| DNS | Route 53 (1 hosted zone) | — | — | — | — | $1 | 83 |
| Secrets | AWS Secrets Manager (5 secrets @ $0.40 each) | — | — | — | — | $2 | 170 |
| Logging | CloudWatch Logs (5 GB/month) | — | — | 5 GB logs | — | $4 | 330 |
| **AWS Infrastructure Subtotal** | | **5.5 vCPU** | **9.5 GB** | **55 GB** | **150 GB** | **$140** | **11,663** |

Pricing source: AWS official pricing pages (us-east-1 region), verified May 2026. App Runner pricing: $0.064/vCPU-hour active + $0.007/GB-hour provisioned. API Server at 4 GB RAM provides headroom for recommendation engine computations, concurrent API requests, and JSON processing without memory pressure. RDS: ~$0.065/hr for db.t4g.medium. ALB: $0.0225/hr base + $0.008/LCU-hour. CloudFront Free Plan: 100 GB transfer + 1M requests + WAF + TLS at $0/month.

### External Services (Third-Party APIs)

| External Service | What It Does | Usage Estimate | Monthly USD | Monthly INR |
|-----------------|-------------|---------------|-------------|-------------|
| Google Maps Distance Matrix API | Calculates road distance from crane location to job site for recommendation ranking | ~5,000 elements/month | $0 (free tier) | 0 |
| Google Maps JavaScript API | Renders interactive maps, vendor location pins, and heat maps in the browser | ~2,000 map loads/month | $0 (free tier) | 0 |
| Google Geocoding API | Converts text addresses to lat/lng coordinates when vendors add new crane locations | ~500 requests/month | $0 (free tier) | 0 |
| WhatsApp Business API (Gupshup/AiSensy) | Sends RFQ messages to vendors via WhatsApp and receives vendor quotation responses via webhook | ~1,000 messages/month | $40 | 3,330 |
| Email — AWS SES | Sends RFQ emails, alert notifications, password resets, and vendor communication | ~2,000 emails/month ($0.10/1000) | $1 | 83 |
| Domain Registration | Custom domain for the platform (e.g., crane.sanghvimovers.com) | 1 domain | $1 | 83 |
| **External Subtotal** | | | **$42** | **3,496** |

Important Note on Google Maps Pricing (India): As of March 2025, Google Maps Platform offers India-specific pricing with up to 70,000 free API calls per product category per month. Since our usage is approximately 7,500 total calls/month (5,000 + 2,000 + 500), ALL Google Maps usage falls entirely within the free tier. No Maps charges will be incurred at this volume. Source: mapsplatform.google.com/pricing (India pricing effective August 2024, updated March 2025).

If usage exceeds the free cap in future (70,000+ calls/month), India pricing applies: Distance Matrix at $1.50/1000 elements, Dynamic Maps at $2.10/1000 loads, Geocoding at ~$1.50/1000 requests.

### Total Recurring Cloud Cost (with 10% buffer for overages/spikes)

| Period | AWS Infra (USD) | External Services (USD) | 10% Buffer | Total (USD) | Total (INR) |
|--------|----------------|------------------------|-----------|-------------|-------------|
| Monthly | $140 | $42 | $18 | **$200** | **16,650** |
| Quarterly | $420 | $126 | $55 | **$601** | **50,000** |
| Annual | $1,680 | $504 | $218 | **$2,402** | **2,00,000** |

The 10% buffer accounts for: unexpected traffic spikes, data transfer overages, additional CloudWatch log volume, S3 storage growth, and occasional Redis memory pressure.

### Cost Optimization Notes
- Google Maps is completely free at our usage volume for India billing accounts (70,000 free calls/product/month). This is a permanent ongoing free tier, not a limited-time credit.
- CloudFront Free Plan provides 100 GB transfer + 1M requests + WAF + TLS certificate at $0/month — sufficient for our frontend serving needs.
- AWS Free Tier (new accounts only, first 12 months): 750 hrs/month RDS db.t2.micro + 750 hrs EC2 t2.micro — partial savings possible in initial months.
- The configuration above supports 10–50 concurrent users comfortably with 4 GB RAM on API server providing headroom for recommendation engine batch processing.

### Incremental Cost Scenarios (Growth-Based)

| Scenario | Users | Enquiries/Month | What Changes | Monthly Cost (USD) | Monthly Cost (INR) |
|----------|-------|----------------|--------------|-------------------|-------------------|
| **Scenario 1: Launch (Current)** | 10–50 | 200–500 | Base configuration as above | **$200** | **16,650** |
| **Scenario 2: Growth** | 50–100 | 500–1,000 | + Second API instance (1 vCPU/4 GB), Upgrade RDS to db.t4g.large (8 GB RAM) | **$286** | **23,800** |
| **Scenario 3: Scale** | 100–200 | 1,000–2,500 | + RDS Multi-AZ, RDS Read Replica, Upgrade Redis to cache.t4g.small (1.37 GB), Third API instance | **$430** | **35,800** |
| **Scenario 4: Enterprise** | 200–500 | 2,500–5,000 | + Upgrade RDS to db.r6g.large (16 GB), Redis cache.r6g.medium, 4 API instances, WAF paid plan, Google Maps paid tier | **$710** | **59,100** |

Scenario Cost Breakdown:

| Component | Scenario 1 | Scenario 2 | Scenario 3 | Scenario 4 |
|-----------|-----------|-----------|-----------|-----------|
| API Server(s) | $36 (1×4GB) | $72 (2×4GB) | $108 (3×4GB) | $144 (4×4GB) |
| Background Worker | $9 | $9 | $18 (2 workers) | $18 |
| RDS PostgreSQL | $52 (t4g.medium) | $98 (t4g.large) | $196 (t4g.large Multi-AZ) | $350 (r6g.large Multi-AZ) |
| RDS Read Replica | — | — | $52 | $90 |
| ElastiCache Redis | $12 (t4g.micro) | $12 | $24 (t4g.small) | $80 (r6g.medium) |
| S3 + CloudFront | $2 | $5 | $10 | $20 |
| ALB + Route53 + Others | $29 | $29 | $29 | $29 |
| Google Maps | $0 (free tier) | $0 (free tier) | $0 (free tier) | $15 (over free cap) |
| WhatsApp + SES + Domain | $42 | $42 | $42 | $50 |
| 10% Buffer | $18 | $27 | $48 | $80 |
| **TOTAL** | **$200** | **$286** (Δ+$86) | **$430** (Δ+$144) | **$710** (Δ+$280) |

Key Insight: You only move to Scenario 2 when you actually HAVE 50+ daily users. The platform monitors usage metrics via CloudWatch — you'll see when CPU/memory/connections approach limits before they become problems. All upgrades are online (no downtime).

---

## Project Gantt Chart (15 Weeks)

Create this as a visual table-based Gantt chart in Word with colored cells showing active weeks per phase:

| Phase / Activity | W1 | W2 | W3 | W4 | W5 | W6 | W7 | W8 | W9 | W10 | W11 | W12 | W13 | W14 | W15 |
|-----------------|----|----|----|----|----|----|----|----|----|----|-----|-----|-----|-----|-----|
| **Phase 1: Foundation & Infrastructure** | ██ | ██ | ██ | | | | | | | | | | | | |
| Project scaffolding + CI/CD + AWS setup | ██ | | | | | | | | | | | | | | |
| Auth system + RBAC + Redis sessions | | ██ | | | | | | | | | | | | | |
| Base UI shell + Login + Admin screens | | | ██ | | | | | | | | | | | | |
| **Phase 2: Vendor Management** | | | | ██ | ██ | | | | | | | | | | |
| Vendor master CRUD + onboarding + docs | | | | ██ | | | | | | | | | | | |
| Vendor portal + fleet + availability | | | | | ██ | | | | | | | | | | |
| **Phase 3: Enquiry & Sourcing** | | | | | | ██ | ██ | ██ | | | | | | | |
| Enquiry CRUD + line items + dashboards | | | | | | ██ | | | | | | | | | |
| RFQ creation + dispatch + tracking | | | | | | | ██ | | | | | | | | |
| Quotation capture + comparison + finalise | | | | | | | | ██ | | | | | | | |
| **Phase 4: Recommendation Engine + Maps** | | | | | | | | | ██ | ██ | ██ | | | | |
| Distance Matrix + Geocoding + PostGIS | | | | | | | | | ██ | | | | | | |
| Recommendation engine (8-step logic) | | | | | | | | | | ██ | | | | | |
| Map views + heat maps + geo-search | | | | | | | | | | | ██ | | | | |
| **Phase 5: Analytics + WhatsApp + Alerts** | | | | | | | | | | | | ██ | ██ | | |
| Management dashboard + reports + export | | | | | | | | | | | | ██ | | | |
| WhatsApp API + alerts + notifications | | | | | | | | | | | | | ██ | | |
| **Phase 6: SAP Integration + Go-Live** | | | | | | | | | | | | | | ██ | ██ |
| SAP inbound + SML fleet reader | | | | | | | | | | | | | | ██ | |
| SAP push-back + testing + deployment | | | | | | | | | | | | | | | ██ |
| **QA & Testing (continuous)** | | | | | | | | ██ | ██ | ██ | ██ | ██ | ██ | ██ | ██ |
| **DevOps (bookend)** | ██ | ██ | | | | | | | | | | | | ██ | ██ |

Color Legend: ██ = Active development week. Use dark blue fills for phase bars, light blue for sub-tasks, green for QA track, grey for DevOps.

---

## Platform Process Flow Diagram

Create this as a professional flowchart in Word using shapes, boxes, and directional arrows. The flow should read top-to-bottom with clear stage separation:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CRANE DISCOVERY PLATFORM — PROCESS FLOW                    │
└─────────────────────────────────────────────────────────────────────────────────┘

STAGE 1: MASTER DATA CREATION
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Admin creates   │    │  Vendor submits  │    │  Admin approves  │
│  user accounts   │───→│  onboarding      │───→│  vendor + fleet  │
│  (Sales, Admin)  │    │  (docs, fleet)   │    │  data verified   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Cost config     │    │  Region mapping  │    │  Email/WhatsApp  │
│  (₹/km rates)   │    │  setup           │    │  templates setup │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
STAGE 2: ENQUIRY RECEIPT
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Enquiry arrives │    │  Sales reviews   │    │  Line items      │
│  (SAP push OR    │───→│  enquiry details │───→│  created with    │
│   manual entry)  │    │  + site location │    │  crane specs     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
STAGE 3: CRANE DISCOVERY & RECOMMENDATION
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  System matches  │    │  PostGIS filters │    │  Google Maps     │
│  crane type +    │───→│  by 200km radius │───→│  calculates      │
│  capacity        │    │  (reduces scope) │    │  road distances  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Compute mobili- │    │  Rank by nearest │    │  Show SML fleet  │
│  sation cost     │───→│  distance (asc)  │───→│  + Vendor fleet  │
│  (dist × ₹/km)  │    │  separately      │    │  SEPARATELY      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
STAGE 4: RFQ DISPATCH & QUOTATION
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Sales selects   │    │  RFQ dispatched  │    │  Vendors receive │
│  vendors for     │───→│  via Email +     │───→│  RFQ and submit  │
│  RFQ             │    │  WhatsApp        │    │  quotations      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
STAGE 5: QUOTATION COMPARISON & SELECTION
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  System shows    │    │  Sales shortlists│    │  Final vendor    │
│  side-by-side    │───→│  / rejects with  │───→│  selected +      │
│  comparison      │    │  reason codes    │    │  crane reserved  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
STAGE 6: BOOKING & CONFIRMATION
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Booking confirm │    │  Confirmation    │    │  Crane availabi- │
│  generated       │───→│  pushed back     │───→│  lity calendar   │
│                  │    │  to SAP          │    │  updated         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
STAGE 7: CONTINUOUS MONITORING
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Alerts fire for │    │  Management      │    │  Reports export  │
│  SLA breaches,   │    │  dashboard shows │    │  (CSV/PDF) for   │
│  stale data,     │    │  KPIs, trends,   │    │  vendor perf,    │
│  pending quotes  │    │  fulfillment %   │    │  mobilisation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Simplified Process Flow (For Quick Reference)

```
Master Data Setup → Enquiry Receipt → Crane Discovery → RFQ Dispatch → Quotation Collection → Comparison & Selection → Booking Confirmation → SAP Push-back → Analytics & Monitoring
```

Detailed Step-by-Step:

| Step | Action | Who Does It | System Support |
|------|--------|------------|----------------|
| 1 | Create vendors, upload fleet data, set cost config | Admin + Vendors | Vendor portal, bulk CSV import, onboarding approval |
| 2 | Enquiry arrives (from SAP or manual entry) | SAP / Sales | Webhook receiver, manual entry form, CSV import |
| 3 | Sales reviews enquiry, creates line items with crane specs | Sales | Enquiry detail screen, line item form |
| 4 | System finds matching cranes (type + capacity + availability) | Automatic | PostGIS query, availability calendar check |
| 5 | System calculates distances using Google Maps Distance Matrix | Automatic | Batch 25 origins/request, caches results |
| 6 | System ranks cranes by nearest distance, computes mobilisation cost | Automatic | Recommendation engine, cost_config table |
| 7 | Sales reviews recommendations (SML fleet separate from Vendor fleet) | Sales | Sourcing workspace, split-panel view |
| 8 | Sales selects vendors and creates RFQ | Sales | RFQ creation screen |
| 9 | RFQ dispatched to vendors via Email + WhatsApp | Automatic | AWS SES + WhatsApp BSP, communication log |
| 10 | Vendors respond with quotations (portal / WhatsApp / email) | Vendors | Vendor portal, WhatsApp webhook, manual capture |
| 11 | Sales compares quotations side-by-side | Sales | Quote comparison screen |
| 12 | Sales shortlists/rejects vendors with reason codes | Sales | Status workflow with reason codes |
| 13 | Sales finalises vendor, crane reserved in availability calendar | Sales | Final selection screen, calendar update |
| 14 | Booking confirmation generated and pushed to SAP | Automatic | SAP outbound API call |
| 15 | Alerts monitor SLA, stale data, pending responses | Automatic | BullMQ scheduled jobs, notification engine |
| 16 | Management views KPIs, exports reports | Management | Dashboard, analytics screen, CSV/PDF export |

---

## 15-Week Development Timeline

### Phase 1: Foundation & Core Infrastructure (Weeks 1–3)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| Week 1 | Project scaffolding (monorepo: React + Node.js + TypeScript), CI/CD pipeline (GitHub Actions), PostgreSQL + PostGIS DB setup, Drizzle ORM schema + full migrations, Docker configs, AWS infrastructure provisioning (App Runner, RDS, ElastiCache, S3, ALB, CloudFront) | DevOps, Backend |
| Week 2 | Authentication system (JWT + refresh tokens + bcrypt), User CRUD, Role-based access control (4 roles: Sales, Vendor, Admin, Management), password reset flow, session management with Redis | Backend, Security |
| Week 3 | Base UI shell (Ant Design layout, sidebar navigation, role-based routing), Login/Logout pages, Admin user management screen, responsive layout foundation | Frontend |

Phase 1 Output: Deployable app skeleton with auth, roles, and CI/CD pipeline running on AWS.

### Phase 2: Vendor Management Module (Weeks 4–5)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| Week 4 | Vendor master CRUD API + UI, vendor onboarding workflow (draft → pending → approved/rejected), vendor contacts management, vendor document upload (AWS S3), Admin onboarding approval screen | Backend, Frontend |
| Week 5 | Vendor equipment/fleet management (CRUD with PostGIS location), vendor portal login + dashboard, vendor fleet management screen (add/edit/update cranes), availability status management, bulk CSV import for vendor fleet data | Backend, Frontend |

Phase 2 Output: Fully functional vendor repository with portal access for external vendors.

### Phase 3: Enquiry & Sourcing Workflow (Weeks 6–8)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| Week 6 | Enquiry CRUD (manual entry + CSV import), enquiry line items with 10-stage status workflow, Sales Dashboard (counters, filters, action items), Enquiry Inbox screen, Enquiry Detail screen with line item listing | Backend, Frontend |
| Week 7 | RFQ creation screen (auto-populated from line item), RFQ dispatch engine (email via AWS SES), RFQ vendor recipients tracking, RFQ tracking screen, email template system, communication log (all outbound recorded) | Backend, Frontend |
| Week 8 | Quotation capture (manual entry + email parse helper), quotation comparison screen (side-by-side), shortlist/reject/select workflow with reason codes, vendor finalisation + crane reservation (availability calendar update), booking confirmation screen, final selection screen | Backend, Frontend |

Phase 3 Output: Complete sourcing lifecycle from enquiry to vendor finalisation operational via email-based RFQ.

### Phase 4: Recommendation Engine + Maps (Weeks 9–11)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| Week 9 | Google Maps Distance Matrix API integration, Geocoding API integration (address → lat/lng), PostGIS spatial queries (bounding box pre-filter), distance calculation service (batch 25 origins/request), mobilisation cost computation engine (distance × cost_per_km) | Backend, Integration |
| Week 10 | Recommendation engine (full 8-step logic), vendor fleet recommendations (ranked by distance), recommendation snapshot storage (JSONB), Line-Item Sourcing Workspace (combined view: recommendations + RFQ + quotations), SML fleet recommendations (data from SAP on-demand) | Backend, Frontend |
| Week 11 | Google Maps JavaScript API frontend integration, Map View screen (vendor locations, crane pins), Heat Map screen (vendor density by region), Vendor Discovery Search screen with geo-filters (type, capacity, radius, region), Vendor Detail screen (profile + fleet + RFQ history + metrics), Equipment/Crane Detail screen | Frontend, Integration |

Phase 4 Output: Distance-based recommendation engine live with map visualisation and geographic vendor discovery.

### Phase 5: Analytics, WhatsApp & Alerts (Weeks 12–13)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| Week 12 | Management Dashboard (KPI cards: enquiry volumes, fulfillment ratio, turnaround, response rates), Reports & Analytics screen (vendor performance, mobilisation metrics, crane category views), report export (CSV/PDF), date/region/vendor filter controls, WhatsApp Business API integration (outbound RFQ dispatch via BSP) | Frontend, Backend, Integration |
| Week 13 | WhatsApp inbound webhook (response capture), response parsing + auto-match to RFQ, validation queue for unmatched responses (Admin screen), multi-channel dispatch (email + WhatsApp simultaneously), Alerts & notification engine (all 8 alert types via BullMQ scheduled jobs), in-app notification system (bell icon, notification panel, mark-as-read), email alert delivery, Communication History screen, Admin Configuration screen (cost params, templates, SLA thresholds, region mapping) | Backend, Frontend |

Phase 5 Output: Full analytics, multi-channel RFQ (email + WhatsApp), and automated alert system operational.

### Phase 6: SAP Integration + Testing + Deployment (Weeks 14–15)

| Week | Deliverables | Effort Area |
|------|-------------|-------------|
| Week 14 | SAP enquiry inbound integration (REST/webhook endpoint to receive enquiry data from SAP), data mapping and validation layer, error handling and retry logic, SAP Enquiry Inbox screen (auto-populated from SAP push), integration status dashboard for monitoring SAP data flow, SML fleet data reader endpoint (on-demand pull via OData/RFC — platform side only), Booking confirmation push-back to SAP (outbound API call on vendor finalisation), integration error queue with admin retry UI | Backend, Integration |
| Week 15 | SAP integration end-to-end testing with sandbox, integration logging and audit trail, End-to-end testing (Playwright E2E suite), performance testing + optimization, security hardening (rate limiting, input validation audit, CORS tightening), production deployment on AWS, DNS + SSL setup, monitoring + alerting (uptime checks, error tracking), user documentation + handover | QA, DevOps, All |

Phase 6 Output: Production-ready platform deployed on AWS with SAP integration live, security hardened, fully tested, and documentation complete.

### SAP Integration Scope (Platform-side only, Weeks 14–15)

Note: This covers ONLY the integration layer on the platform side — receiving data from SAP and pushing data back to SAP. No SAP-side development (ABAP, CPI/CPI-DS, PIPO configuration) is included. SAP-side work is assumed to be handled by the client's SAP team or SAP partner.

SAP Integration Assumptions:
- SAP team provides: webhook/API endpoint for booking push-back, OData service for SML fleet read, and configures outbound enquiry dispatch to our REST endpoint.
- Platform team builds: inbound receiver, data transformer, outbound caller, error handling, and monitoring UI.
- No ABAP development, no CPI flow development, no SAP Fiori work is included in this effort.

---

## Effort Breakdown by Role (15 Weeks)

| Role | Weeks Active | Weekly Hours | Total Hours | Key Deliverables |
|------|-------------|-------------|-------------|------------------|
| Full-Stack Lead / Architect | Weeks 1–15 | 45 | 675 | Architecture decisions, DB design, recommendation engine, SAP integration layer, code reviews, deployment |
| Frontend Developer | Weeks 3–15 | 45 | 585 | All 23 screens (React + Ant Design + TypeScript), Google Maps UI, dashboards, responsive design, vendor portal, SAP monitoring UI |
| Backend Developer | Weeks 1–15 | 45 | 675 | REST APIs, business logic, BullMQ workers, email/WhatsApp dispatch, alert engine, audit system, SAP inbound/outbound integration |
| DevOps Engineer (part-time) | Weeks 1–2, 14–15 | 25 | 100 | CI/CD pipeline, Docker, AWS infra, monitoring, security hardening, production deploy |
| QA Engineer | Weeks 6–15 | 40 | 400 | Test plans, API testing (Supertest), E2E tests (Playwright), UAT coordination, SAP integration testing, bug verification |

| Summary | Value |
|---------|-------|
| Total Person-Hours | 2,435 hours |
| Total Person-Weeks | ~61 person-weeks |
| Total Person-Months | ~15.2 person-months |

SAP Integration Effort (included in above): ~90 hours across Weeks 14–15 for inbound receiver, outbound push, data mapping, error handling, integration testing, and monitoring UI.

---

## Effort Breakdown by Category

| Category | Hours | % of Total |
|----------|-------|-----------|
| Backend Development (APIs, logic, SAP integration) | 810 | 33% |
| Frontend Development (23 screens, maps, dashboards) | 650 | 27% |
| Architecture & Design (DB, API, SAP integration design) | 280 | 12% |
| Testing & QA (unit, integration, E2E, SAP testing) | 370 | 15% |
| DevOps & Infrastructure (CI/CD, cloud, monitoring) | 160 | 7% |
| Documentation & Handover | 85 | 3% |
| Project Management & Coordination | 80 | 3% |
| Total | 2,435 | 100% |

---

## Milestone Summary

| Milestone | Week | What Ships |
|-----------|------|-----------|
| M1: App Skeleton | End of Week 3 | Auth, RBAC, base UI, CI/CD, AWS infra deployed |
| M2: Vendor Module | End of Week 5 | Vendor repo, portal, fleet management, onboarding |
| M3: Sourcing Workflow | End of Week 8 | Full enquiry-to-finalisation lifecycle with email RFQ |
| M4: Maps & Recommendations | End of Week 11 | Distance-ranked recommendations, map view, geo-search |
| M5: Analytics + Alerts | End of Week 13 | Dashboards, WhatsApp RFQ, alerts, notification engine |
| M6: Production Release | End of Week 15 | SAP integration + full testing + production deployment |

---

## Technology Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Ant Design + Google Maps JS API |
| Backend | Node.js + Express.js + TypeScript |
| Database | PostgreSQL 16 + PostGIS (AWS RDS Managed) |
| ORM | Drizzle ORM (type-safe, SQL-first) |
| Cache & Queue | Redis (AWS ElastiCache) + BullMQ |
| File Storage | AWS S3 |
| Email | AWS SES (Simple Email Service) |
| WhatsApp | WhatsApp Business API via Gupshup/AiSensy |
| Maps | Google Maps Platform (Distance Matrix + JS API + Geocoding) |
| Auth | JWT (access + refresh) + bcrypt |
| CI/CD | GitHub Actions → Docker → AWS App Runner |
| Monitoring | AWS CloudWatch + Sentry (error tracking) |

---

## Excluded from This Timeline (Future Scope)

- SAP-side development (ABAP programs, CPI/CPI-DS iFlows, PIPO channel configuration, Fiori apps) — must be done by client's SAP team
- Mobile native app (responsive web covers mobile use for now)
- Advanced ML-based vendor scoring (manual metrics in V1)
- Multi-tenant architecture (single-tenant deployment in V1)

## SAP Integration Scope Clarification

Included in this timeline (Platform-side only):
- REST endpoint to receive enquiry data pushed from SAP
- OData/RFC consumer to pull SML fleet data on-demand
- Outbound API call to push booking confirmation back to SAP
- Data mapping, validation, and error handling layer
- Integration monitoring dashboard and error retry UI
- Integration audit log for all SAP data exchanges

NOT included (SAP-side, to be done by SAP team):
- SAP outbound configuration to push enquiries to platform webhook
- SAP OData service exposure for SML fleet data
- SAP inbound interface to receive booking confirmations
- ABAP/CPI/PIPO development and testing on SAP landscape
- SAP user authorization and role configuration

---

END OF CONTENT.

Generate this as a downloadable Word document (.docx) with professional formatting as described above. Ensure the Gantt chart is rendered as a colored table, the process flow as a diagram with boxes/arrows, and all data tables have proper borders and header styling.
