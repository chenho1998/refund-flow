import { useState, useCallback } from 'react'
import type { Order } from '../domain/types'
import { formatMYR } from '../domain/money'
import { INITIAL_ORDER } from '../data/order'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { RefundModal } from './refund/RefundModal'

/** Group the flat units list back by lineId for display purposes. */
function groupUnitsByLine(order: Order) {
  const groups = new Map<string, { lineId: string; lineName: string; units: Order['units'] }>()

  for (const unit of order.units) {
    const existing = groups.get(unit.lineId)
    if (existing) {
      existing.units.push(unit)
    } else {
      groups.set(unit.lineId, { lineId: unit.lineId, lineName: unit.lineName, units: [unit] })
    }
  }

  return Array.from(groups.values())
}

export function OrderPage() {
  const [order, setOrder] = useState<Order>(INITIAL_ORDER)
  const [refundModalOpen, setRefundModalOpen] = useState(false)

  const handleRefundSuccess = useCallback((updatedOrder: Order) => {
    setOrder(updatedOrder)
    setRefundModalOpen(false)
  }, [])

  const lines = groupUnitsByLine(order)

  // Determine whether any item is still refundable
  const hasEligibleUnits = order.units.some((u) => u.status === 'paid')
  const deliveryEligible = order.deliveryFeeStatus === 'paid'
  const canRefund = hasEligibleUnits || deliveryEligible

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Order</p>
            <h1 className="text-2xl font-bold text-gray-900">{order.orderId}</h1>
            <span className="mt-1 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 capitalize">
              {order.status}
            </span>
          </div>
          <Button
            variant="primary"
            onClick={() => setRefundModalOpen(true)}
            disabled={!canRefund}
            aria-label="Start refund flow"
          >
            Refund
          </Button>
        </div>

        {/* Order items */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm" aria-label="Order items">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) =>
                line.units.map((unit, unitIdx) => (
                  <tr
                    key={unit.unitId}
                    className={`border-b border-gray-50 last:border-0 ${
                      unit.status === 'refunded' ? 'bg-gray-50 opacity-70' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {line.lineName}
                        {line.units.length > 1 && (
                          <span className="ml-1.5 text-xs text-gray-400">
                            #{unitIdx + 1}
                          </span>
                        )}
                      </div>
                      {unit.addons.length > 0 && (
                        <ul className="mt-1 space-y-0.5 pl-3" aria-label="Add-ons">
                          {unit.addons.map((addon) => (
                            <li key={addon.addonId} className="text-xs text-gray-500">
                              + {addon.name} ({formatMYR(addon.unitPriceSen)})
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {formatMYR(unit.unitPriceSen)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={unit.status}>
                        {unit.status === 'refunded' ? 'Refunded' : 'Paid'}
                      </Badge>
                    </td>
                  </tr>
                )),
              )}

              {/* Delivery fee row */}
              <tr
                className={`border-t border-gray-200 ${
                  order.deliveryFeeStatus === 'refunded' ? 'bg-gray-50 opacity-70' : ''
                }`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">Delivery fee</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {formatMYR(order.deliveryFeeSen)}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={order.deliveryFeeStatus}>
                    {order.deliveryFeeStatus === 'refunded' ? 'Refunded' : 'Paid'}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="mt-4 flex justify-end">
          <p className="text-sm text-gray-500">
            Currency:{' '}
            <span className="font-semibold text-gray-900">{order.currency}</span>
          </p>
        </div>
      </div>

      {/* Refund Modal */}
      <RefundModal
        order={order}
        open={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        onSuccess={handleRefundSuccess}
      />
    </div>
  )
}
