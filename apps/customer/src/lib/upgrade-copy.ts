/** Words for the upgrade confirmation. The number is the exact count of unused washes that end with the old plan. */
export function upgradeConfirmCopy(lost: number, tier: string, newName: string, priceLabel: string): { title: string; body: string; cancel: string; confirm: string } {
  const washes = lost === 1 ? "1 unused wash" : `${lost} unused washes`;
  return {
    title: "Confirm upgrade",
    body: lost > 0
      ? `You will lose ${washes} left on your ${tier} plan. Your ${newName} plan starts fresh today for 30 days. You pay ${priceLabel} now.`
      : `You have no unused washes left on your ${tier} plan. Your ${newName} plan starts fresh today for 30 days. You pay ${priceLabel} now.`,
    cancel: "Cancel",
    confirm: "Confirm upgrade",
  };
}
