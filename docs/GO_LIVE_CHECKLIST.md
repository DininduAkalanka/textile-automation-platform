# Go-live Checklist

Everything to finish before the shop opens to real customers, and in the first weeks after. For the developer and the shop owner together.

Ticked items are done. Status as of 23 November 2026. Technical steps are explained in the [Runbook](RUNBOOK.md), day-to-day use in the [Admin guide](ADMIN_GUIDE.md). Back to the [project README](../README.md).

**Order of work:** finish sections 1–7, run the data reset (section 2) when the owner says go, add the real catalogue and workers, then do the final checks (section 8).

---

## 1. Accounts and ownership

- [x] The owner's email is the shop's only active admin account, and the demo accounts are deactivated (Runbook, [section 8](RUNBOOK.md#8-accounts-admin-workers-and-demo-accounts)). *Developer*
- [ ] The owner has set their own admin password (at least 12 characters) with "Forgot password?" and signed in. *Owner*
- [ ] `ADMIN_ALERT_EMAIL` on the API is the owner's inbox, so new-order and refund alerts reach them. *Developer*
- [ ] It is agreed who owns each service account (domain registrar, Vercel, Render, Neon, Cloudinary, Resend, PayHere, Groq, GitHub), and the owner has access to the ones they own. *Both*
- [ ] Two-step verification is on for every one of those accounts and for the email inboxes behind them. *Both*

## 2. Data

- [ ] A Neon backup branch is created just before the reset (Runbook, [section 4](RUNBOOK.md#4-backups-and-restore)). *Developer*
- [ ] The demonstration products, orders, reviews and test accounts are removed (Runbook, [section 9](RUNBOOK.md#9-go-live-data-reset)). Never use `npm run db:clean-reset` or the seed scripts on the live database. *Developer, when the owner says go*
- [ ] Optional: the demonstration photos are deleted from the Cloudinary folder `nandana-uploads`. *Developer*
- [ ] The real workers are added **after** the reset (Runbook, [section 8.3](RUNBOOK.md#83-add-a-worker)). *Developer*

## 3. Catalogue and content

- [ ] The real products are added with the shop's own photos, prices, cost prices, sizes and stock (Admin guide, [section 6](ADMIN_GUIDE.md#6-products)). Uniform, custom and measured products have the right **Type** and **Requires measurements** setting, so their orders reach the tailoring floor. *Owner*
- [ ] The categories match what the shop sells. *Owner*
- [ ] No demonstration photos remain. Most of them are loaded from another shop's servers (`cdn.shopify.com`) and must not appear on the live shop. *Owner*
- [ ] The shop owns, or has permission to use, every other image on the site, such as the home page banners. *Owner*
- [ ] The shop's details are correct everywhere: address, phone and WhatsApp numbers, `info@nandanatextile.lk`, and the opening hours. The website and the Google Business Profile currently show **different opening hours**: decide the real ones and make both agree. *Owner*
- [ ] The returns and exchange, shipping, privacy and terms pages are read and approved. *Owner*
- [ ] Every promise on the site is true, for example "since 2009", same-day delivery, the gift box price and the 7-day exchange. *Owner*
- [ ] The invoice and caption details on the API are correct: `SHOP_ADDRESS`, `SHOP_LANDLINE`, `SHOP_WHATSAPP`, `SHOP_REG_NO`, `SHOP_BANK`, and `SHOP_PAYMENTS` lists only payment options the shop really offers. *Developer*

## 4. Payments

- [ ] **Decision:** card payments through PayHere from day one, or cash on delivery only at first. *Owner*
- [ ] **If card payments:** the PayHere live merchant account is approved for `www.nandanatextile.lk`; the live merchant ID and secret are set on the API with `PAYHERE_MODE=live`; one real low-value payment is made and refunded. *Developer*
- [ ] **If cash on delivery only:** the card and instalment options are switched off at checkout before launch. This needs a small code change; there is no setting for it yet. *Developer*
- [ ] PayHere must **never** stay in `sandbox` mode while real customers can choose card payment: in sandbox, a test card "pays" and the order is marked paid with no money received. *Developer*
- [ ] It is agreed who issues refunds and how (PayHere merchant portal or bank transfer). Cancelling an order in the admin does not refund the customer. *Owner*

## 5. Email and SMS

- [x] Emails are sent from the domain verified in Resend, and verification codes and password resets reach customers. *Developer*
- [ ] Optional: a Sri Lankan SMS gateway (Notify.lk or Text.lk) is contracted, if customers should be able to verify by phone or receive SMS. *Owner*

## 6. Hosting and reliability

- [x] Product and review photos are stored in Cloudinary. *Developer*
- [ ] The API and AI service no longer go to sleep: either the cron-job.org keep-alive is set up (Runbook, [section 7](RUNBOOK.md#7-keeping-the-render-free-services-awake)), or the API runs on a paid Render instance. A paid instance is recommended once real orders arrive, because a sleeping API makes the first customer of the day wait up to a minute. *Developer, with the owner's approval for any cost*
- [ ] The Neon plan's restore window is known, and the backup routine is agreed (Runbook, [section 4](RUNBOOK.md#4-backups-and-restore)). *Developer*

## 7. Search and discovery

- [x] Canonical addresses, the sitemap, robots.txt, structured data and the favicon are live on `https://www.nandanatextile.lk`. Google can take a few days to show the new favicon in search results. *Developer*
- [ ] Google Search Console: the domain is verified, `https://www.nandanatextile.lk/sitemap.xml` is submitted, and indexing of the home page is requested. *Both*
- [ ] The Google Business Profile links to `https://www.nandanatextile.lk`, and its hours match the website. *Owner*
- [ ] The shop's Facebook and Instagram pages link to the website. *Owner*

## 8. Final checks on the live shop

After the reset, with the real catalogue in place:

- [ ] The owner signs in to the admin, and the dashboard loads.
- [ ] A new customer account registered with a real email receives its verification code.
- [ ] "Forgot password?" sends an email whose link works.
- [ ] A cash-on-delivery order for a real product sends the customer a confirmation and the owner a new-order alert. Cancel it from the admin afterwards, and check that its stock returns.
- [ ] If card payments are on: one real low-value card payment confirms the order automatically. Refund it in PayHere and cancel the order.
- [ ] An order for a uniform or made-to-measure product creates a task on the production board, and an assigned worker can start it from their phone. Cancel the order before the work starts.
- [ ] The shop works on an iPhone and an Android phone: menu, search, product page, cart and checkout.
- [ ] The AI shopping assistant answers on the shop, and AI Insights answers in the admin.

Cancelled test orders stay in the order list as cancelled and are not counted as revenue.

## 9. After launch

- [ ] Every day: check new orders, payments and the production board (Admin guide, [section 2](ADMIN_GUIDE.md#2-a-daily-routine)). *Owner*
- [ ] After the first week: check Render's free-hour usage, the Resend logs, and Cloudinary and Neon usage. *Developer*
- [ ] After about a week: delete the Neon backup branch made before the reset. *Developer*
- [ ] After two to three weeks: check in Search Console that the pages are indexed and that there are no errors. *Developer*
