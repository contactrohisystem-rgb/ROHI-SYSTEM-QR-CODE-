import { NextResponse } from "next/server";
import { z } from "zod";
import { pollPayment, PaymentError } from "@/lib/payments/service";

const schema = z.object({
  tableToken: z.string().min(1),
  paymentId: z.string().min(1),
});

// POST /api/payments/poll — guest polls a payment's status. Token-gated so a
// paymentId alone is never sufficient.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const result = await pollPayment({
      tableToken: parsed.data.tableToken,
      paymentId: parsed.data.paymentId,
    });
    return NextResponse.json({ payment: result });
  } catch (e) {
    if (e instanceof PaymentError) {
      const status =
        e.code === "invalid_table" || e.code === "payment_not_found"
          ? 404
          : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
