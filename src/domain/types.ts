// ─── Raw API / data shapes ───────────────────────────────────────────────────

export type ItemStatus = 'paid' | 'refunded'
export type DeliveryFeeStatus = 'paid' | 'refunded'
export type OrderStatus = 'completed' | 'cancelled' | 'pending'

export interface RawAddon {
  addon_id: string
  name: string
  unit_price: number  // decimal MYR from source data
  status: ItemStatus
}

export interface RawUnit {
  unit_id: string
  status: ItemStatus
  addons: RawAddon[]
}

export interface RawLineItem {
  line_id: string
  name: string
  unit_price: number  // decimal MYR from source data
  units: RawUnit[]
}

export interface RawOrder {
  order_id: string
  status: OrderStatus
  currency: string
  delivery_fee: number  // decimal MYR
  delivery_fee_status: DeliveryFeeStatus
  items: RawLineItem[]
}

// ─── Domain model (money in minor units / sen) ───────────────────────────────

export interface Addon {
  addonId: string       // e.g. "A1"
  name: string
  unitPriceSen: number  // integer minor units
  status: ItemStatus
}

export interface Unit {
  unitId: string        // e.g. "L1-1"
  lineId: string        // back-reference to parent line
  lineName: string
  unitPriceSen: number  // base price of one unit
  addons: Addon[]
  status: ItemStatus
}

export interface Order {
  orderId: string
  status: OrderStatus
  currency: string
  deliveryFeeSen: number        // integer minor units
  deliveryFeeStatus: DeliveryFeeStatus
  units: Unit[]                 // flattened: one entry per physical unit
}

// ─── Refund selection ─────────────────────────────────────────────────────────

/** Per-unit selection: which add-ons (by addonId) are selected for that unit */
export interface UnitSelection {
  unitId: string
  selectedAddonIds: Set<string>
}

export interface RefundSelection {
  /** Set of unit IDs selected for refund */
  selectedUnitIds: Set<string>
  /** Per-unit add-on selections */
  addonSelections: Map<string, Set<string>>
  /** Whether to include the delivery fee */
  includeDeliveryFee: boolean
}

// ─── Refund calculation result ────────────────────────────────────────────────

export interface RefundLineItem {
  unitId: string
  lineName: string
  unitPriceSen: number
  selectedAddons: Array<{ addonId: string; name: string; priceSen: number }>
  subtotalSen: number   // unit price + selected add-ons
}

export interface RefundCalculation {
  lines: RefundLineItem[]
  deliveryFeeSen: number        // 0 if not included
  totalSen: number              // sum of all lines + delivery
}

// ─── Refund reasons and channels ─────────────────────────────────────────────

export const REFUND_REASONS = [
  'Wrong item',
  'Missing item',
  'Quality issue',
  'Late delivery',
  'Other',
] as const

export type RefundReason = typeof REFUND_REASONS[number]

export const REFUND_CHANNELS = [
  'Original payment method',
  'In-app credit',
] as const

export type RefundChannel = typeof REFUND_CHANNELS[number]

// ─── Refund submission ────────────────────────────────────────────────────────

export interface RefundRequest {
  orderId: string
  idempotencyKey: string
  selectedUnitIds: string[]
  /** addonId[] per unitId */
  addonSelections: Record<string, string[]>
  includeDeliveryFee: boolean
  reason: RefundReason
  channel: RefundChannel
}

export interface RefundResponse {
  success: true
  refundId: string
  amountSen: number
  updatedOrder: RawOrder
}

export interface RefundError {
  success: false
  code: 'DUPLICATE_REQUEST' | 'UNIT_ALREADY_REFUNDED' | 'INVALID_SELECTION' | 'INTERNAL_ERROR'
  message: string
}
