import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import type { Order } from '../../domain/types'
import { useRefundFlow } from '../../hooks/useRefundFlow'
import { Step1Select } from './Step1Select'
import { Step2Review } from './Step2Review'
import { ConfirmDialog } from './ConfirmDialog'

interface RefundModalProps {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (updatedOrder: Order) => void
}

const STEP_TITLES: Record<1 | 2, string> = {
  1: 'Select items to refund',
  2: 'Review & details',
}

export function RefundModal({ order, open, onOpenChange, onSuccess }: RefundModalProps) {
  const flow = useRefundFlow(order, (updatedOrder) => {
    onSuccess(updatedOrder)
    onOpenChange(false)
  })

  // Reset flow state back to step 1 every time the modal opens
  // useEffect(() => {
  //   if (open) flow.reset()
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [open])

  function handleClose() {
    if (flow.state.isSubmitting) return
    onOpenChange(false)
  }

  return (
    <>
      {/* ── Main refund modal ── */}
      <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          <Dialog.Content
            onEscapeKeyDown={(e) => { e.preventDefault(); handleClose() }}
            onPointerDownOutside={(e) => { e.preventDefault(); handleClose() }}
            className="fixed left-1/2 top-1/2 z-40 w-full max-w-lg -translate-x-1/2 -translate-y-1/2
              rounded-lg bg-white shadow-xl
              data-[state=open]:animate-in data-[state=closed]:animate-out
              data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
              data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            aria-describedby="refund-modal-description"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  {STEP_TITLES[flow.state.step]}
                </Dialog.Title>
                <p id="refund-modal-description" className="text-sm text-gray-500">
                  Order {order.orderId} — Step {flow.state.step} of 2
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={flow.state.isSubmitting}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
                  disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close refund dialog"
              >
                <Cross2Icon className="h-5 w-5" />
              </button>
            </div>

            {/* Step progress bar */}
            <div className="flex gap-1 px-6 pt-3" aria-label="Refund flow progress">
              {([1, 2] as const).map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${s <= flow.state.step ? 'bg-red-500' : 'bg-gray-200'
                    }`}
                  aria-current={s === flow.state.step ? 'step' : undefined}
                />
              ))}
            </div>

            {/* Step content */}
            <div className="mt-3">
              {flow.state.step === 1 ? (
                <Step1Select
                  order={order}
                  state={flow.state}
                  calculation={flow.calculation}
                  hasValidSelection={flow.hasValidSelection}
                  onToggleUnit={flow.toggleUnit}
                  onToggleAddon={flow.toggleAddon}
                  onSetDeliveryFee={flow.setDeliveryFee}
                  onSelectAll={flow.selectAll}
                  onClearAll={flow.clearAll}
                  onNext={flow.goToStep2}
                  onClose={handleClose}
                />
              ) : (
                <Step2Review
                  order={order}
                  state={flow.state}
                  calculation={flow.calculation}
                  onSetReason={flow.setReason}
                  onSetChannel={flow.setChannel}
                  onBack={flow.goToStep1}
                  onConfirm={flow.openConfirm}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── Confirmation dialog (Step 3) ─────────────────────────────────────
           Cancel: closes this dialog only, refund modal stays open (spec).
           Confirm: submits, on success closes everything.                   ── */}
      <ConfirmDialog
        state={flow.state}
        calculation={flow.calculation}
        onConfirm={flow.submit}
        onCancel={flow.closeConfirm}
      />
    </>
  )
}
