/**
 * Mock API — simulates a real async backend with latency and configurable failures.
 *
 * Design decisions:
 * - Keeps in-memory order state; updates only on successful submission.
 * - Recalculates the refund amount server-side — never trusts a client total.
 * - Enforces eligibility and idempotency server-side.
 * - Simulates ~800ms average latency (uniform 600–1000ms).
 * - Simulates ~20% random failure rate (configurable via MOCK_FAILURE_RATE).
 */

import { v4 as uuidv4 } from "uuid";
import { RAW_ORDER, rawOrderToOrder } from "../data/order";
import { calculateRefund } from "../domain/calculation";
import {
  isUnitEligible,
  isAddonEligible,
  isDeliveryFeeEligible,
} from "../domain/eligibility";
import type { RawOrder, ItemStatus } from "../domain/types";
import type {
  GetOrderResponse,
  SubmitRefundRequest,
  SubmitRefundResponse,
} from "./types";

// ─── In-memory state ──────────────────────────────────────────────────────────

let currentOrder: RawOrder = structuredClone(RAW_ORDER);

/**
 * Idempotency store: maps a key to the committed response.
 * On retry with the same key the original response is returned immediately,
 * matching real backend behaviour (server committed, client never got the reply).
 */
const idempotencyStore = new Map<string, SubmitRefundResponse>();

/** For testing: reset server state back to the original order. */
export function resetMockState(): void {
  currentOrder = structuredClone(RAW_ORDER);
  idempotencyStore.clear();
}

// ─── Configuration ────────────────────────────────────────────────────────────

/** Override to 0 in tests to disable random failures. */
export let MOCK_FAILURE_RATE = 0.2;

export function setMockFailureRate(rate: number): void {
  MOCK_FAILURE_RATE = rate;
}

// ─── Latency simulation ───────────────────────────────────────────────────────

function simulateLatency(): Promise<void> {
  const ms = 600 + Math.random() * 400; // 600–1000ms
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── GET /orders/:id ──────────────────────────────────────────────────────────

export async function getOrder(_orderId: string): Promise<GetOrderResponse> {
  await simulateLatency();
  return { order: structuredClone(currentOrder) };
}

// ─── POST /orders/:id/refunds ─────────────────────────────────────────────────

export async function submitRefund(
  orderId: string,
  request: SubmitRefundRequest,
): Promise<SubmitRefundResponse> {
  await simulateLatency();

  // 1. Random failure simulation
  if (Math.random() < MOCK_FAILURE_RATE) {
    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "A temporary server error occurred. Please try again.",
    };
  }

  // 2. Order ID sanity check
  if (currentOrder.order_id !== orderId) {
    return {
      success: false,
      code: "INVALID_SELECTION",
      message: `Order ${orderId} not found.`,
    };
  }

  // 3. Idempotency check — replay the committed response on retry
  const stored = idempotencyStore.get(request.idempotencyKey);
  if (stored) {
    // Server already committed this refund; return the original result
    // so the client can treat a timed-out retry as successful.
    return stored;
  }

  // 4. Selection must not be empty
  if (request.selectedUnitIds.length === 0 && !request.includeDeliveryFee) {
    return {
      success: false,
      code: "INVALID_SELECTION",
      message: "Refund selection is empty.",
    };
  }

  // 5. Build domain order and validate each selected unit
  const domainOrder = rawOrderToOrder(currentOrder);

  for (const unitId of request.selectedUnitIds) {
    const unit = domainOrder.units.find((u) => u.unitId === unitId);
    if (!unit) {
      return {
        success: false,
        code: "INVALID_SELECTION",
        message: `Unit ${unitId} not found in order.`,
      };
    }
    if (!isUnitEligible(unit)) {
      return {
        success: false,
        code: "UNIT_ALREADY_REFUNDED",
        message: `Unit ${unitId} has already been refunded.`,
      };
    }

    const selectedAddonIds = request.addonSelections[unitId] ?? [];
    for (const addonId of selectedAddonIds) {
      const addon = unit.addons.find((a) => a.addonId === addonId);
      if (!addon) {
        return {
          success: false,
          code: "INVALID_SELECTION",
          message: `Add-on ${addonId} not found on unit ${unitId}.`,
        };
      }
      if (!isAddonEligible(addon, unit)) {
        return {
          success: false,
          code: "INVALID_SELECTION",
          message: `Add-on ${addonId} on unit ${unitId} is not eligible for refund.`,
        };
      }
    }
  }

  // 6. Delivery fee check
  if (request.includeDeliveryFee && !isDeliveryFeeEligible(domainOrder)) {
    return {
      success: false,
      code: "INVALID_SELECTION",
      message: "Delivery fee is not eligible for refund.",
    };
  }

  // 7. Server-side amount calculation (independent of client total)
  const selection = {
    selectedUnitIds: new Set(request.selectedUnitIds),
    addonSelections: new Map(
      Object.entries(request.addonSelections).map(([k, v]) => [k, new Set(v)]),
    ),
    includeDeliveryFee: request.includeDeliveryFee,
  };
  const calculation = calculateRefund(domainOrder, selection);

  // 8. Apply refund to in-memory state
  const updatedOrder: RawOrder = structuredClone(currentOrder);

  for (const item of updatedOrder.items) {
    for (const unit of item.units) {
      if (request.selectedUnitIds.includes(unit.unit_id)) {
        unit.status = "refunded" as ItemStatus;
        const selectedAddonIds = request.addonSelections[unit.unit_id] ?? [];
        for (const addon of unit.addons) {
          if (selectedAddonIds.includes(addon.addon_id)) {
            addon.status = "refunded" as ItemStatus;
          }
        }
      }
    }
  }

  if (request.includeDeliveryFee) {
    updatedOrder.delivery_fee_status = "refunded";
  }

  // 9. Commit state and store response under idempotency key
  currentOrder = updatedOrder;
  const response: SubmitRefundResponse = {
    success: true,
    refundId: uuidv4(),
    amountSen: calculation.totalSen,
    updatedOrder: structuredClone(currentOrder),
  };
  idempotencyStore.set(request.idempotencyKey, response);
  return response;
}
