# 02 — GoMechanic Capability Map

**AutoDeck OS Architecture Phase · August 2026**

> This document maps GoMechanic's capabilities as a **functional reference only**. AutoDeck will not copy GoMechanic's source code, visual design, brand identity, copywriting, or interaction patterns. We are studying what a serious automotive service platform must do — not how GoMechanic does it.

---

## 2.1 Service Catalogue Breadth

GoMechanic operates 11+ service verticals across India. This is the full functional scope as of 2025–2026.

### 1. Periodic Car Service
- Basic Service: oil change, oil filter, air filter check, brake fluid check
- Standard Service: adds spark plugs, coolant, battery check, brake pads
- Comprehensive Service: adds fuel injector clean, AC performance check, suspension check, 50-point health inspection
- Paid via subscription (GoMechanic Miles) or one-off

### 2. Denting & Painting
- Individual panel dent repair
- Full body dent and paint
- Alloy wheel refinishing
- Bumper repair (front/rear)
- Door alignment and repair

### 3. AC Service & Repair
- Gas top-up (regular / high-performance refrigerant)
- AC filter replacement
- Condenser cleaning
- Compressor repair/replacement
- Radiator services
- Full AC inspection

### 4. Car Spa & Cleaning
- Premium hand wash + vacuuming
- Exterior wax treatment
- Interior deep clean
- Steam cleaning
- Odour treatment
- Sunroof service and lubrication
- Door trim and seal treatment

### 5. Clutch & Body Parts
- Clutch plate and pressure plate replacement
- Body part replacement (doors, bonnets, boot)
- Door/bumper alignment
- Gear linkage servicing

### 6. Car Inspections
- Pre-owned vehicle inspection (before purchase) — 50-point checklist
- Normal inspection — general health check
- Custom issue inspection (specific problem diagnosis)
- Full underbody inspection (25-point)
- OBD scanning (error code diagnosis)

### 7. Suspension & Fitments
- Shock absorber replacement
- Wheel alignment and balancing
- Steering rack servicing
- Stabilizer bar and bushings
- Custom issue diagnosis

### 8. Detailing (Newest high-growth vertical — 25+ stores, 8 cities by 2025)
- Machine polishing
- Paint decontamination
- **Ceramic Coating** (Graphene, standard, express variants)
- **PPF — Paint Protection Film** (180-micron self-healing TPU, 5-year warranty)
- **Anti-rust treatment** (underbody)
- Interior detailing (leather treatment, deep conditioning)
- Teflon coating

### 9. Windshield & Lights
- Windshield replacement (OEM / aftermarket)
- Chip and crack repair (minor)
- Headlight polishing / restoration
- Taillight servicing
- Rain sensor calibration (ADAS vehicles)

### 10. Tyres & Wheel Care
- Tyre fitting and balancing
- Wheel alignment (2-wheel / 4-wheel)
- Tyre pressure monitoring
- Nitrogen filling
- Tyre rotation

### 11. Battery Services
- Battery health check
- Battery replacement (standard / premium)
- Jump start (emergency)

### 12. Accessories (newer)
- Seat covers
- Floor mats
- Dash cameras
- Car care products (retail)
- Tinting services

### 13. Insurance & Warranty Services
- Insurance claim assistance
- Extended warranty (5 product types: Authorised Warranty, 360 Protection, Engine Cover, Suspension Cover, Brake Cover)
- Warranty starting from ₹200/month

### GoMechanic's detailing coverage and AutoDeck implications
GoMechanic's detailing vertical is their newest growth area and most directly overlaps with AutoDeck's premium studio focus. Key observations:
- PPF at GoMechanic uses 180-micron self-healing TPU film with 5-year warranty — comparable to legacy source app's LLumar and Garware brands
- Ceramic coating offered in graphene and standard variants
- Anti-rust expanding — not a current legacy source app/AutoDeck focus
- GoMechanic's detailing is volume-driven; AutoDeck's is quality-driven at higher ASP

---

## 2.2 Customer Journey

