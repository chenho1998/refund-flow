import { CheckIcon } from '@radix-ui/react-icons'
import type { Order } from '../../domain/types'
import type { RefundFlowState } from '../../hooks/useRefundFlow'
import type { RefundCalculation } from '../../domain/types'
import { formatMYR } from '../../domain/money'
import { isUnitEligible, isAddonEligible, isDeliveryFeeEligible } from '../../domain/eligibility'
import { Button } from '../ui/Button'

interface Step1SelectProps {
  order: Order
  state: RefundFlowState
  calculation: RefundCalculation
  hasValidSelection: boolean
  onToggleUnit: (unitId: string, eligible: boolean) => void
  onToggleAddon: (unitId: string, addonId: string, eligible: boolean) => void
  onSetDeliveryFee: (include: boolean) => void
  onSelectAll: () => void
  onClearAll: () => void
  onNext: () => void
  onClose: () => void
}

/**
 * Purely visual checkbox — no interactive events of its own.
 * The parent <button> owns the entire row's click/keyboard handling.
 * We stop propagation here so clicks on the visual checkbox don't
 * bubble up and fire the parent button a second time (double-toggle bug).
 */
function StyledCheckbox({
  checked,
  disabled,
}: {
  checked: boolean
  disabled: boolean
  label: string  // kept in interface for call-site clarity; visual-only so not rendered
}) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      onClick={(e) => e.stopPropagation()}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors
        ${checked ? 'border-red-600 bg-red-600' : 'border-gray-300 bg-white'}
        ${disabled ? 'opacity-40' : ''}
      `}
    >
      {checked && <CheckIcon className="h-3 w-3 text-white" />}
    </div>
  )
}

/** Group units by lineId for display in the selection list. */
function groupUnits(order: Order) {
  const groups = new Map<string, { lineId: string; lineName: string; units: Order['units'] }>()
  for (const unit of order.units) {
    const g = groups.get(unit.lineId)
    if (g) g.units.push(unit)
    else groups.set(unit.lineId, { lineId: unit.lineId, lineName: unit.lineName, units: [unit] })
  }
  return Array.from(groups.values())
}

export function Step1Select({
  order,
  state,
  calculation,
  hasValidSelection,
  onToggleUnit,
  onToggleAddon,
  onSetDeliveryFee,
  onSelectAll,
  onClearAll,
  onNext,
  onClose,
}: Step1SelectProps) {
  const lines = groupUnits(order)
  const deliveryEligible = isDeliveryFeeEligible(order)

  // How many eligible units + delivery are there total vs selected
  const eligibleUnitIds = order.units.filter(isUnitEligible).map((u) => u.unitId)
  const selectedCount = state.selection.selectedUnitIds.size + (state.selection.includeDeliveryFee ? 1 : 0)
  const eligibleCount = eligibleUnitIds.length + (deliveryEligible ? 1 : 0)
  const allSelected = eligibleCount > 0 && selectedCount === eligibleCount

  return (
    <div className="flex flex-col">
      {/* ── Select all / Clear all toolbar ── */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-2">
        <span className="text-xs text-gray-500">
          {selectedCount === 0
            ? 'Select items to refund'
            : `${selectedCount} of ${eligibleCount} selected`}
        </span>
        <div className="flex gap-3">
          {!allSelected && (
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs font-medium text-red-600 hover:text-red-700 focus-visible:outline-none focus-visible:underline"
            >
              Select all
            </button>
          )}
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Item list ── */}
      <div className="space-y-3 overflow-y-auto px-6 pt-3 pb-4" style={{ maxHeight: '50vh' }}>
        {lines.map((line) =>
          line.units.map((unit, unitIdx) => {
            const eligible = isUnitEligible(unit)
            const unitSelected = state.selection.selectedUnitIds.has(unit.unitId)
            const unitAddonSelections = state.selection.addonSelections.get(unit.unitId) ?? new Set<string>()

            return (
              <div
                key={unit.unitId}
                role="group"
                aria-label={`${line.lineName}${line.units.length > 1 ? ` #${unitIdx + 1}` : ''}`}
                className={`rounded-lg border transition-colors ${!eligible
                  ? 'border-gray-100 bg-gray-50 opacity-60'
                  : unitSelected
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
              >
                {/* Clickable unit row — full width */}
                <button
                  type="button"
                  disabled={!eligible}
                  onClick={() => onToggleUnit(unit.unitId, eligible)}
                  className="flex w-full items-start gap-3 p-3 text-left disabled:cursor-not-allowed"
                  aria-pressed={unitSelected}
                >
                  <StyledCheckbox
                    checked={unitSelected}
                    disabled={!eligible}
                    label={`Select ${line.lineName}${line.units.length > 1 ? ` #${unitIdx + 1}` : ''} for refund`}
                  />
                  <div className="flex flex-1 items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-gray-900">
                        {line.lineName}
                        {line.units.length > 1 && (
                          <span className="ml-1.5 text-xs text-gray-400">#{unitIdx + 1}</span>
                        )}
                      </span>
                      {!eligible && (
                        <span className="ml-2 text-xs text-amber-600">(already refunded)</span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm text-gray-700">
                      {formatMYR(unit.unitPriceSen)}
                    </span>
                  </div>
                </button>

                {/* Add-on rows — only shown when unit has add-ons */}
                {unit.addons.length > 0 && (
                  <ul
                    className="border-t border-dashed border-gray-100 px-3 pb-2 pt-1 space-y-1"
                    aria-label={`Add-ons for ${line.lineName}${line.units.length > 1 ? ` #${unitIdx + 1}` : ''}`}
                  >
                    {unit.addons.map((addon) => {
                      const addonEligible = isAddonEligible(addon, unit)
                      const addonEnabled = eligible && unitSelected && addonEligible
                      const addonChecked = unitSelected && unitAddonSelections.has(addon.addonId)

                      return (
                        <li key={`${unit.unitId}-${addon.addonId}`}>
                          <button
                            type="button"
                            disabled={!addonEnabled}
                            onClick={() => onToggleAddon(unit.unitId, addon.addonId, addonEnabled)}
                            title={
                              !unitSelected && eligible
                                ? 'Select the parent item first to enable this add-on'
                                : undefined
                            }
                            className={`flex w-full items-center gap-3 rounded px-1 py-1 text-sm transition-colors
                              disabled:cursor-not-allowed
                              ${addonEnabled ? 'hover:bg-red-100/50' : ''}`}
                            aria-pressed={addonChecked}
                          >
                            <StyledCheckbox
                              checked={addonChecked}
                              disabled={!addonEnabled}
                              label={`Select add-on ${addon.name}`}
                            />
                            <span className={`flex flex-1 items-center justify-between gap-2 ${!addonEnabled ? 'text-gray-400' : 'text-gray-700'
                              }`}>
                              <span>
                                + {addon.name}
                                {!unitSelected && eligible && (
                                  <span className="ml-1.5 text-xs text-gray-400">(select item first)</span>
                                )}
                              </span>
                              <span className="font-mono">{formatMYR(addon.unitPriceSen)}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          }),
        )}

        {/* Delivery fee */}
        {order.deliveryFeeSen > 0 && (
          <div
            className={`rounded-lg border transition-colors ${!deliveryEligible
              ? 'border-gray-100 bg-gray-50 opacity-60'
              : state.selection.includeDeliveryFee
                ? 'border-red-200 bg-red-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <button
              type="button"
              disabled={!deliveryEligible}
              onClick={() => onSetDeliveryFee(!state.selection.includeDeliveryFee)}
              className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-not-allowed"
              aria-pressed={state.selection.includeDeliveryFee}
            >
              <StyledCheckbox
                checked={state.selection.includeDeliveryFee}
                disabled={!deliveryEligible}
                label="Include delivery fee in refund"
              />
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="font-medium text-gray-900">
                  Delivery fee
                  {!deliveryEligible && (
                    <span className="ml-2 text-xs text-amber-600">(already refunded)</span>
                  )}
                </span>
                <span className="font-mono text-sm text-gray-700">
                  {formatMYR(order.deliveryFeeSen)}
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Refund total</span>
          <span className={`text-lg font-bold ${hasValidSelection ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatMYR(calculation.totalSen)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          {/* Inline hint when nothing is selected */}
          {!hasValidSelection ? (
            <p className="text-xs text-gray-400">Select at least one item to continue</p>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onNext}
              disabled={!hasValidSelection}
              type="button"
              title={!hasValidSelection ? 'Select at least one item to continue' : undefined}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
