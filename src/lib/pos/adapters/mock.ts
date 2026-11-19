import type {
  PosAdapter,
  PosBill,
  FetchBillParams,
  ConfirmPaymentParams,
} from "../adapter";

/**
 * MockPosAdapter — simulates a POS integration for development and demos.
 *
 *   fetchBill      -> returns a canned PosBill (simulates the POS sending a
 *                     bill for a table).
 *   confirmPayment -> no-op success (simulates the POS accepting the payment
 *                     confirmation). Throws when failure simulation is on, so
 *                     the retry/backoff mechanism can be demonstrated.
 *
 * In production, a real adapter (e.g. GenericRestPosAdapter) would call the
 * POS vendor's API for both directions.
 */

// Demo-only failure simulation flag. Toggled via the API to demonstrate the
// retry/backoff mechanism (simulates the POS being temporarily down).
let simulateFailure = false;
export function setMockPosFailure(enabled: boolean): void {
  simulateFailure = enabled;
}
export function getMockPosFailure(): boolean {
  return simulateFailure;
}

export const mockPosAdapter: PosAdapter = {
  code: "MOCK",
  async fetchBill(params: FetchBillParams): Promise<PosBill> {
    // Canned bill a real POS would send for a table.
    return {
      externalPosBillId: params.externalPosBillId,
      currency: "MZN",
      items: [
        { name: "Cerveja 2M", quantity: 2, unitPriceMinor: 7500 },
        { name: "Cambarito", quantity: 1, unitPriceMinor: 18000 },
      ],
      adjustments: [
        { type: "SERVICE", label: "Serviço 10%", amountMinor: 3300 },
      ],
      totalMinor: 36300,
    };
  },
  async confirmPayment(_params: ConfirmPaymentParams): Promise<void> {
    if (simulateFailure) {
      throw new Error("simulated_pos_down");
    }
    // Real adapter would call the POS API to mark the bill paid.
    // Mock: no-op (success) when not simulating failure.
  },
  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return {
      ok: !simulateFailure,
      detail: simulateFailure ? "simulated down" : undefined,
    };
  },
};
