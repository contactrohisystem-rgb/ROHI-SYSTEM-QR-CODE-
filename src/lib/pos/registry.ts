import type { PosAdapterCode } from "@prisma/client";
import type { PosAdapter } from "./adapter";
import { mockPosAdapter } from "./adapters/mock";

/**
 * POS adapter registry. Add an adapter here once its implementation is ready.
 * The sync service resolves adapters through this registry only.
 *
 * MOCK is always available (development/demo).
 * GENERIC_REST (a real REST-based POS adapter) is the likely first real
 * integration; it slots in here without touching anything else.
 */
const adapters: Partial<Record<PosAdapterCode, PosAdapter>> = {
  MOCK: mockPosAdapter,
  // GENERIC_REST: genericRestPosAdapter,  // future
};

export function getAdapter(code: PosAdapterCode): PosAdapter | null {
  return adapters[code] ?? null;
}