### Standard Booking Flow
1. **Registration/Login** — Phone OTP preferred (app) or Google Sign-In (web)
2. **Vehicle Setup** — Make, model, year, registration; stored as a profile
3. **Service Centre Selection** — Nearest garage, filter by rating; OR request pickup/drop
4. **Service Selection** — Browse vertical → select service → view fixed price quote
5. **Date & Time Slot** — Calendar with available slots per centre
6. **Booking Confirmation** — Instant confirmation with booking reference number
7. **Pre-visit SMS/push** — Reminder notification 24h and 2h before slot
8. **Vehicle Collection (if pickup requested)** — NSDC-certified technician arrives; performs 50-point pre-inspection with photos; customer signs digitally
9. **In-Progress Updates** — Push notifications at key milestones; Service Buddy (advisor) is the communication bridge
10. **Additional Work Approval** — If additional issues found, customer receives notification with details and price; must approve before work begins
11. **Job Completion** — Digital report generated (work done, parts used, condition notes)
12. **Payment** — Online (card, UPI, wallet) or at garage counter
13. **Vehicle Return** — Road-tested, washed, delivered; customer inspects condition
14. **Service Report** — Digital report and invoice available in app
15. **Rating & Review** — Post-service prompt for star rating and written review
16. **Warranty Activation** — 1-month/1,000km warranty automatically applies; extended warranty products upsold

### Pickup & Drop Flow
- Customer requests pickup from home/office
- GoMechanic's Assurance Program covers damages up to INR 25,000 during transit (for online-paid bookings only)
- Pre-service inspection with photo documentation at vehicle collection
- Digital inspection report shared with customer immediately
- Return delivery after service completion

### Live Tracking
- In-app status rail (analogous to food delivery tracking)
- Stage-by-stage progress (collected → inspection → service → quality check → ready → delivered)
- Push notifications at each stage transition
- GIA (GoMechanic Intelligent Assistant) surfaces recommended additional services based on vehicle profile and service history

### Post-Service Flow
- Service history stored in app permanently
- Warranty details accessible in-app
- Annual inspection reminders (to maintain PPF/ceramic warranty validity)
- Re-booking flow from history

---

## 2.3 Membership Model — GoMechanic Miles

GoMechanic Miles is a subscription membership (not a wash-count membership like legacy source app). Key features:

- **Duration**: 12 months (hatchback/sedan) or 15 months (SUV/luxury)
- **Core benefit**: Covers the 2 annual comprehensive services that a car needs — included in membership cost
- **Savings claim**: "50% extra savings on 300+ services"
- **Minimum discount**: 10% on all services, always
- **Free pickup & drop**: Included with membership (normally a paid add-on)
- **SOS Emergency Callouts**: 2 per year, free (flat tyre, battery failure, etc.)
- **Amazon Prime**: 1 month included (India-market bundle; irrelevant to AutoDeck)
- **Billing**: Upfront annual payment or EMI
- **Loyalty mechanics**: Members get priority booking slots, faster response times

### AutoDeck membership model implications
GoMechanic Miles bundles service inclusions (the periodic services themselves) with discounts. legacy source app uses a simpler wash-count model (fixed washes per month, percentage off premium services). AutoDeck should design membership that fits premium service context:
- Premium members get priority scheduling (not just price benefits)
- Annual PPF inspection reminders that maintain warranty validity
- Detailing package inclusions rather than open-ended service discounts
- Named membership tiers that feel exclusive, not utilitarian

---

## 2.4 Trust Mechanisms

### Upfront Pricing
GoMechanic's core brand promise is "no hidden costs". Every service has a fixed, listed price visible before booking. The platform eliminates the traditional garage trust problem (being charged more than quoted) by price-locking at booking.

### 50-Point Pre-Service Inspection
At vehicle collection (or at garage arrival), a standardised 50-point checklist is completed with photos. This:
- Documents pre-existing damage (legal protection)
- Sets expectations for the service scope
- Creates a shared baseline the customer can reference post-delivery
- Builds trust through process visibility

### Digital Service Report
At job completion, a full digital report is generated:
- Work completed (line items)
- Parts used (OEM/OES designation)
- Technician notes
- Pre/post photos
- Time in service
This is shared with the customer via app and optionally by WhatsApp/email.

### Warranty Types
- **Network warranty**: 1 month / 1,000 km — applicable to standard services
- **Extended warranty products**: 5 types, from ₹200/month — Authorised Warranty, 360 Protection, Engine Cover, Suspension Cover, Brake Cover
- **PPF warranty**: 5 years on film
- **Ceramic coating warranty**: Defined coverage period per product

### Service Buddy (Advisor) Model
The most differentiating operational feature. Each booking is assigned a dedicated Service Buddy — a named, identifiable contact person who:
- Communicates directly with the customer throughout the service
- Explains any additional findings
- Confirms customer approval before upsell or additional work
- Handles complaint resolution
- Calls/messages proactively at key stages

This is what separates GoMechanic from anonymous garage aggregators. The Service Buddy is the human face of what is otherwise a digital platform.

**AutoDeck implication**: In a single-studio premium model, the studio team itself plays this role naturally. AutoDeck's communication features must surface staff names and enable direct, personal-feeling communication — not anonymous system updates.

---

