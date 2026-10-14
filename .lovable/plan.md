# Wallet Implementation

## Goal
Deliver a secure, closed-loop patient wallet in Sanari.ai, integrated with existing accounts, consultation bookings, pharmacy orders, and Supabase. NGN only; no transfers, withdrawals, or external spending.

## Current state (inspection complete)
- [x] Confirmed React/Vite app, existing Supabase auth, patient dashboard, and shared UI patterns.
- [x] Found the existing `wallets` table with naira-denominated numeric balance and escrow balance; signup creates a wallet.
- [x] Found pharmacy checkout deducting wallet funds and moving them into escrow; consultation records already carry payment/escrow fields.
- [x] Identified that wallet funding, a transaction history/ledger, verified deposit webhooks, wallet refunds, and reconciliation are not present in the inspected flows.
- [x] Identified a security gap to address: current wallet RLS includes patient self-update/self-insert policies, while wallet balance changes need trusted server-side control.
- [x] Checked payment configuration: no provider integration or provider credential names were found in the inspected project files. Real-money funding must wait for an approved, configured provider and confirmation that its arrangement supports this use.

## Implementation checklist

### Phase 1 — Safe database foundation
- [ ] Confirm the live wallet schema, grants, RLS policies, constraints, and existing production balances before changing data.
- [ ] Design a backwards-compatible NGN integer-kobo ledger, wallet/deposit/transaction records, idempotency constraints, and balanced accounting entries; retain existing wallet and escrow behavior during transition.
- [ ] Apply an incremental migration through the Supabase migration workflow, with explicit table grants, strict RLS, immutable posted entries, and server-only balance-changing operations.
- [ ] Reconcile existing wallet balances into the new accounting model without losing or inventing funds; document any exceptions for review.

### Phase 2 — Trusted wallet operations
- [ ] Add atomic, concurrency-safe database operations for verified deposits, wallet purchases, reversals/refunds, and idempotency.
- [ ] Secure pharmacy checkout so server-side pricing, stock, wallet balance, order updates, and accounting entries commit together.
- [ ] Integrate consultation payments only where the existing booking/payment lifecycle supports a verified, atomic wallet charge; preserve escrow and separate merchant settlement from patient accounting.
- [ ] Add authenticated balance and paginated transaction-history endpoints that only return the current patient’s records.

### Phase 3 — Deposits and payment provider
- [ ] Select and validate an approved payment provider for this closed-loop wallet; configure required server-side secrets and sandbox mode.
- [ ] Implement a provider adapter, pending deposit creation, signature-verified webhook processing, provider-side verification where supported, and status checks.
- [ ] Ensure deposits credit only after verified payment, once only; handle duplicates, amount/currency mismatches, failures, retries, and pending status safely.
- [ ] Keep a mock adapter limited to non-production automated tests if a real provider is not yet approved; never present mock funds as real.

### Phase 4 — Patient wallet experience
- [ ] Build a responsive wallet view with verified NGN balance, escrow visibility where useful, recent transactions, loading/error/empty states, and closed-loop disclosure.
- [ ] Add a deposit flow with amount/limit validation, accurate provider fees and totals, hosted checkout, pending/success/failure/cancel states, and reference-based status refresh.
- [ ] Add complete transaction history with references, status/type/date filters, related order or consultation references, and incremental pagination.
- [ ] Integrate full-balance-only wallet payment into eligible pharmacy and consultation checkouts; reject insufficient balances and do not enable partial payment.
- [ ] Surface authoritative in-app notifications for confirmed deposit, payment, refund, or failure without duplicates.

### Phase 5 — Refunds, administration, and reconciliation
- [ ] Add restricted, audited refund review and processing tied to eligible original purchases; prevent duplicate or excessive refunds.
- [ ] Add least-privilege admin visibility for wallet status, transactions, pending/disputed deposits, audit history, and reconciliation issues; never allow direct balance editing.
- [ ] Add a reconciliation workflow for ledger/provider/custody discrepancies, using documented provider reports or a secure administrative import rather than assumed APIs.
- [ ] Define and present accurate terms for fees, refunds, disputes, and suspended/closed wallet balances; obtain legal/provider confirmation before making safeguarding or redemption claims.

### Phase 6 — Verification and release readiness
- [ ] Test ledger balance, duplicate webhooks, invalid signatures, failed/mismatched/unsupported payments, ownership/RLS, forbidden client edits, and suspended wallets.
- [ ] Test insufficient and concurrent purchases, duplicate charges/refunds, atomic rollback, correct escrow/order state, and reconciliation discrepancy detection at database level.
- [ ] Test patient pending/success/failure/refund displays and existing signup, booking, pharmacy checkout, and dashboard regressions.
- [ ] Run project security checks and end-to-end tests; document migrations, functions, policies, configured provider/environment, required secrets, and outstanding approvals.
- [ ] Keep live funding disabled until provider approval/configuration, custody and settlement review, legal/regulatory review, reconciliation, and security tests are complete.

## Dependencies and decisions needed before live funding
- Payment provider account/integration and required server-side credentials are not currently configured in the inspected project files.
- Provider confirmation is needed that the account and settlement arrangement may support this wallet model; legal/regulatory and custody review is required before real-money activation.
- Fee rules, funding limits, refund eligibility, suspended/closed-wallet treatment, dispute contacts, and final wallet terms need confirmed business/provider values before they are shown as definitive.

## Technical notes
- Reuse the existing Supabase identity and `wallets` rather than creating patient accounts or an unrelated parallel checkout.
- Use database migrations for schema/RLS updates and trusted Edge Functions/database transactions for payment verification and balance changes; never trust browser redirects or client-supplied balances/totals.
- Keep all amounts in integer kobo for new ledger operations, with NGN as the only enabled currency. Preserve existing data through a reviewed migration/reconciliation.
- No production-ready or live-payment claim until provider, custody, security, reconciliation, and legal gates pass.
