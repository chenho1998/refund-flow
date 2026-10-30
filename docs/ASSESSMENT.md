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
    "delivery_fee": 5.0,
    "delivery_fee_status": "paid",
    "items": [
      {
        "line_id": "L1",
        "name": "Iced Spanish Latte",
        "unit_price": 13.9,
        "units": [
          {
            "unit_id": "L1-1",
            "status": "refunded",
            "addons": [
              {
                "addon_id": "A1",
                "name": "Extra Shot",
                "unit_price": 2.0,
                "status": "refunded"
              }
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
  "updatedOrder": {
    /* full order object */
  }
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

4. **"Staff" vs. "customer" context.** The back office is staff-facing, so I optimized for clarity and information density rather than customer-friendly tone.

5. **Success feedback on the order page.** After a successful refund, a timestamped green banner appears at the top of the order page and item statuses update immediately. There is no email or push notification trigger — both are assumed to be handled by a separate backend service.

6. **Close / discard guard.** Closing the refund modal (via the X button, Escape key, or clicking the backdrop) while selections or review details have been entered shows a confirmation dialog before discarding. If nothing has been touched, it closes immediately without interruption.

---

## d) Key Decisions & Trade-offs

**Money as integer minor units**
Floating-point arithmetic on currency is unreliable. Storing all values as integers (sen) and converting only at the display boundary eliminates rounding bugs. The trade-off is that the ingestion layer must convert, but this is a single, tested boundary.

**Flat unit model**
The domain model flattens `items[].units[]` into a single `units[]` array. This makes iteration, selection, and calculation uniform — no nested loops anywhere in the business logic. The original line grouping is only reconstructed for display in the order page and the selection modal.

**Pure calculation function**
`calculateRefund()` is a plain function with no side effects: `(Order, RefundSelection) → RefundCalculation`. This makes it independently testable and also usable by the mock API for server-side verification. The same function covers both the live preview and the server-side amount validation.

**Server recalculates, never trusts client total**
Even in a mock, the API recalculates the amount from the selection. This is the correct production pattern — it prevents a tampered client from inflating a refund.

**Radix UI for accessible dialogs**
Radix primitives provide correct ARIA roles, focus trapping, keyboard dismissal, and screen reader announcements out of the box. This avoids reimplementing accessible dialog behavior from scratch. Three separate Radix Dialog/AlertDialog instances are used: the main refund modal, the confirmation dialog (Step 3), and the discard guard — each with independent open/close state so they can appear and close independently.

**useRefundFlow hook**
All flow state (step, selection, submission status, dirty flag) is colocated in one hook. Components receive only what they need via props. This keeps components focused on presentation and the hook responsible for business logic orchestration.

**Add-on auto-deselect on unit deselect**
When a unit is unchecked, all its add-on selections are cleared. This enforces the rule that add-ons cannot be refunded without their parent unit, and prevents ghost selections from accidentally resurfacing if the unit is re-checked later.

**"Select all" shortcut**
A full refund (all eligible items) is the most common staff action. Rather than requiring staff to tick every row individually, a single "Select all" link at the top of the selection list selects all eligible units, their eligible add-ons, and the delivery fee in one action. "Clear" reverses it. The counter ("3 of 5 selected") gives continuous feedback on coverage.

**Step 2 field validation UX**
The Confirm button is never disabled. Instead, clicking it with missing fields highlights the empty selects in red and shows inline "required" labels. This is more informative than a silently greyed-out button — staff know exactly what's missing rather than trying to guess why the button won't respond.

**Clickable full-width rows in Step 1**
The entire item card is a clickable button, not just the checkbox. This matches natural pointing behaviour — staff click the row, not a 16px target.

---

## e) Known Limitations & Next Steps

**Not handled yet:**

- No real backend. The mock API lives in the browser and resets on page reload.
- No authentication or authorization. In production, the endpoint must verify the staff member's identity and permissions before allowing a refund.
- No optimistic UI updates. The order page reflects the new state only after a confirmed API success response.
- No pagination or order search. The page shows a single hard-coded order.
- No accessibility audit with assistive technology. The keyboard flow and ARIA markup are implemented correctly by construction (Radix) but have not been tested with VoiceOver or NVDA.
- No error boundary. An uncaught render error would crash the entire page.
- The mock failure rate (20%) can produce failures during demos. It can be lowered via `setMockFailureRate(0)` in the source but there is no runtime UI control for it.

**Next steps with more time:**

1. Replace the mock API with a real HTTP client (e.g. `fetch` with a typed wrapper, or React Query / TanStack Query for caching and background refetches).
2. Add a React error boundary around the order page so a render failure shows a recovery UI rather than a blank screen.
3. Add end-to-end tests with Playwright covering: happy path full refund, partial refund, failure + retry, cancel mid-flow (discard guard), and the "all items already refunded" state.
4. Audit with VoiceOver / NVDA to verify that the modal, checkbox, and select flows are fully operable by screen reader users.
5. Consider optimistic updates — mark items as pending immediately on submit, roll back on error.
6. Add rate limiting and proper auth headers (e.g. Bearer token, CSRF) to the real API layer.
7. Persist draft selection to `sessionStorage` so a page refresh mid-flow doesn't silently discard work.
