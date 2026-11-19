import { NextResponse } from "next/server";
import { z } from "zod";
import { PaymentProviderCode } from "@prisma/client";
import {
  initiatePaymentForGuest,
  PaymentError,
} from "@/lib/payments/service";

const schema = z.object({
  tableToken: z.string().min(1),
  providerCode: z.nativeEnum(PaymentProviderCode),
  customerIdentifier: z.string().max(30).optional(),
});

// POST /api/payments/initiate — guest initiates a payment for the table's
// active bill. The table token (from the QR) is the only credential.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await initiatePaymentForGuest({
      tableToken: parsed.data.tableToken,
      providerCode: parsed.data.providerCode,
      customerIdentifier: parsed.data.customerIdentifier,
    });
    return NextResponse.json({ payment: result }, { status: 201 });
  } catch (e) {
    if (e instanceof PaymentError) {
      const status =
        e.code === "invalid_table"
          ? 404
          : e.code === "no_active_bill"
            ? 409
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
