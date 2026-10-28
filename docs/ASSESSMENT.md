# Assessment — Written Section

## a) API Endpoints

This flow needs two endpoints.

---

### `GET /orders/:orderId`

Fetches the current order state, including updated refund statuses after a refund is processed.

**Response `200 OK`:**
```json
{
  "order": {
    "order_id": "ORD-10482",
    "status": "completed",
    "currency": "MYR",
    "delivery_fee": 5.00,
    "delivery_fee_status": "paid",
    "items": [
      {
        "line_id": "L1",
        "name": "Iced Spanish Latte",
        "unit_price": 13.90,
        "units": [
          {
            "unit_id": "L1-1",
            "status": "refunded",
            "addons": [
              { "addon_id": "A1", "name": "Extra Shot", "unit_price": 2.00, "status": "refunded" }
            ]
          }
        ]
      }
    ]
  }
}
```

**Response `404 Not Found`:** Order not found.

---

### `POST /orders/:orderId/refunds`

Submits a refund request.

**Request body:**
```json
{
  "idempotencyKey": "uuid-v4",
  "selectedUnitIds": ["L1-2", "L2-1"],
  "addonSelections": {
    "L1-2": ["A1"],
    "L2-1": ["A2", "A3"]
  },
  "includeDeliveryFee": false,
  "reason": "Wrong item",
  "channel": "Original payment method"
}
```

**Response `200 OK` (success):**
```json
{
  "success": true,
  "refundId": "uuid-v4",
  "amountSen": 2930,
  "updatedOrder": { /* full order object */ }
}
```

**Response `200 OK` (failure):**
```json
{
  "success": false,
  "code": "UNIT_ALREADY_REFUNDED",
  "message": "Unit L1-1 has already been refunded."
}
```

Possible error codes: `DUPLICATE_REQUEST`, `UNIT_ALREADY_REFUNDED`, `INVALID_SELECTION`, `INTERNAL_ERROR`.

---

## b) Refund Calculation

**Where it lives:** Calculated on the **frontend** for live preview (Step 1 total updates as staff select items), then **recalculated independently on the server** before committing.

**How amounts stay in sync:** The client never sends a total. It sends a selection (unit IDs + add-on IDs + delivery flag). The server runs the same pure `calculateRefund()` function on its own copy of the order. The `amountSen` in the success response is the server-computed value — if there were a discrepancy (due to a race condition or client bug), the server amount wins and the UI updates to match.

**Financial precision:** All amounts are stored and computed as integer minor units (sen). The raw JSON uses decimal MYR; conversion happens once at the data boundary via `Math.round(myr * 100)` to avoid floating-point drift. The only place decimals appear is the formatted display string.

---

## c) Assumptions, Questions & Comments for the PM or Designer

1. **Delivery fee is all-or-nothing.** The spec says staff "can choose whether to refund it" but does not mention partial delivery fee refunds. I assumed binary: either refund the full delivery fee or none of it. **Q: Is there ever a case for refunding part of the delivery fee?**

2. **Unit-level status is authoritative.** The supplied order data has an inconsistency: unit `L2-2` is `refunded` but its add-ons still show `paid`. I treat the unit status as the ground truth and disable the entire unit (including its add-ons). **Q: Is this the intended behavior, or should inconsistent add-ons be selectable?**

3. **No partial unit refund.** Each unit is either refunded in full (including all selected add-ons) or not at all. There is no concept of "refund 50% of a unit." I assumed this is correct.

4. **Idempotency key is client-generated.** A UUID is generated per submission attempt. If the network times out and the staff retries, a new key is generated so the retry is treated as a fresh request — which is safe because the server will also reject duplicate submissions via the idempotency store. **Q: Should a timed-out submission be retried with the same key (exactly-once), or is generating a new key on retry acceptable?**

5. **"Staff" vs. "customer" context.** The back office is staff-facing, so I optimized for clarity and information density rather than customer-friendly tone.

6. **No confirmation of refund amount on the order page.** After a successful refund, the order page shows updated statuses. There is no success toast or email trigger — both were out of scope. **Q: Should a success notification be shown?**

7. **All add-ons per unit share the same product `addon_id` (e.g. A1, A2, A3) across units.** I scope add-on selections by `unitId + addonId` to avoid cross-unit contamination.

---

## d) Key Decisions & Trade-offs

**Money as integer minor units**
Floating-point arithmetic on currency is unreliable. Storing all values as integers (sen) and converting only at the display boundary eliminates rounding bugs. The trade-off is that the ingestion layer must convert, but this is a single, tested boundary.

**Flat unit model**
The domain model flattens `items[].units[]` into a single `units[]` array. This makes iteration, selection, and calculation uniform — no nested loops anywhere in the business logic. The original line grouping is only reconstructed for display.

**Pure calculation function**
`calculateRefund()` is a plain function with no side effects: `(Order, RefundSelection) → RefundCalculation`. This makes it independently testable and also usable by the mock API for server-side verification. The same function covers both the live preview and the server-side amount validation.

**Server recalculates, never trusts client total**
Even in a mock, the API recalculates the amount from the selection. This is the correct production pattern — it prevents a tampered client from inflating a refund.

**Radix UI for accessible dialogs**
Radix primitives provide correct ARIA roles, focus trapping, keyboard dismissal, and screen reader announcements out of the box. This avoids reimplementing accessible dialog behavior from scratch.

**useRefundFlow hook**
All flow state (step, selection, submission status) is colocated in one hook. Components receive only what they need via props. This keeps components focused on presentation and the hook responsible for business logic orchestration.

**Add-on auto-deselect on unit deselect**
When a unit is unchecked, all its add-on selections are cleared. This enforces the rule that add-ons cannot be refunded without their parent unit, and prevents ghost selections from accidentally resurfacing.

---

## e) Known Limitations & Next Steps

**Not handled yet:**
- No real backend. The mock API lives in the browser and resets on page reload.
- No authentication or authorization. In production, the endpoint must verify the staff member's identity and permissions.
- No optimistic UI updates. The order page reloads its state only after a confirmed API success.
- No pagination or search. The order page shows a single hard-coded order.
- No accessibility audit. The keyboard flow and ARIA markup are implemented correctly by construction (Radix) but have not been tested with a screen reader.
- No error boundary. An uncaught render error would crash the entire page.
- The mock failure rate (20%) can produce failures during demos; it can be lowered via `setMockFailureRate(0)` but there is no UI control for it.

**Next steps with more time:**
1. Replace the mock API with a real HTTP client (e.g. `fetch` with a typed wrapper or React Query).
2. Add an error boundary around the order page.
3. Add an end-to-end test with Playwright covering the happy path and the failure/retry path.
4. Add a success toast after a completed refund.
5. Consider optimistic updates so the UI reflects the refund immediately, with a rollback on error.
6. Audit with VoiceOver / NVDA to verify the modal and checkbox flows are fully accessible.
7. Add rate limiting and proper auth headers to the real API layer.
