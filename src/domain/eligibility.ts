import type { Unit, Addon, Order } from './types'

/**
 * A unit is eligible for refund only if its unit-level status is "paid".
 * The add-on statuses are intentionally ignored here — unit status is
 * authoritative (handles the L2-2 inconsistency in the supplied order data).
 */
export function isUnitEligible(unit: Unit): boolean {
  return unit.status === 'paid'
}

/**
 * An add-on is eligible only when:
 * 1. Its parent unit is eligible (paid), AND
 * 2. The unit is selected for refund (enforced separately in UI / calculation)
 *
 * Note: we do NOT check the add-on's own status field here because the
 * supplied data has a known inconsistency (L2-2 unit is refunded but its
 * add-ons show "paid"). The unit-level status is always authoritative.
 */
export function isAddonEligible(addon: Addon, parentUnit: Unit): boolean {
  return isUnitEligible(parentUnit) && addon.status === 'paid'
}

/**
 * Returns true if the order has an eligible (not-yet-refunded) delivery fee.
 */
export function isDeliveryFeeEligible(order: Order): boolean {
  return order.deliveryFeeStatus === 'paid' && order.deliveryFeeSen > 0
}

/**
 * Returns the count of eligible (refundable) units in the order.
 */
export function eligibleUnitCount(order: Order): number {
  return order.units.filter(isUnitEligible).length
}
