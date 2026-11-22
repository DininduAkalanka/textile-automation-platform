# 16_CODING_STANDARDS.md

# Smart Textile Business Management System

**Version:** 1.0.0
**Document Type:** Coding Standards & Best Practices
**Status:** Draft
**Last Updated:** July 2026

---

# 1. Purpose

This document defines the **coding standards, structure rules, and best practices** for the entire system:

* Frontend (Next.js)
* Backend (NestJS)
* AI Service (Python FastAPI)
* Database Layer (PostgreSQL + Prisma)

The goal is to ensure:

* Clean, maintainable code
* Scalable architecture
* Team consistency
* Production-grade quality

---

# 2. General Coding Principles

All developers must follow:

## 2.1 Core Principles

* Keep code **simple and readable**
* Follow **single responsibility principle**
* Avoid duplication (DRY principle)
* Write **self-explanatory code**
* Prefer composition over inheritance

---

## 2.2 Code Quality Rules

* No hardcoded values (use config files)
* No business logic inside UI components
* No direct database calls from controllers
* Always validate inputs
* Always handle errors properly

---

# 3. Naming Conventions

---

## 3.1 General Rules

* Use English only
* Be descriptive, not short
* Avoid abbreviations unless common

---

## 3.2 Frontend (Next.js)

### Files:

* kebab-case

```
product-card.tsx
checkout-page.tsx
```

### Components:

* PascalCase

```
ProductCard
CheckoutPage
```

### Variables:

* camelCase

```
productPrice
userOrderList
```

---

## 3.3 Backend (NestJS)

### Files:

* kebab-case modules

```
products.module.ts
orders.service.ts
```

### Classes:

* PascalCase

```
ProductsService
OrdersController
```

### Methods:

* camelCase

```
createOrder()
getUserOrders()
updateInventory()
```

---

## 3.4 Database (SQL / Prisma)

* table_names → plural snake_case

```
product_categories
order_items
customer_measurements
```

* columns → snake_case

```
created_at
updated_at
user_id
```

---

## 3.5 AI Service (Python)

* snake_case for variables/functions

```
get_product_recommendation()
analyze_sales_trend()
```

* PascalCase for classes

```
RAGEngine
VectorStoreManager
```

---

# 4. Project Folder Structure Rules

---

## 4.1 Frontend Structure (Next.js)

```
/app
/components
/lib
/hooks
/services
/styles
/types
```

### Rules:

* Components must be reusable
* Pages must not contain heavy logic
* API calls must be in /services

---

## 4.2 Backend Structure (NestJS)

```
/src
  /modules
  /auth
  /products
  /orders
  /inventory
  /ai
  /common
```

### Rules:

* Each module = isolated feature
* Business logic stays in service layer
* Controllers only handle requests/responses

---

## 4.3 AI Service Structure

```
/app
  /routes
  /services
  /models
  /rag
  /utils
```

---

# 5. API Design Standards

---

## 5.1 REST Rules

* Use nouns, not verbs

```
GOOD: /api/products
BAD:  /api/getProducts
```

---

## 5.2 HTTP Methods

* GET → fetch data
* POST → create data
* PUT → update full record
* PATCH → partial update
* DELETE → remove

---

## 5.3 Response Format

### Standard API Response:

```json id="api001"
{
  "success": true,
  "message": "Order created successfully",
  "data": {},
  "error": null
}
```

---

## 5.4 Error Response Format

```json id="api002"
{
  "success": false,
  "message": "Invalid payment details",
  "error_code": "PAYMENT_FAILED"
}
```

---

# 6. Frontend Standards

---

## 6.1 Component Rules

* One component = one responsibility
* No API calls inside UI components
* Use hooks for logic separation

---

## 6.2 State Management

* Use Zustand or Redux (light usage only)
* Avoid prop drilling
* Keep global state minimal

---

## 6.3 UI Rules

* Always use design system (shadcn/ui)
* No custom random styling
* Follow UI/UX guidelines strictly

---

# 7. Backend Standards

---

## 7.1 Service Layer Rule

All logic must go through services:

```
Controller → Service → Repository → Database
```

---

## 7.2 Validation

* Use DTO classes
* Use class-validator

---

## 7.3 Error Handling

* Use global exception filters
* Never expose raw system errors

---

# 8. Database Standards

---

## 8.1 Design Rules

* Normalize data (avoid duplication)
* Use foreign keys properly
* Always include created_at, updated_at

---

## 8.2 Query Rules

* Avoid SELECT *
* Use indexed columns
* Optimize joins

---

# 9. AI Service Standards

---

## 9.1 RAG System Rules

* Always retrieve before generating
* Never hallucinate product data
* Always return source-linked answers

---

## 9.2 AI Response Format

```json id="ai001"
{
  "type": "product_recommendation",
  "data": [],
  "confidence": 0.92
}
```

---

## 9.3 Latency Rules

* Max response time: 3 seconds
* Use caching for repeated queries

---

# 10. Security Coding Rules

---

## 10.1 Must Follow

* No secrets in code
* Use environment variables
* Sanitize all inputs
* Validate all requests

---

## 10.2 Authentication Rules

* Use JWT
* Token expiration required
* Refresh token mechanism enabled

---

# 11. Performance Standards

---

## 11.1 Frontend

* Lazy loading for images
* Code splitting enabled
* Avoid unnecessary re-renders

---

## 11.2 Backend

* Use caching (Redis)
* Optimize DB queries
* Avoid blocking operations

---

# 12. Git Standards

---

## 12.1 Branch Naming

```
feature/product-module
fix/payment-bug
hotfix/checkout-error
```

---

## 12.2 Commit Messages

```
feat: add product search API
fix: resolve payment callback issue
refactor: improve order service structure
```

---

# 13. Logging Standards

---

## Types:

* INFO → normal operations
* WARN → unexpected behavior
* ERROR → system failures

---

## Rule:

Never log sensitive data (passwords, tokens, payment info)

---

# 14. Testing Requirement (Code-Level)

Every module must include:

* Unit tests
* Integration tests
* Basic API tests

---

# 15. Code Review Rules

Before merging:

* Code must be reviewed
* No console logs in production
* All tests must pass
* No unused variables

---

# 16. AI-Assisted Development Rule

AI can be used for:

* Code generation
* Debugging
* Optimization suggestions

But:

> Developer must understand and validate all AI-generated code

---

# 17. Conclusion

This coding standard ensures:

* Clean architecture
* Team consistency
* Production-grade scalability
* Maintainable long-term system
* AI-safe development practices

> Good code is not just working code — it is readable, scalable, and predictable