## 2.5 Studio/Partner Operational Model

### The Partner Model
GoMechanic is asset-light. It brands and standardises independent garages rather than owning them. Partner garages:
- Sign exclusive contracts with revenue-sharing (GoMechanic takes 15–25% of invoice)
- Are rebranded as GoMechanic-certified centres
- Follow mandated standard operating procedures
- Use GoMechanic's Partner App for job management
- Source parts through GoMechanic's procurement channel

### Partner App Features
- Weekly/monthly dashboard of jobs and revenue
- Spare parts directory (GoMechanic Luxe and GoMechanic Spares private labels)
- Full-time operations support from GoMechanic team
- Job assignment notifications
- Quality score tracking

### Job Assignment
Demand routing: jobs are matched to available garages based on proximity, capacity, and rating score. Higher-rated garages receive more demand. Technician assignment within the garage is left to the studio manager.

### Quality Control
- Standardised SOPs enforced through Partner App
- NSDC-certified technician training programme
- Real-time SLA adherence tracking (via job timestamps in app)
- Incentive structure: better customer ratings → more demand routing → higher revenue
- GoMechanic Assurance Program: damage liability during transit (platform-level, not studio-level)

### Parts Model
- Centralised procurement of OEM/OES parts by GoMechanic
- Claimed 12–20% cost advantage over independent garages through volume
- Private label: GoMechanic Luxe (premium), GoMechanic Spares (standard)
- Parts distribution to partner garages reduces individual garage procurement effort

---

## 2.6 UAE Competitors (External Research Reference — Not AutoDeck's Market)

> **Note:** The following competitor analysis covers UAE market platforms. AutoDeck's launch market is India (Ahmedabad). This section is preserved as functional reference only — to understand what premium automotive service platforms can look like at maturity. Do not use UAE pricing, payment methods, or localization assumptions as AutoDeck product decisions.

### Service My Car (UAE market leader)

**Operational model**: 4-step clearly communicated service: Book → Collect (with digital inspection) → Service (customer approval required for any additional work) → Deliver (road-tested, cleaned, returned)

**Service depth**:
- 12-month / 10,000 km warranty on services using genuine parts
- Segment-specific pricing (Regular: AED 349, Premium: AED 499, Luxury: AED 1,999+)
- Free pickup/delivery in Dubai and Abu Dhabi; surcharge for other emirates
- 360-degree video health check at collection
- 30-point multipoint inspection (fully digital, shared with customer)
- Explicit "no work without customer approval" policy — surfaced prominently in UX

**Tech**: Native iOS, Android, Huawei AppGallery. WhatsApp communication standard.

**What they do better than GoMechanic**:
- Video documentation vs. static photos
- UAE-specific service tiers (luxury pricing)
- Stronger no-unauthorized-work guarantee (explicit, visible)
- Local regulatory compliance (RTA inspection services)

### Carcility (UAE)

**Model**: Marketplace — customer describes need, multiple garages bid, customer compares quotes.

**Distinct features**:
- Multi-garage quote comparison (differentiator vs. fixed-price platforms)
- Services: detailing, ceramic coating, PPF, repair, AC, battery, oil, EV charging, smart keys, emergency fuel delivery
- Multi-language (English/Arabic)
- Multi-currency
- Verified reviews with response system
- Promo codes
- Real-time job tracking

**Relevant observation**: Carcility's marketplace model means no fixed pricing — suitable for comparison-shopping customers, not ideal for premium positioning where the studio brand is the product.

### MySyara (UAE — 120,000+ customers, 15+ years)

**Model**: Owned service brand (not marketplace). "Book in 3 clicks."

**Distinct features**:
- Doorstep car wash (mobile service team)
- Buy Now Pay Later via Tabby, Tamara, Yusr (up to 12-month BNPL plans)
- Apple Pay, Visa, Mastercard
- Before/after photo documentation (standard feature)
- Full service history in-app (permanent)
- 30-day service guarantee
- WhatsApp booking option (in addition to app)
- Coverage: Dubai, Sharjah, Ajman, Abu Dhabi; expanding

**Key takeaway**: MySyara shows that BNPL options increase conversion for high-value automotive services. In India, Razorpay-native EMI (HDFC, ICICI, Simpl, LazyPay) serves this need — no separate BNPL provider needed.

### What premium automotive service customers expect (synthesised from UAE + India research)

- Native iOS + Android app (not PWA or web-only)
- WhatsApp as primary communication channel (India: non-optional; UAE: standard)
- Before/after photo gallery as a standard deliverable, not a bonus
- EMI/BNPL for high-value services (India: Razorpay EMI; UAE: Tabby/Tamara — not applicable to AutoDeck V1)
- Explicit "no work without your approval" as visible UX element, not just a policy
- Video documentation where possible
- Service history as permanent vehicle passport

