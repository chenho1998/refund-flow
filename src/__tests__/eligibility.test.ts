import { describe, it, expect } from 'vitest'
import { isUnitEligible, isAddonEligible, isDeliveryFeeEligible, eligibleUnitCount } from '../domain/eligibility'
import type { Unit, Addon, Order } from '../domain/types'
import { INITIAL_ORDER } from '../data/order'

const paidUnit: Unit = {
  unitId: 'TEST-1',
  lineId: 'T1',
  lineName: 'Test Item',
  unitPriceSen: 1390,
  addons: [],
  status: 'paid',
}

const refundedUnit: Unit = {
  ...paidUnit,
  unitId: 'TEST-2',
  status: 'refunded',
}

const paidAddon: Addon = {
  addonId: 'TA1',
  name: 'Test Addon',
  unitPriceSen: 200,
  status: 'paid',
}

const refundedAddon: Addon = {
  ...paidAddon,
  addonId: 'TA2',
  status: 'refunded',
}

describe('isUnitEligible', () => {
  it('returns true for a paid unit', () => {
    expect(isUnitEligible(paidUnit)).toBe(true)
  })

  it('returns false for a refunded unit', () => {
    expect(isUnitEligible(refundedUnit)).toBe(false)
  })
})

describe('isAddonEligible', () => {
  it('returns true when addon is paid and parent unit is paid', () => {
    expect(isAddonEligible(paidAddon, paidUnit)).toBe(true)
  })

  it('returns false when parent unit is refunded (even if addon shows paid)', () => {
    // Mirrors the L2-2 inconsistency: unit refunded, addons say "paid"
    expect(isAddonEligible(paidAddon, refundedUnit)).toBe(false)
  })

  it('returns false when addon is refunded and parent unit is paid', () => {
    expect(isAddonEligible(refundedAddon, paidUnit)).toBe(false)
  })

  it('returns false when both addon and unit are refunded', () => {
    expect(isAddonEligible(refundedAddon, refundedUnit)).toBe(false)
  })
})

describe('isDeliveryFeeEligible', () => {
  it('returns true for paid non-zero delivery fee', () => {
    expect(isDeliveryFeeEligible(INITIAL_ORDER)).toBe(true)
  })

  it('returns false when delivery fee is refunded', () => {
    const order: Order = { ...INITIAL_ORDER, deliveryFeeStatus: 'refunded' }
    expect(isDeliveryFeeEligible(order)).toBe(false)
  })

  it('returns false when delivery fee is zero', () => {
    const order: Order = { ...INITIAL_ORDER, deliveryFeeSen: 0 }
    expect(isDeliveryFeeEligible(order)).toBe(false)
  })
})

describe('eligibleUnitCount', () => {
  it('counts only paid units in the actual order', () => {
    // L1-1 refunded, L2-2 refunded → 5 eligible out of 7 total units
    expect(eligibleUnitCount(INITIAL_ORDER)).toBe(5)
  })
})
