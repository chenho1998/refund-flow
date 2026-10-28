import type { RawOrder, Order } from '../domain/types'
import { toMinorUnits } from '../domain/money'

/** Raw JSON from the assessment — shapes exactly match the provided data. */
export const RAW_ORDER: RawOrder = {
  order_id: 'ORD-10482',
  status: 'completed',
  currency: 'MYR',
  delivery_fee: 5.0,
  delivery_fee_status: 'paid',
  items: [
    {
      line_id: 'L1',
      name: 'Iced Spanish Latte',
      unit_price: 13.9,
      units: [
        {
          unit_id: 'L1-1',
          status: 'refunded',
          addons: [
            { addon_id: 'A1', name: 'Extra Shot', unit_price: 2.0, status: 'refunded' },
          ],
        },
        {
          unit_id: 'L1-2',
          status: 'paid',
          addons: [
            { addon_id: 'A1', name: 'Extra Shot', unit_price: 2.0, status: 'paid' },
          ],
        },
      ],
    },
    {
      line_id: 'L2',
      name: 'Hazelnut Americano with Oat Milk and Brown Sugar Syrup',
      unit_price: 11.9,
      units: [
        {
          unit_id: 'L2-1',
          status: 'paid',
          addons: [
            { addon_id: 'A2', name: 'Oat Milk', unit_price: 1.5, status: 'paid' },
            { addon_id: 'A3', name: 'Brown Sugar Syrup', unit_price: 1.0, status: 'paid' },
          ],
        },
        {
          unit_id: 'L2-2',
          // Unit is refunded; its add-ons inconsistently still show "paid"
          // — the unit status is authoritative.
          status: 'refunded',
          addons: [
            { addon_id: 'A2', name: 'Oat Milk', unit_price: 1.5, status: 'paid' },
            { addon_id: 'A3', name: 'Brown Sugar Syrup', unit_price: 1.0, status: 'paid' },
          ],
        },
      ],
    },
    {
      line_id: 'L3',
      name: 'Butter Croissant',
      unit_price: 7.9,
      units: [
        { unit_id: 'L3-1', status: 'paid', addons: [] },
        { unit_id: 'L3-2', status: 'paid', addons: [] },
        { unit_id: 'L3-3', status: 'paid', addons: [] },
      ],
    },
  ],
}

/**
 * Convert the raw order to the domain model.
 * All prices are converted to integer minor units (sen) at this boundary.
 * Units are flattened so each physical unit is a top-level entry.
 */
export function rawOrderToOrder(raw: RawOrder): Order {
  const units = raw.items.flatMap((item) =>
    item.units.map((unit) => ({
      unitId: unit.unit_id,
      lineId: item.line_id,
      lineName: item.name,
      unitPriceSen: toMinorUnits(item.unit_price),
      addons: unit.addons.map((addon) => ({
        addonId: addon.addon_id,
        name: addon.name,
        unitPriceSen: toMinorUnits(addon.unit_price),
        status: addon.status,
      })),
      status: unit.status,
    })),
  )

  return {
    orderId: raw.order_id,
    status: raw.status,
    currency: raw.currency,
    deliveryFeeSen: toMinorUnits(raw.delivery_fee),
    deliveryFeeStatus: raw.delivery_fee_status,
    units,
  }
}

/** The domain-model order, ready to use in the app. */
export const INITIAL_ORDER: Order = rawOrderToOrder(RAW_ORDER)
