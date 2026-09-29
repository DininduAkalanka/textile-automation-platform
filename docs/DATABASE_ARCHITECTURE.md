# Database Architecture Specification (PostgreSQL 16)

> Note: The authoritative, comprehensive database architecture documentation is maintained in the project root:
> **[DATABASE_ARCHITECTURE.md](file:///c:/Users/dinin/OneDrive/Desktop/Nandana%20Textile/Smart-Textile-Business-Management-E-Commerce-Platform-with-AI-Intelligence/DATABASE_ARCHITECTURE.md)**

Please refer to [DATABASE_ARCHITECTURE.md](file:///c:/Users/dinin/OneDrive/Desktop/Nandana%20Textile/Smart-Textile-Business-Management-E-Commerce-Platform-with-AI-Intelligence/DATABASE_ARCHITECTURE.md) for the complete production reference, including:
- High-level Entity Relationship Diagrams (Mermaid ERD)
- Connection Pooling (`DATABASE_URL` vs `DIRECT_URL`)
- Full Schema Dictionary (17 Tables & 9 Enums)
- Double-entry Append-Only Inventory Ledger & Continuous Reconciliation
- Database-enforced CHECK constraints & Race condition prevention
- Weighted Full-Text Search with `tsvector` and GIN index
- AI Read-Only Role (`textile_ai_readonly`) & Sanitized Analytics Views (`ai_sales_facts`, `ai_inventory_facts`)
- Disaster Recovery and Operations Runbook
