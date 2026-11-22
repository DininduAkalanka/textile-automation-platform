# Admin Guide

How to run the Nandana Textile online shop day to day: orders, the tailoring floor, products, stock, payments, reviews and reports.

For the shop owner and staff. Developers and technical set-up: see the [Runbook](RUNBOOK.md). Back to the [project README](../README.md).

## Contents

1. [Signing in and your account](#1-signing-in-and-your-account)
2. [A daily routine](#2-a-daily-routine)
3. [Dashboard](#3-dashboard)
4. [Orders](#4-orders)
5. [Production (tailoring floor)](#5-production-tailoring-floor)
6. [Products](#6-products)
7. [Categories](#7-categories)
8. [Inventory (stock)](#8-inventory-stock)
9. [Payments and instalments](#9-payments-and-instalments)
10. [Reviews](#10-reviews)
11. [Analytics and AI Insights](#11-analytics-and-ai-insights)
12. [Reports](#12-reports)
13. [Notifications](#13-notifications)
14. [Staff accounts](#14-staff-accounts)
15. [Getting help](#15-getting-help)

---

## 1. Signing in and your account

- Open [www.nandanatextile.lk](https://www.nandanatextile.lk) and choose **Sign in**. An admin account goes straight to the admin area.
- **Forgot your password?** On the sign-in page choose **Forgot password?** and enter your email. Open the link in the email within 15 minutes and choose a new password of at least 12 characters.
- **Change your password or your name:** choose **Change password** at the bottom of the admin sidebar. The same page lets you correct your first and last name.
- **Locked out?** After 5 wrong passwords the account is locked for 15 minutes. Wait, or use **Forgot password?**, which also unlocks it.
- **Keep the admin account to yourself.** Never share its password; every worker gets their own account (section 14).

> While the shop runs on free hosting, the first page you open after a quiet period can take up to a minute to load while the server wakes up. After that it is fast.

## 2. A daily routine

1. **Dashboard:** check new paid orders, orders awaiting payment and low-stock items.
2. **Orders:** send out ready orders, and mark them delivered when they arrive.
3. **Production:** give every new tailoring task to a worker.
4. **Payments:** mark cash on delivery as collected when the courier pays you, and record instalments paid in the shop.
5. **Inventory:** reorder anything that is low.
6. **Reviews:** look at reviews that customers have reported.

## 3. Dashboard

The first page of the admin area.

| Card | Shows |
| :--- | :--- |
| Revenue | Money received, compared with the previous 30 days |
| Paid orders | Orders that have been paid, compared with the previous 30 days |
| Awaiting payment | Orders placed but not yet paid |
| Low stock | Products at or below their reorder level |

Below the cards: a revenue chart, top products and the most recent orders. Click an order to open it.

## 4. Orders

**Orders** lists every order. Search by order number, customer name or email, or filter by status and payment method, then click an order to see its items, the customer's details and measurements, the payment, and its full history.

### What each status means

| Status | Meaning |
| :--- | :--- |
| Pending | Placed but not paid yet. A card order that is not paid within 30 minutes is cancelled automatically, and its stock goes back on sale. |
| Confirmed | Paid by card, or placed as cash on delivery. Its stock has been taken off the shelf. |
| In production | The tailoring team is working on it (section 5). |
| Quality check | Its garments are at the final inspection. |
| Completed | Ready to send to the customer. |
| Delivered | The customer has received it. |
| Cancelled | Stopped. Its stock has gone back on sale. |

### How an order is confirmed

- **Card payment (PayHere):** automatically, as soon as PayHere confirms the payment. You do not need to do anything.
- **Cash on delivery:** automatically, when the customer places it. When the courier brings you the money, press **Mark cash collected** on the order (or **Mark Collected** on the Payments page).
- **Instalments:** automatically, when the customer pays the first instalment by card at checkout.
- **Any other payment** (for example a bank transfer for a pending order): press **Confirm order** only after you have checked that the money really arrived.

### Sending an order

- **Orders without tailoring work** (ready-made items, fabric, accessories): when the parcel is ready to go, press **Mark fulfilled**. When the customer has received it, press **Mark delivered**.
- **Orders with tailoring work** (uniforms, custom items, anything that needs measurements) move forward by themselves as the production board progresses, and become **Completed** when every garment has passed quality check. Then press **Mark delivered** when the customer has it.

**Mark delivered** sends the customer a message, and lets them review what they bought.

### Cancelling an order

- An order can be cancelled only while it is **Pending** or **Confirmed**, before the tailors start on it.
- Its stock goes back on sale automatically.
- **If the customer has already paid**, you must tick the box confirming that you will refund them. Cancelling does **not** send the money back: refund it yourself through the PayHere merchant portal or your bank.

Every button asks you to confirm and lets you add a note. The order's history records who did what and when.

**Invoice PDF** on the order page downloads the invoice. Customers can download theirs from their own account.

## 5. Production (tailoring floor)

**Production** shows the tailoring work as a board with four columns: **Cutting → Stitching → Finishing → Quality check**.

- When an order with uniforms, custom items or measured items is confirmed, each of those items becomes a **task** in Cutting. (Three identical shirts on one order line are one task.)
- **Open a task** to see the item, the customer's measurements and the order.
- **Assign a worker:** in the task, choose a name under **Assigned worker**. A task cannot be started until someone is assigned, and it cannot be reassigned while work on it is in progress.

The buttons on a task:

| Button | Meaning |
| :--- | :--- |
| Start | Work on this stage has begun |
| Mark complete | This stage is done |
| Send to next stage | Move it to the next column (the same worker stays assigned; change it if someone else does the next stage) |
| Pass QC | At quality check: the garment is good |
| Fail QC | At quality check: something must be fixed. Write exactly what (for example "Left sleeve 2 cm short"); the task goes back to Finishing. |

When every task of an order has passed quality check, the order becomes **Completed** by itself.

**Workers** use the same buttons on their own phone or computer, in the worker portal, where they see only the tasks assigned to them. See section 14 to add a worker.

## 6. Products

**Products** lists the catalogue. Search by name, SKU or description, or filter by category, type, **Low stock** or **Archived**.

### Adding a product

Press **New product**. The form has two steps.

**Step 1: Basics**

| Field | What to enter |
| :--- | :--- |
| Name | What customers see, for example "Corporate Executive Blazer" |
| SKU | Your own unique product code, for example "UNI-COR-001" |
| Price (LKR) | The selling price |
| Cost price | What the product costs you. **Customers never see it**; it is used for your profit margin, which the form shows as you type. |
| Category | Where it appears in the shop |
| Type | Fabric, Ready-made, Uniform, Custom or Accessory (see below) |
| Requires measurements | Tick it when customers must give their measurements for this product |
| Fabric type, Color, Unit | For example "Cotton twill", "Navy", "piece" or "metre" |
| Available Sizes | For example "S, M, L, XL"; then enter the stock for each size |
| Description | Details, care instructions, what it is for |
| Opening Stock | How many you have now (filled in for you when you enter stock per size) |

**Why the type matters:** orders for **Uniform** and **Custom** products, and for any product with **Requires measurements** ticked, go to the production board. Ready-made, Fabric and Accessory orders are simply packed and sent.

Press **Next: Media**.

**Step 2: Media.** Add photos: JPEG, PNG or WebP, up to 2 MB each. Use clear, well-lit photos on a plain background. Then press **Create product**. It appears in the shop straight away.

### Changing a product

- **Edit** (the pencil): change any detail. Changing the **Stock Quantity** here is recorded in the stock history as a correction.
- **Share:** a ready-made caption to copy, and buttons for WhatsApp, Facebook and Instagram.
- **Archive** (in the ⋮ menu): hides the product from the shop without losing anything. Find it again with the **Archived** filter and restore it at any time. Use this for products you no longer sell.
- **Delete permanently** is possible only for a product that has never been ordered. A product that appears in past orders can only be archived, so that those orders, their invoices and your reports stay correct.

## 7. Categories

**Categories** sets up the shop's menu.

- Add a category with a **Name**, an optional **Description** and **Image URL**, and a **Parent** if it is a sub-category (for example "School Uniforms" under "Uniforms").
- A category can be deleted only when it is empty: no products and no sub-categories. Move or archive its products first.

## 8. Inventory (stock)

**Inventory** shows the stock of every product:

| Column | Meaning |
| :--- | :--- |
| Available | On the shelf |
| Reserved | Held for orders that are placed but not yet paid |
| Sellable | What customers can still buy |

**LOW** means at or below the reorder level; **OUT** means none left. The sidebar shows how many products need attention.

**Adjust stock** with a reason:

| Reason | When |
| :--- | :--- |
| Stock received | A delivery arrived from a supplier |
| Correction | A stock count disagreed with the system (up or down) |
| Damage / write-off | Stock can no longer be sold. Always add a note explaining why. |

For a product with sizes, choose the size, or **All Sizes / Aggregate**.

**Reorder level** ("Reorder at"): set the number at which a product counts as low and you get a low-stock alert.

Every stock change is kept in the product's history with who made it and why, and cannot be erased. Orders and cancellations change stock automatically; adjust by hand only for deliveries, counts and damage.

## 9. Payments and instalments

**Payments** lists every payment. Filter by **All**, **Pending**, **Completed**, **Failed** or **Installments**.

- **Mark Collected:** a cash-on-delivery payment has been received.
- **Mark Paid:** a pending payment has been received some other way. Use it only after checking that the money arrived.
- **Reject:** the payment is not valid (for example a fake bank slip). The customer is told. The order stays open with its stock held: cancel the order as well if it should not go ahead.

### Instalments

Customers can pay in **3 monthly instalments**. The first is paid by card at checkout; after that, customers pay each instalment online from their account when it is due.

- **View Installment Schedule** shows each instalment, its due date and whether it is paid. Overdue ones are marked **OVERDUE**.
- If a customer pays an instalment in the shop or by bank transfer, press **Mark received** next to it.

### "Refund needed" alerts

If a card payment arrives for an order that was already cancelled (for example, paid after the 30 minutes ran out), you receive a **Refund needed** alert and an email. That money is not counted as revenue. Refund the customer, or contact them and place the order again.

## 10. Reviews

Only customers whose order has been **delivered** can review what they bought, so every review comes from a real purchase. Reviews are published straight away.

- **Hide review** removes it from the shop; **Unhide review** brings it back.
- **Delete review** removes it for good.
- **Reported only** shows reviews that customers have flagged, with their reasons.

Hide reviews that are offensive or contain personal details. Do not hide honest negative reviews: replying to them by improving the service builds more trust.

## 11. Analytics and AI Insights

**Analytics** is calculated from the shop's real sales:

- **Best sellers:** your star products by revenue.
- **Trending up** and **Cooling down:** compared with the previous 30 days.
- **Reorder before you run out:** stock that will not last, with how much is likely to sell in the next 4 weeks.
- **Frequently bought together:** products often bought in the same order.

The figures become reliable after a few weeks of real sales.

**AI Insights** answers questions about the business in plain words, for example "How is business this month?", "What should I restock?" or "Which products are most profitable?". Answers use only the shop's own figures. An answer marked **Unverified** contains a number the system could not check: confirm it in Reports before acting on it.

If Analytics or AI Insights says "not available", the AI server is waking up: wait a minute and refresh.

## 12. Reports

**Reports** downloads spreadsheets (CSV files that open in Excel or Google Sheets):

- **Sales report:** units sold and revenue per product, from paid orders only, between the dates you choose.
- **Inventory report:** the current stock of every product: available, reserved, sellable, and whether it is low.

Choose the dates where asked and press **Download CSV**.

## 13. Notifications

The bell at the top shows alerts: new orders, low stock, payments that need attention and refunds needed. Click one to open the order or product it is about. Important alerts are also emailed to the shop's alert address (set up by the developer).

## 14. Staff accounts

The admin area has no staff screen yet, so staff accounts are set up by the developer:

1. **Adding a worker:** the worker registers a normal account on the shop with their own email and password. Send the developer their email and their stage (cutting, stitching, finishing or quality check). Once the developer has turned it into a worker account, the worker signs out and in again, sees the worker portal, and appears under **Assigned worker** on the production board.
2. **Removing a worker:** reassign their unfinished tasks first, then ask the developer to deactivate the account. It stops working at once, and its history is kept.

Each person must use their own account, so the history shows who did each job.

## 15. Getting help

When something does not work, send the developer:

- what you were doing, and the order number or product name;
- the exact message on the screen (a screenshot is best);
- the date and time it happened.

Never send passwords, and never share the admin password with anyone, including the developer.
