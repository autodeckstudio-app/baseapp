/** A short message to send an invoice summary by WhatsApp or the phone's share sheet. The customer's invoice link needs their login, so the text carries the facts instead. */
export function invoiceShareText(args: { number: string; totalPaise: number; studioName: string; studioPhone: string }): string {
  const rupees = (args.totalPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return `Invoice ${args.number} from ${args.studioName}. Total Rs ${rupees}. Questions: ${args.studioPhone}`;
}

export const whatsappShareUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;
