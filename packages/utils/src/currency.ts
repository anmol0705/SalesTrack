/**
 * Formats a number as Indian Rupees with Indian numbering system (lakhs/crores).
 * e.g. 123456 → ₹1,23,456
 */
export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return formatted;
}
