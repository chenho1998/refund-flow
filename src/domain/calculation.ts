import type { Order, RefundSelection, RefundCalculation, RefundLineItem } from './types'
import { isUnitEligible, isAddonEligible, isDeliveryFeeEligible } from './eligibility'

/**
 * Pure function: compute the itemized refund amount for a given selection.
 *
 * Rules enforced here (mirrors the mock API validation):
 * - Only eligible (paid) units can be included.
 * - Add-ons are only counted when their parent unit is also selected.
 * - An add-on that itself is ineligible is skipped even if the unit is selected.
 * - Delivery fee is only included when the order has an eligible delivery fee.
 *
 * Returns a RefundCalculation with an itemized breakdown and integer totalSen.
 */
export function calculateRefund(
  order: Order,
  selection: RefundSelection,
): RefundCalculation {
  const lines: RefundLineItem[] = []

  for (const unit of order.units) {
    if (!selection.selectedUnitIds.has(unit.unitId)) continue
    if (!isUnitEligible(unit)) continue   // defensive: skip ineligible even if selected

    const selectedAddonIds = selection.addonSelections.get(unit.unitId) ?? new Set<string>()

    const selectedAddons = unit.addons
      .filter(
        (addon) =>
          selectedAddonIds.has(addon.addonId) &&
          isAddonEligible(addon, unit),
      )
      .map((addon) => ({
        addonId: addon.addonId,
        name: addon.name,
        priceSen: addon.unitPriceSen,
      }))

    const addonTotal = selectedAddons.reduce((sum, a) => sum + a.priceSen, 0)
    const subtotalSen = unit.unitPriceSen + addonTotal

    lines.push({
      unitId: unit.unitId,
      lineName: unit.lineName,
      unitPriceSen: unit.unitPriceSen,
      selectedAddons,
      subtotalSen,
    })
  }

  const deliveryFeeSen =
    selection.includeDeliveryFee && isDeliveryFeeEligible(order)
      ? order.deliveryFeeSen
      : 0

  const totalSen = lines.reduce((sum, l) => sum + l.subtotalSen, 0) + deliveryFeeSen

  return { lines, deliveryFeeSen, totalSen }
}
