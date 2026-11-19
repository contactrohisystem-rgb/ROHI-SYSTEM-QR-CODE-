import QRCode from "qrcode";

/**
 * Generates a QR code as a PNG data URL (server-side only).
 *
 * Used in the restaurant dashboard to render the QR for each table token.
 * The QR encodes the guest /pay URL with the opaque table token, e.g.:
 *   https://pay.rohi.co.mz/pay?table=tbl_<hex>
 *
 * It never contains bill data or amounts.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 2,
    width: 320,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}
