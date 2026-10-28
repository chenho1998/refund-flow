import * as Checkbox from '@radix-ui/react-checkbox'
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
  onNext: () => void
  onClose: () => void
}

function StyledCheckbox({
  id,
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  id: string
  checked: boolean
  onCheckedChange: () => void
  disabled: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300
          bg-white data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1
          disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={label}
      >
        <Checkbox.Indicator>
          <CheckIcon className="h-3 w-3 text-white" />
        </Checkbox.Indicator>
      </Checkbox.Root>
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
  onNext,
  onClose,
}: Step1SelectProps) {
  const lines = groupUnits(order)
  const deliveryEligible = isDeliveryFeeEligible(order)

  return (
    <div className="flex flex-col">
      <div className="space-y-4 overflow-y-auto px-6 pt-2 pb-4" style={{ maxHeight: '55vh' }}>
        {lines.map((line) =>
          line.units.map((unit, unitIdx) => {
            const eligible = isUnitEligible(unit)
            const unitSelected = state.selection.selectedUnitIds.has(unit.unitId)
            const unitAddonSelections = state.selection.addonSelections.get(unit.unitId) ?? new Set<string>()

            return (
              <div
                key={unit.unitId}
                className={`rounded-lg border p-3 ${
                  !eligible
                    ? 'border-gray-100 bg-gray-50 opacity-60'
                    : unitSelected
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white'
                }`}
              >
                {/* Unit row */}
                <div className="flex items-start gap-3">
                  <StyledCheckbox
                    id={`unit-${unit.unitId}`}
                    checked={unitSelected}
                    onCheckedChange={() => onToggleUnit(unit.unitId, eligible)}
                    disabled={!eligible}
                    label={`Select ${line.lineName}${line.units.length > 1 ? ` #${unitIdx + 1}` : ''} for refund`}
                  />
                  <label
                    htmlFor={`unit-${unit.unitId}`}
                    className={`flex flex-1 cursor-pointer items-start justify-between gap-2 ${
                      !eligible ? 'cursor-not-allowed' : ''
                    }`}
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {line.lineName}
                        {line.units.length > 1 && (
                          <span className="ml-1.5 text-xs text-gray-400">
                            #{unitIdx + 1}
                          </span>
                        )}
                      </span>
                      {!eligible && (
                        <span className="ml-2 text-xs text-amber-600">(already refunded)</span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm text-gray-700">
                      {formatMYR(unit.unitPriceSen)}
                    </span>
                  </label>
                </div>

                {/* Add-on rows */}
                {unit.addons.length > 0 && (
                  <ul className="mt-2 space-y-1.5 pl-7" aria-label={`Add-ons for ${line.lineName} #${unitIdx + 1}`}>
                    {unit.addons.map((addon) => {
                      const addonEligible = isAddonEligible(addon, unit)
                      const addonEnabled = eligible && unitSelected && addonEligible
                      const addonChecked = unitSelected && unitAddonSelections.has(addon.addonId)

                      return (
                        <li key={`${unit.unitId}-${addon.addonId}`} className="flex items-center gap-3">
                          <StyledCheckbox
                            id={`addon-${unit.unitId}-${addon.addonId}`}
                            checked={addonChecked}
                            onCheckedChange={() => onToggleAddon(unit.unitId, addon.addonId, addonEnabled)}
                            disabled={!addonEnabled}
                            label={`Select add-on ${addon.name} for ${line.lineName} #${unitIdx + 1}`}
                          />
                          <label
                            htmlFor={`addon-${unit.unitId}-${addon.addonId}`}
                            className={`flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm ${
                              !addonEnabled ? 'cursor-not-allowed text-gray-400' : 'text-gray-700'
                            }`}
                          >
                            <span>+ {addon.name}</span>
                            <span className="font-mono">{formatMYR(addon.unitPriceSen)}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          }),
        )}

        {/* Delivery fee row */}
        {order.deliveryFeeSen > 0 && (
          <div
            className={`rounded-lg border p-3 ${
              !deliveryEligible
                ? 'border-gray-100 bg-gray-50 opacity-60'
                : state.selection.includeDeliveryFee
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <StyledCheckbox
                id="delivery-fee"
                checked={state.selection.includeDeliveryFee}
                onCheckedChange={() => onSetDeliveryFee(!state.selection.includeDeliveryFee)}
                disabled={!deliveryEligible}
                label="Include delivery fee in refund"
              />
              <label
                htmlFor="delivery-fee"
                className={`flex flex-1 cursor-pointer items-center justify-between gap-2 ${
                  !deliveryEligible ? 'cursor-not-allowed' : ''
                }`}
              >
                <span className="font-medium text-gray-900">
                  Delivery fee
                  {!deliveryEligible && (
                    <span className="ml-2 text-xs text-amber-600">(already refunded)</span>
                  )}
                </span>
                <span className="font-mono text-sm text-gray-700">
                  {formatMYR(order.deliveryFeeSen)}
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Refund total</span>
          <span className="text-lg font-bold text-gray-900">
            {formatMYR(calculation.totalSen)}
          </span>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onNext}
            disabled={!hasValidSelection}
            type="button"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
