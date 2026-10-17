/** Where visitors can send a tip. UPI is first because most users pay from India. */

// TODO(owner): replace the placeholder with the real UPI ID before this ships.
export const UPI_ID = "yourname@upi";
export const UPI_PAYEE = "Savinyu";

/**
 * A UPI intent link (opens GPay, PhonePe, Paytm… on a phone). The ID is left unencoded: UPI IDs
 * are only letters, digits, `.`, `-`, `_` and one `@`, and some apps reject `%40`.
 */
export function upiPayUrl(): string {
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_PAYEE)}&cu=INR&tn=${encodeURIComponent("Support CodeLogs")}`;
}
