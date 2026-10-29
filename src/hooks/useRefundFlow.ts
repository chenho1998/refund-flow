import { useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  Order,
  RefundSelection,
  RefundReason,
  RefundChannel,
} from "../domain/types";
import { calculateRefund } from "../domain/calculation";
import { submitRefund } from "../api/mockApi";
import { rawOrderToOrder } from "../data/order";
import {
  isUnitEligible,
  isAddonEligible,
  isDeliveryFeeEligible,
} from "../domain/eligibility";
import type { SubmitRefundRequest } from "../api/types";

export type RefundStep = 1 | 2;

export interface RefundFlowState {
  isOpen: boolean;
  step: RefundStep;
  selection: RefundSelection;
  reason: RefundReason | "";
  channel: RefundChannel | "";
  isSubmitting: boolean;
  submitError: string | null;
  isConfirmOpen: boolean;
}

const makeEmptySelection = (): RefundSelection => ({
  selectedUnitIds: new Set(),
  addonSelections: new Map(),
  includeDeliveryFee: false,
});

export function useRefundFlow(
  order: Order,
  onSuccess: (updatedOrder: Order) => void,
) {
  const [state, setState] = useState<RefundFlowState>({
    isOpen: false,
    step: 1,
    selection: makeEmptySelection(),
    reason: "",
    channel: "",
    isSubmitting: false,
    submitError: null,
    isConfirmOpen: false,
  });

  /**
   * Synchronous in-flight guard (P1).
   * useRef so it updates instantly — unlike setState which is async.
   * Prevents two rapid clicks from both starting a submission before
   * the first render with isSubmitting:true has committed.
   */
  const inFlightRef = useRef(false);

  /**
   * Idempotency key (P1).
   * Generated once when the confirm dialog opens, reused on every retry
   * of the same logical refund. A new key is only generated for a new
   * logical refund (i.e. when the confirm dialog re-opens after reset).
   */
  const idempotencyKeyRef = useRef<string>("");

  // ─── Open / close ──────────────────────────────────────────────────────────

  const openRefund = useCallback(() => {
    setState({
      isOpen: true,
      step: 1,
      selection: makeEmptySelection(),
      reason: "",
      channel: "",
      isSubmitting: false,
      submitError: null,
      isConfirmOpen: false,
    });
  }, []);

  /** Resets all state back to step 1 — called when the modal re-opens. */
  const reset = useCallback(() => {
    inFlightRef.current = false;
    idempotencyKeyRef.current = "";
    setState({
      isOpen: false,
      step: 1,
      selection: makeEmptySelection(),
      reason: "",
      channel: "",
      isSubmitting: false,
      submitError: null,
      isConfirmOpen: false,
    });
  }, []);

  const closeRefund = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false, isConfirmOpen: false }));
  }, []);

  // ─── Step navigation ────────────────────────────────────────────────────────

  const goToStep2 = useCallback(() => {
    setState((s) => ({ ...s, step: 2 }));
  }, []);

  const goToStep1 = useCallback(() => {
    setState((s) => ({ ...s, step: 1 }));
  }, []);

  // ─── Selection mutations ───────────────────────────────────────────────────

  const toggleUnit = useCallback((unitId: string, eligible: boolean) => {
    if (!eligible) return;
    setState((s) => {
      const next = new Set(s.selection.selectedUnitIds);
      const nextAddons = new Map(s.selection.addonSelections);

      if (next.has(unitId)) {
        next.delete(unitId);
        nextAddons.delete(unitId);
      } else {
        next.add(unitId);
      }

      return {
        ...s,
        selection: {
          ...s.selection,
          selectedUnitIds: next,
          addonSelections: nextAddons,
        },
      };
    });
  }, []);

  const toggleAddon = useCallback(
    (unitId: string, addonId: string, eligible: boolean) => {
      if (!eligible) return;
      setState((s) => {
        if (!s.selection.selectedUnitIds.has(unitId)) return s;

        const nextAddons = new Map(s.selection.addonSelections);
        const unitAddons = new Set(nextAddons.get(unitId) ?? []);

        if (unitAddons.has(addonId)) {
          unitAddons.delete(addonId);
        } else {
          unitAddons.add(addonId);
        }

        nextAddons.set(unitId, unitAddons);
        return {
          ...s,
          selection: { ...s.selection, addonSelections: nextAddons },
        };
      });
    },
    [],
  );

  const setDeliveryFee = useCallback((include: boolean) => {
    setState((s) => ({
      ...s,
      selection: { ...s.selection, includeDeliveryFee: include },
    }));
  }, []);

  /**
   * Select all eligible units with all their eligible add-ons, and the
   * delivery fee. Uses shared eligibility helpers (not raw status checks)
   * so the rule stays in one place.
   */
  const selectAll = useCallback(() => {
    const selectedUnitIds = new Set<string>();
    const addonSelections = new Map<string, Set<string>>();

    for (const unit of order.units) {
      if (!isUnitEligible(unit)) continue;
      selectedUnitIds.add(unit.unitId);

      const eligibleAddonIds = unit.addons
        .filter((addon) => isAddonEligible(addon, unit))
        .map((addon) => addon.addonId);

      if (eligibleAddonIds.length > 0) {
        addonSelections.set(unit.unitId, new Set(eligibleAddonIds));
      }
    }

    const includeDeliveryFee = isDeliveryFeeEligible(order);

    setState((s) => ({
      ...s,
      selection: { selectedUnitIds, addonSelections, includeDeliveryFee },
    }));
  }, [order]);

  /** Clear all selections. */
  const clearAll = useCallback(() => {
    setState((s) => ({ ...s, selection: makeEmptySelection() }));
  }, []);

  // ─── Review fields ─────────────────────────────────────────────────────────

  const setReason = useCallback((reason: RefundReason) => {
    setState((s) => ({ ...s, reason }));
  }, []);

  const setChannel = useCallback((channel: RefundChannel) => {
    setState((s) => ({ ...s, channel }));
  }, []);

  // ─── Confirm dialog ────────────────────────────────────────────────────────

  const openConfirm = useCallback(() => {
    // Generate the idempotency key exactly once per logical refund operation.
    // If the key is already set (retry after error), reuse it so the server
    // can detect and return the original committed result.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = uuidv4();
    }
    setState((s) => ({ ...s, isConfirmOpen: true, submitError: null }));
  }, []);

  const closeConfirm = useCallback(() => {
    setState((s) => ({ ...s, isConfirmOpen: false }));
  }, []);

  // ─── Submission ─────────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    const { selection, reason, channel } = state;
    if (!reason || !channel) return;

    // Synchronous in-flight guard — prevents double-submission from rapid clicks
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const request: SubmitRefundRequest = {
      idempotencyKey: idempotencyKeyRef.current,
      selectedUnitIds: Array.from(selection.selectedUnitIds),
      addonSelections: Object.fromEntries(
        Array.from(selection.addonSelections.entries()).map(([k, v]) => [
          k,
          Array.from(v),
        ]),
      ),
      includeDeliveryFee: selection.includeDeliveryFee,
      reason,
      channel,
    };

    setState((s) => ({ ...s, isSubmitting: true, submitError: null }));

    try {
      const result = await submitRefund(order.orderId, request);

      if (result.success) {
        const updatedOrder = rawOrderToOrder(result.updatedOrder);
        setState((s) => ({
          ...s,
          isSubmitting: false,
          isOpen: false,
          isConfirmOpen: false,
        }));
        onSuccess(updatedOrder);
      } else {
        // API returned a typed failure — preserve state so staff can retry
        setState((s) => ({
          ...s,
          isSubmitting: false,
          submitError: result.message,
        }));
      }
    } catch {
      // Unexpected network / runtime error
      setState((s) => ({
        ...s,
        isSubmitting: false,
        submitError: "An unexpected error occurred. Please try again.",
      }));
    } finally {
      // Always release the in-flight guard, even on unexpected throws
      inFlightRef.current = false;
    }
  }, [state, order.orderId, onSuccess]);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const calculation = calculateRefund(order, state.selection);
  const hasValidSelection =
    state.selection.selectedUnitIds.size > 0 ||
    state.selection.includeDeliveryFee;

  return {
    state,
    calculation,
    hasValidSelection,
    openRefund,
    closeRefund,
    reset,
    goToStep2,
    goToStep1,
    toggleUnit,
    toggleAddon,
    setDeliveryFee,
    selectAll,
    clearAll,
    setReason,
    setChannel,
    openConfirm,
    closeConfirm,
    submit,
  };
}