---

## 2.7 Key Lessons for AutoDeck

### Study these from GoMechanic
1. **Transparent, fixed pricing** eliminates the core trust barrier in automotive service. AutoDeck must commit to showing real prices before booking — no "call for a quote" friction.
2. **Free pickup/drop** is the biggest conversion driver. Customers who don't have to bring the car in are far more likely to book. AutoDeck must make this default and premium.
3. **Pre-service inspection with photos** protects both parties and builds trust immediately. This must be a required step in every AutoDeck job, not an optional field.
4. **Service Buddy / dedicated advisor** is the differentiator between a cold booking platform and a relationship business. In a single-studio model, this is the studio manager or assigned technician. Surface their name and photo in the customer app.
5. **Digital service report** at job completion converts a transaction into a document customers keep. AutoDeck's version should be richer — a sealed, downloadable PDF that includes product specifications, technician credentials, before/after photos, and warranty terms.
6. **Membership / subscription** significantly increases customer retention and lifetime value. AutoDeck's membership must fit the premium detailing context (priority scheduling, included annual inspections, product top-up discounts).

### Avoid these from GoMechanic
1. **Growing before unit economics are proven.** GoMechanic's fraud emerged from growth-at-all-costs pressure. AutoDeck must build a profitable single studio before considering expansion.
2. **Opaque complaint resolution.** GoMechanic's ~33% complaint resolution rate was a consistent negative. AutoDeck must have a visible, responsive escalation path.
3. **Anonymous platform feel.** GoMechanic's scale means customers often don't know who worked on their car. AutoDeck's premium positioning means customers should always know exactly who handled their vehicle.
4. **Over-relying on parts margins.** GoMechanic's private-label parts were central to their business model and to their accounting violations. AutoDeck's revenue should be primarily service-based.

### Do better than GoMechanic and India competitors on these
1. **Warranty as a real certificate.** No platform produces a genuine, sealed, downloadable warranty certificate that travels with the car. AutoDeck should. A PDF warranty certificate with QR verification, product batch number, installer credentials, and specific coverage terms is a meaningful differentiator.
2. **Vehicle passport as a primary product surface.** All platforms treat service history as a list of receipts. AutoDeck should treat it as a vehicle asset — a living document that increases the car's resale value and proves care.
3. **Annual inspection reminders tied to warranty maintenance.** PPF and ceramic warranties typically require an annual inspection to remain valid. No platform surfaces this proactively in-app. AutoDeck should.
4. **Technician identity.** Surface who did the work — name, certification, years of experience. Build trust through human attribution, not anonymous service status updates.

---

## 2.8 Capability Gaps in GoMechanic

These are areas where GoMechanic is demonstrably weak, and where AutoDeck can meaningfully differentiate:

### Complaint Resolution
GoMechanic's public complaint resolution rate is approximately 33% (consumer forum data). Complaints commonly cite: charged for work not done, damage during service, warranty not honoured, pickup delays. At scale, without dedicated service advisors per booking, this is an inevitable outcome of the partner model.

**AutoDeck opportunity**: In a single-studio model, every complaint is addressable by name. AutoDeck can build a complaint and warranty claim flow that creates a real resolution record — not just a chatbot response.

### Warranty Experience
GoMechanic's warranty is a line of text in a digital invoice. There is no certificate, no physical artefact, no QR-verifiable proof. The extended warranty products are sold as a separate insurance-adjacent product rather than as documentation of work done.

**AutoDeck opportunity**: Premium customers want to feel that their warranty is real and verifiable. A sealed PDF warranty certificate with the studio stamp, technician name, product batch number, warranty terms, and QR code that anyone can scan to verify — this is a genuine product advantage.

### Premium Detailing Segment
GoMechanic serves the PPF/ceramic market as one vertical among eleven. It is a volume business applying standardised processes to a segment that demands individual attention. A premium detailing studio cannot be managed through the same process as an oil change centre.

**AutoDeck opportunity**: Build natively for the premium detailing context. Every feature — inspection, documentation, status updates, delivery — should reflect that this is a luxury service, not a commodity.

### Documentation Quality
GoMechanic's digital reports are functional but not premium. Photos are often mobile-camera snapshots with inconsistent lighting and framing. The documentation does not convey craftsmanship.

**AutoDeck opportunity**: AutoDeck's photo requirements should specify quality: consistent studio lighting, multiple angles, detail shots of film application, panel coverage documentation. Before/after comparisons should be presented as a portfolio, not a ticket attachment.
