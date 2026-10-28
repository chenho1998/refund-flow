import { useState, useCallback } from "react";
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
import { isUnitEligible, isDeliveryFeeEligible } from "../domain/eligibility";
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

  // Resets all state back to the initial step 1 — called when the modal re-opens
  const reset = useCallback(() => {
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
        // Deselect all add-ons for this unit when unit is deselected
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

  /** Select all eligible units (with all their eligible add-ons) and delivery fee. */
  const selectAll = useCallback(() => {
    const selectedUnitIds = new Set<string>();
    const addonSelections = new Map<string, Set<string>>();

    for (const unit of order.units) {
      if (!isUnitEligible(unit)) continue;
      selectedUnitIds.add(unit.unitId);

      const eligibleAddons = unit.addons
        .filter((a) => a.status === "paid")
        .map((a) => a.addonId);

      if (eligibleAddons.length > 0) {
        addonSelections.set(unit.unitId, new Set(eligibleAddons));
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
    setState((s) => ({
      ...s,
      selection: makeEmptySelection(),
    }));
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
    setState((s) => ({ ...s, isConfirmOpen: true, submitError: null }));
  }, []);

  const closeConfirm = useCallback(() => {
    // Closes only the confirm dialog; refund modal stays open with selections preserved
    setState((s) => ({ ...s, isConfirmOpen: false }));
  }, []);

  // ─── Submission ─────────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    const { selection, reason, channel } = state;
    if (!reason || !channel) return;

    const idempotencyKey = uuidv4();

    const request: SubmitRefundRequest = {
      idempotencyKey,
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
        setState((s) => ({
          ...s,
          isSubmitting: false,
          submitError: result.message,
        }));
      }
    } catch {
      setState((s) => ({
        ...s,
        isSubmitting: false,
        submitError: "An unexpected error occurred. Please try again.",
      }));
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
