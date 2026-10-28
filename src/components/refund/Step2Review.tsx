import { useState } from 'react'
import * as Select from '@radix-ui/react-select'
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from '@radix-ui/react-icons'
import type { Order, RefundCalculation } from '../../domain/types'
import { REFUND_REASONS, REFUND_CHANNELS } from '../../domain/types'
import type { RefundReason, RefundChannel } from '../../domain/types'
import type { RefundFlowState } from '../../hooks/useRefundFlow'
import { formatMYR } from '../../domain/money'
import { Button } from '../ui/Button'

interface Step2ReviewProps {
  order: Order
  state: RefundFlowState
  calculation: RefundCalculation
  onSetReason: (r: RefundReason) => void
  onSetChannel: (c: RefundChannel) => void
  onBack: () => void
  onConfirm: () => void
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Select.Item
      value={value}
      className="relative flex cursor-pointer select-none items-center rounded px-7 py-1.5 text-sm text-gray-700
        outline-none data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700"
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="absolute left-1.5 flex items-center">
        <CheckIcon className="h-3.5 w-3.5 text-red-600" />
      </Select.ItemIndicator>
    </Select.Item>
  )
}

function StyledSelect<T extends string>({
  id,
  value,
  placeholder,
  options,
  onChange,
  label,
  missing,
}: {
  id: string
  value: T | ''
  placeholder: string
  options: readonly T[]
  onChange: (v: T) => void
  label: string
  missing?: boolean
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-1 block text-sm font-medium ${missing ? 'text-red-600' : 'text-gray-700'}`}
      >
        {label}
        {missing && <span className="ml-1 text-red-500">— required</span>}
      </label>
      <Select.Root value={value || undefined} onValueChange={(v) => onChange(v as T)}>
        <Select.Trigger
          id={id}
          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm
            shadow-sm bg-white hover:border-gray-400
            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1
            data-[placeholder]:text-gray-400
            ${missing ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-300 text-gray-700'}`}
          aria-label={label}
          aria-invalid={missing}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="z-50 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
            position="popper"
            sideOffset={4}
          >
            <Select.ScrollUpButton className="flex items-center justify-center py-1 text-gray-400">
              <ChevronUpIcon />
            </Select.ScrollUpButton>
            <Select.Viewport className="p-1">
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="flex items-center justify-center py-1 text-gray-400">
              <ChevronDownIcon />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

export function Step2Review({
  order,
  state,
  calculation,
  onSetReason,
  onSetChannel,
  onBack,
  onConfirm,
}: Step2ReviewProps) {
  const canConfirm = state.reason !== '' && state.channel !== ''
  // Only highlight missing fields after the user has tried to confirm once
  const [attempted, setAttempted] = useState(false)

  function handleConfirmClick() {
    if (!canConfirm) {
      setAttempted(true)
      return
    }
    onConfirm()
  }

  const itemCount = calculation.lines.length
  const hasDelivery = calculation.deliveryFeeSen > 0

  return (
    <div className="flex flex-col">
      <div className="space-y-4 overflow-y-auto px-6 pt-2 pb-4" style={{ maxHeight: '55vh' }}>

        {/* Selected items preview */}
        <section aria-label="Items to be refunded">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Items to refund</h3>
            <span className="text-xs text-gray-400">
              {itemCount} item{itemCount !== 1 ? 's' : ''}{hasDelivery ? ' + delivery' : ''}
            </span>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50">
            {calculation.lines.map((line) => {
              const unit = order.units.find((u) => u.unitId === line.unitId)
              return (
                <div key={line.unitId} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <span className="font-medium text-gray-900">{line.lineName}</span>
                    <span className="shrink-0 font-mono text-gray-700">
                      {formatMYR(unit?.unitPriceSen ?? line.unitPriceSen)}
                    </span>
                  </div>
                  {line.selectedAddons.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {line.selectedAddons.map((a) => (
                        <li key={a.addonId} className="flex justify-between text-xs text-gray-500">
                          <span>+ {a.name}</span>
                          <span className="font-mono">{formatMYR(a.priceSen)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-1 flex justify-end text-xs text-gray-400">
                    Subtotal:{' '}
                    <span className="ml-1 font-mono font-medium text-gray-600">
                      {formatMYR(line.subtotalSen)}
                    </span>
                  </div>
                </div>
              )
            })}

            {hasDelivery && (
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium text-gray-700">Delivery fee</span>
                <span className="font-mono text-gray-700">
                  {formatMYR(calculation.deliveryFeeSen)}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Total */}
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
          <span className="font-semibold text-gray-900">Total refund amount</span>
          <span className="text-xl font-bold text-red-700">
            {formatMYR(calculation.totalSen)}
          </span>
        </div>

        {/* Reason */}
        <StyledSelect
          id="refund-reason"
          label="Reason"
          placeholder="Select a reason"
          value={state.reason as RefundReason | ''}
          options={REFUND_REASONS}
          onChange={onSetReason}
          missing={attempted && state.reason === ''}
        />

        {/* Channel */}
        <StyledSelect
          id="refund-channel"
          label="Refund channel"
          placeholder="Select refund channel"
          value={state.channel as RefundChannel | ''}
          options={REFUND_CHANNELS}
          onChange={onSetChannel}
          missing={attempted && state.channel === ''}
        />

        {/* Hint shown only after a failed confirm attempt */}
        {attempted && !canConfirm && (
          <p role="alert" className="text-xs text-red-600">
            Please fill in the required fields above before confirming.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {!canConfirm ? 'Reason and channel are required' : 'Ready to confirm'}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onBack} type="button">
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmClick}
              type="button"
              aria-describedby={attempted && !canConfirm ? 'confirm-hint' : undefined}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

