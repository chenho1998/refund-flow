import * as AlertDialog from '@radix-ui/react-alert-dialog'
import type { RefundCalculation } from '../../domain/types'
import type { RefundFlowState } from '../../hooks/useRefundFlow'
import { formatMYR } from '../../domain/money'
import { Button } from '../ui/Button'

interface ConfirmDialogProps {
  state: RefundFlowState
  calculation: RefundCalculation
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ state, calculation, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={state.isConfirmOpen}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2
            rounded-lg bg-white p-6 shadow-xl
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby="confirm-dialog-description"
        >
          <AlertDialog.Title className="mb-1 text-lg font-semibold text-gray-900">
            Confirm refund
          </AlertDialog.Title>
          <AlertDialog.Description id="confirm-dialog-description" className="mb-4 text-sm text-gray-600">
            You are about to refund{' '}
            <strong className="text-gray-900">{formatMYR(calculation.totalSen)}</strong> to the
            customer via <strong className="text-gray-900">{state.channel}</strong>. This action
            cannot be undone.
          </AlertDialog.Description>

          {/* Details summary */}
          <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-gray-50 p-3 text-sm">
            <dt className="text-gray-500">Amount</dt>
            <dd className="font-mono font-semibold text-gray-900">
              {formatMYR(calculation.totalSen)}
            </dd>
            <dt className="text-gray-500">Channel</dt>
            <dd className="text-gray-900">{state.channel}</dd>
            <dt className="text-gray-500">Reason</dt>
            <dd className="text-gray-900">{state.reason}</dd>
          </dl>

          {/* Error banner */}
          {state.submitError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <strong className="block font-medium">Refund failed</strong>
              {state.submitError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button
                variant="secondary"
                onClick={onCancel}
                disabled={state.isSubmitting}
                type="button"
              >
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant="danger"
                onClick={onConfirm}
                loading={state.isSubmitting}
                disabled={state.isSubmitting}
                type="button"
                aria-live="polite"
              >
                {state.isSubmitting ? 'Processing…' : state.submitError ? 'Retry' : 'Confirm refund'}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
