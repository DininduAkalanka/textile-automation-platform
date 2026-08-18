# Nandana Textile — 10-Minute Viva Demonstration Script

**Project Title:** Smart Textile Business Management & E-Commerce Platform with AI Intelligence  
**Target Audience:** Academic Evaluators & External Examiners  
**Time Limit:** 10 Minutes + 5 Minutes Q&A

---

## ⏱️ Presentation Timeline Overview

| Section | Time | Theme | Key Technical Showcase |
| :--- | :---: | :--- | :--- |
| **1. Introduction & AI Assistant** | 0:00 – 2:00 | Storefront & Customer RAG | Grounded AI recommendations (Hydrate-and-Validate) |
| **2. Tailored Commerce & BR3** | 2:00 – 4:00 | Custom Measurements & Cart | Form validation, person profiles & measurement snapshot |
| **3. Checkout & Payment Security** | 4:00 – 6:00 | Secure Payments & Webhooks | Server-to-server webhook verification, row locking |
| **4. Operations & Factory Pipeline**| 6:00 – 8:00 | Admin & Factory Workflow | State machine stage progression, double-entry ledger |
| **5. AI Business Intelligence** | 8:00 – 10:00| Analytics & Demand Forecast | Tool-calling BI agent, SARIMAX forecasting |

---

## 🎬 Minute-by-Minute Walkthrough

### Part 1: Storefront & Customer AI Assistant (0:00 – 2:00)

1. **Open Storefront (`http://localhost:3000`)**:
   - *"Welcome, respected evaluators. Nandana Textile is an enterprise-grade platform combining smart retail e-commerce, custom garment manufacturing, and grounded AI intelligence."*
2. **Demonstrate Customer Shopping Assistant**:
   - Click the floating chat bubble on the bottom right.
   - Type: `I need a durable fabric for school uniforms that stays cool.`
   - **Show Evaluators**: The AI responds with natural language advice **and interactive product cards**.
   - **Key Technical Highlight to Mention**:
     > *"This is powered by Retrieval-Augmented Generation (RAG). The LLM is structurally prevented from hallucinating fake products because our backend validates returned IDs against PostgreSQL full-text search results and hydates real prices directly from the database."*

---

### Part 2: Tailored Garments & Measurement System (2:00 – 4:00)

1. **Select a School Uniform Product**:
   - Navigate to a uniform garment (e.g. *Boys School Uniform Shirt*).
   - Show the specifications and stock indicator.
   - Click **Add to Cart**.
2. **Open Shopping Cart (`/cart`)**:
   - **Show Business Rule BR3 Enforcement**: The cart indicates *"Measurements needed before you can check out"*, and the checkout button is disabled.
   - Click **Add Measurements**.
   - Fill in:
     - Person Name: `Dinindu`
     - Chest: `36 in`, Collar: `15 in`, Shirt Length: `28 in`
   - Save measurements.
   - **Highlight**: The checkout button becomes enabled immediately, and measurements are immutably snapshotted onto the order.

---

### Part 3: Checkout & Secure Webhook Processing (4:00 – 6:00)

1. **Proceed to Checkout (`/checkout`)**:
   - Select **Cash on Delivery (COD)** or **Card / Online Payment (PayHere)**.
   - Submit the order.
2. **Show Order Confirmation & Tracking Stepper (`/account/orders/:id`)**:
   - Show the visual order progression stepper (`PENDING` → `CONFIRMED` → `IN_PRODUCTION` → `DELIVERED`).
3. **Show PayHere Signature Security**:
   - Explain the zero-trust payment architecture:
     > *"In our architecture, the frontend is completely untrusted. The only event that confirms an online payment is a server-to-server signed webhook verified using MD5 cryptographic hashing."*

---

### Part 4: Admin Management & Production Pipeline (6:00 – 8:00)

1. **Switch to Admin Dashboard (`http://localhost:3000/admin`)**:
   - Log in as `admin@textileshop.com`.
   - Show real-time KPI metrics (Net Revenue, Total Orders, Active Production Batches).
2. **Open Production Pipeline (`/admin/production`)**:
   - Locate the order created in Part 2.
   - Advance the production task through the factory floor state machine:
     - `CUTTING` → `STITCHING` → `FINISHING` → `QUALITY_CHECK` → `READY_FOR_DISPATCH`
   - **Highlight**: Every status change is protected by strict state-machine guard transitions.
3. **Open Real-Time Inventory Ledger (`/admin/inventory`)**:
   - Show the append-only stock movements table.
   - Demonstrate that every unit of stock traces directly to an order or admin purchase with zero drift.

---

### Part 5: AI Business Intelligence & Forecasting (8:00 – 10:00)

1. **Navigate to AI Insights (`/admin/ai-insights`)**:
   - In the business assistant prompt, ask:
     `What were our top-selling products and total revenue last month?`
   - **Show Evaluators**: The AI executes parameterized backend analytical tools (`get_sales_summary`, `get_top_products`) and generates a structured summary with embedded visual charts.
   - **Key Technical Highlight**:
     > *"The AI model never sees customer personal data and cannot execute raw SQL. All figures are verified against our grounding checker before display."*
2. **Show Automated Demand Forecasting**:
   - Show the 4-week demand projection based on time-series statistical models (`statsmodels`).
3. **Conclusion & Viva Summary**:
   - *"In summary, Nandana Textile delivers a complete, production-hardened platform covering the full lifecycle from customer browsing and custom sizing to factory floor manufacturing and AI-driven business intelligence."*

---

## 🎯 Anticipated Examiner Questions & Strong Answers

| Examiner Question | Ideal Response |
| :--- | :--- |
| **Q: How do you prevent the AI from making up fake products or prices?** | *"We use a 'Hydrate-and-Validate' pattern. The LLM only receives candidate product IDs retrieved via PostgreSQL full-text search. Before returning the response, our service drops any unverified ID and reads the real price and stock directly from the database."* |
| **Q: How do you prevent inventory overselling during sales spikes?** | *"We use PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) inside atomic database transactions. Even with 100 concurrent requests, conflicting reservations are serialized and rejected once available stock reaches zero."* |
| **Q: What is the single source of truth for stock?** | *"The `inventory_movements` append-only ledger. We have an automated reconciler (`npm run reconcile`) that verifies the ledger math against cache columns on every deployment."* |
| **Q: Is customer data secure from external LLM providers?** | *"Yes. The AI microservice connects using a dedicated read-only database user. No customer PII, phone numbers, or passwords are ever passed into LLM prompt contexts."* |
