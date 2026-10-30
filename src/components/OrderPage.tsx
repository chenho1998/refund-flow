import { useState, useCallback } from 'react'
import type { Order } from '../domain/types'
import { formatMYR } from '../domain/money'
import { INITIAL_ORDER } from '../data/order'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { RefundModal } from './refund/RefundModal'

/** Group the flat units list back by lineId for display purposes. */
function groupUnitsByLine(order: Order) {
  const groups = new Map<
    string,
    { lineId: string; lineName: string; unitPriceSen: number; units: Order['units'] }
  >()

  for (const unit of order.units) {
    const existing = groups.get(unit.lineId)
    if (existing) {
      existing.units.push(unit)
    } else {
      groups.set(unit.lineId, {
        lineId: unit.lineId,
        lineName: unit.lineName,
        unitPriceSen: unit.unitPriceSen,
        units: [unit],
      })
    }
  }

  return Array.from(groups.values())
}

/** Compute a quick order summary for the header. */
function getOrderSummary(order: Order) {
  const totalUnits = order.units.length
  const refundedUnits = order.units.filter((u) => u.status === 'refunded').length
  const eligibleUnits = totalUnits - refundedUnits

  // Paid total = sum of all unit prices + their add-ons (ignoring refund status)
  const itemTotal = order.units.reduce((sum, u) => {
    const addonsTotal = u.addons.reduce((a, addon) => a + addon.unitPriceSen, 0)
    return sum + u.unitPriceSen + addonsTotal
  }, 0)
  const grandTotal = itemTotal + order.deliveryFeeSen

  return { totalUnits, refundedUnits, eligibleUnits, grandTotal }
}

export function OrderPage() {
  const [order, setOrder] = useState<Order>(INITIAL_ORDER)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  // const [lastRefundedAt, setLastRefundedAt] = useState<Date | null>(null)

  const handleRefundSuccess = useCallback((updatedOrder: Order) => {
    setOrder(updatedOrder)
    setRefundModalOpen(false)
    // setLastRefundedAt(new Date())
  }, [])

  const lines = groupUnitsByLine(order)
  const summary = getOrderSummary(order)

  const hasEligibleUnits = order.units.some((u) => u.status === 'paid')
  const deliveryEligible = order.deliveryFeeStatus === 'paid'
  const canRefund = hasEligibleUnits || deliveryEligible
  const allRefunded = !canRefund

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Success banner ─────────────────────────────────────────── */}
        {/* {lastRefundedAt && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Refund processed successfully</p>
              <p className="text-emerald-700">
                Submitted at {lastRefundedAt.toLocaleTimeString()}. The order below reflects the updated status.
              </p>
            </div>
          </div>
        )} */}

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Order</p>
            <h1 className="text-2xl font-bold text-gray-900">{order.orderId}</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 capitalize">
                {order.status}
              </span>
              {allRefunded && (
                <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Fully refunded
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Button
              variant="primary"
              onClick={() => setRefundModalOpen(true)}
              disabled={!canRefund}
              aria-label={canRefund ? 'Start refund flow' : 'All items have already been refunded'}
              title={!canRefund ? 'All items have already been refunded' : undefined}
            >
              Refund
            </Button>
          </div>
        </div>

        {/* ── Order summary cards ───────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-xs text-gray-500">Items</p>
            <p className="mt-0.5 text-xl font-bold text-gray-900">{summary.totalUnits}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-xs text-gray-500">Refunded</p>
            <p className={`mt-0.5 text-xl font-bold ${summary.refundedUnits > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              {summary.refundedUnits}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-xs text-gray-500">Order total</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">{formatMYR(summary.grandTotal)}</p>
          </div>
        </div>

        {/* ── Order items table ────────────────────────────────────── */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm" aria-label="Order items">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line) => (
                <>
                  {/* Line group header — only shown when qty > 1 */}
                  {line.units.length > 1 && (
                    <tr key={`${line.lineId}-header`} className="bg-gray-50/60">
                      <td colSpan={3} className="px-4 py-1.5">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {line.lineName}
                          <span className="ml-1.5 font-normal normal-case">× {line.units.length}</span>
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* One row per physical unit */}
                  {line.units.map((unit, unitIdx) => {
                    const isRefunded = unit.status === 'refunded'
                    return (
                      <tr
                        key={unit.unitId}
                        className={isRefunded ? 'opacity-50' : ''}
                      >
                        <td className="px-4 py-3">
                          <div className={`font-medium ${isRefunded ? 'text-gray-500 line-through decoration-gray-400' : 'text-gray-900'}`}>
                            {line.lineName}
                            {line.units.length > 1 && (
                              <span className="ml-1.5 text-xs font-normal text-gray-400 no-underline" style={{ textDecoration: 'none' }}>
                                #{unitIdx + 1}
                              </span>
                            )}
                          </div>
                          {unit.addons.length > 0 && (
                            <ul className="mt-1 space-y-0.5 pl-3">
                              {unit.addons.map((addon) => {
                                // An add-on is visually refunded if its parent unit is refunded,
                                // regardless of the add-on's own status field (handles L2-2 inconsistency)
                                const addonRefunded = isRefunded || addon.status === 'refunded'
                                return (
                                  <li
                                    key={addon.addonId}
                                    className={`text-xs ${addonRefunded ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-500'}`}
                                  >
                                    + {addon.name}
                                    <span className="ml-1 font-mono">({formatMYR(addon.unitPriceSen)})</span>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${isRefunded ? 'text-gray-400' : 'text-gray-700'}`}>
                          {formatMYR(unit.unitPriceSen)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={unit.status}>
                            {isRefunded ? 'Refunded' : 'Paid'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>

            {/* ── Delivery fee + order total footer ── */}
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr className={order.deliveryFeeStatus === 'refunded' ? 'opacity-50' : ''}>
                <td className={`px-4 py-3 font-medium ${order.deliveryFeeStatus === 'refunded' ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-700'}`}>
                  Delivery fee
                </td>
                <td className={`px-4 py-3 text-right font-mono ${order.deliveryFeeStatus === 'refunded' ? 'text-gray-400' : 'text-gray-700'}`}>
                  {formatMYR(order.deliveryFeeSen)}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={order.deliveryFeeStatus}>
                    {order.deliveryFeeStatus === 'refunded' ? 'Refunded' : 'Paid'}
                  </Badge>
                </td>
              </tr>
              <tr className="border-t border-gray-200">
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">Order total</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                  {formatMYR(summary.grandTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

      <RefundModal
        order={order}
        open={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        onSuccess={handleRefundSuccess}
      />
    </div>
  )
}
