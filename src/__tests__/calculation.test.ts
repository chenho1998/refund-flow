import { describe, it, expect } from 'vitest'
import { calculateRefund } from '../domain/calculation'
import type { RefundSelection } from '../domain/types'
import { INITIAL_ORDER } from '../data/order'

function makeSelection(
  unitIds: string[],
  addonMap: Record<string, string[]> = {},
  includeDelivery = false,
): RefundSelection {
  return {
    selectedUnitIds: new Set(unitIds),
    addonSelections: new Map(
      Object.entries(addonMap).map(([k, v]) => [k, new Set(v)]),
    ),
    includeDeliveryFee: includeDelivery,
  }
}

describe('calculateRefund — basic cases', () => {
  it('returns zero total for empty selection', () => {
    const result = calculateRefund(INITIAL_ORDER, makeSelection([]))
    expect(result.totalSen).toBe(0)
    expect(result.lines).toHaveLength(0)
    expect(result.deliveryFeeSen).toBe(0)
  })

  it('calculates a single unit without add-ons (L3-1 Butter Croissant)', () => {
    const result = calculateRefund(INITIAL_ORDER, makeSelection(['L3-1']))
    expect(result.totalSen).toBe(790)    // MYR 7.90
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].subtotalSen).toBe(790)
    expect(result.lines[0].selectedAddons).toHaveLength(0)
  })

  it('calculates a unit with all add-ons selected (L2-1)', () => {
    // L2-1: 11.90 + Oat Milk 1.50 + Brown Sugar Syrup 1.00 = MYR 14.40 = 1440 sen
    const result = calculateRefund(
      INITIAL_ORDER,
      makeSelection(['L2-1'], { 'L2-1': ['A2', 'A3'] }),
    )
    expect(result.totalSen).toBe(1440)
    expect(result.lines[0].subtotalSen).toBe(1440)
    expect(result.lines[0].selectedAddons).toHaveLength(2)
  })

  it('calculates a unit with only one add-on selected (L2-1, Oat Milk only)', () => {
    // 11.90 + 1.50 = 13.40 = 1340 sen
    const result = calculateRefund(
      INITIAL_ORDER,
      makeSelection(['L2-1'], { 'L2-1': ['A2'] }),
    )
    expect(result.totalSen).toBe(1340)
  })

  it('includes delivery fee when requested', () => {
    const result = calculateRefund(INITIAL_ORDER, makeSelection(['L3-1'], {}, true))
    expect(result.deliveryFeeSen).toBe(500)
    expect(result.totalSen).toBe(790 + 500)
  })

  it('does not include delivery fee when not requested', () => {
    const result = calculateRefund(INITIAL_ORDER, makeSelection(['L3-1'], {}, false))
    expect(result.deliveryFeeSen).toBe(0)
    expect(result.totalSen).toBe(790)
  })
})

describe('calculateRefund — eligibility enforcement', () => {
  it('skips ineligible unit even if selected (L1-1 is refunded)', () => {
    // L1-1 is refunded — selecting it should contribute nothing
    const result = calculateRefund(INITIAL_ORDER, makeSelection(['L1-1']))
    expect(result.totalSen).toBe(0)
    expect(result.lines).toHaveLength(0)
  })

  it('skips ineligible unit L2-2 (unit refunded, add-ons inconsistently paid)', () => {
    const result = calculateRefund(
      INITIAL_ORDER,
      makeSelection(['L2-2'], { 'L2-2': ['A2', 'A3'] }),
    )
    expect(result.totalSen).toBe(0)
    expect(result.lines).toHaveLength(0)
  })

  it('does not count add-on for an unselected unit', () => {
    // Addon listed in addonSelections but unit not selected
    const result = calculateRefund(
      INITIAL_ORDER,
      makeSelection([], { 'L2-1': ['A2'] }),
    )
    expect(result.totalSen).toBe(0)
  })
})

describe('calculateRefund — full refund', () => {
  it('calculates maximum refundable amount correctly', () => {
    // Eligible: L1-2 (1390+200), L2-1 (1190+150+100), L3-1/2/3 (3×790), delivery 500
    // = 1590 + 1440 + 2370 + 500 = 5900 sen = MYR 59.00
    const result = calculateRefund(
      INITIAL_ORDER,
      makeSelection(
        ['L1-2', 'L2-1', 'L3-1', 'L3-2', 'L3-3'],
        {
          'L1-2': ['A1'],
          'L2-1': ['A2', 'A3'],
        },
        true,
      ),
    )
    expect(result.totalSen).toBe(5900)
    expect(result.lines).toHaveLength(5)
    expect(result.deliveryFeeSen).toBe(500)
  })
})

describe('calculateRefund — multiple units', () => {
  it('sums correctly across multiple lines', () => {
    // L1-2 (1390) + L3-1 (790) = 2180 sen
    const result = calculateRefund(
      INITIAL_ORDER,
      makeSelection(['L1-2', 'L3-1']),
    )
    expect(result.totalSen).toBe(2180)
    expect(result.lines).toHaveLength(2)
  })
})

describe('calculateRefund — delivery fee edge cases', () => {
  it('does not include delivery when already refunded', () => {
    const orderWithRefundedDelivery = {
      ...INITIAL_ORDER,
      deliveryFeeStatus: 'refunded' as const,
    }
    const result = calculateRefund(
      orderWithRefundedDelivery,
      makeSelection(['L3-1'], {}, true),
    )
    expect(result.deliveryFeeSen).toBe(0)
    expect(result.totalSen).toBe(790)
  })

  it('does not include delivery when fee is zero', () => {
    const orderNoDelivery = { ...INITIAL_ORDER, deliveryFeeSen: 0 }
    const result = calculateRefund(orderNoDelivery, makeSelection(['L3-1'], {}, true))
    expect(result.deliveryFeeSen).toBe(0)
  })
})
