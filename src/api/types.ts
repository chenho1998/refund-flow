import type { RefundReason, RefundChannel, RawOrder } from '../domain/types'

// ─── GET /orders/:id ──────────────────────────────────────────────────────────

export interface GetOrderResponse {
  order: RawOrder
}

// ─── POST /orders/:id/refunds ─────────────────────────────────────────────────

export interface SubmitRefundRequest {
  idempotencyKey: string
  selectedUnitIds: string[]
  /** map of unitId → addonId[] */
  addonSelections: Record<string, string[]>
  includeDeliveryFee: boolean
  reason: RefundReason
  channel: RefundChannel
}

export interface SubmitRefundSuccessResponse {
  success: true
  refundId: string
  /** Server-calculated amount in integer minor units (sen) */
  amountSen: number
  updatedOrder: RawOrder
}

export interface SubmitRefundErrorResponse {
  success: false
  code: 'DUPLICATE_REQUEST' | 'UNIT_ALREADY_REFUNDED' | 'INVALID_SELECTION' | 'INTERNAL_ERROR'
  message: string
}

export type SubmitRefundResponse = SubmitRefundSuccessResponse | SubmitRefundErrorResponse
