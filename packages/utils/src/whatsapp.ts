import { formatCurrency } from './currency';

/**
 * Generates a wa.me deep link with a pre-filled Hindi/English payment receipt message.
 * Opens WhatsApp with the message pre-populated for the given retailer's phone number.
 */
export function generateWhatsAppReceiptLink(
  phone: string,
  amount: number,
  businessName: string,
  refId: string
): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedAmount = formatCurrency(amount);

  const message = [
    `🧾 *Payment Receipt / भुगतान रसीद*`,
    ``,
    `नमस्ते! आपका भुगतान प्राप्त हो गया है।`,
    `Hello! Your payment has been received.`,
    ``,
    `🏢 *Business:* ${businessName}`,
    `💰 *Amount / राशि:* ${formattedAmount}`,
    `🔖 *Ref ID:* ${refId}`,
    ``,
    `धन्यवाद! Thank you for your business. 🙏`,
  ].join('\n');

  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}
