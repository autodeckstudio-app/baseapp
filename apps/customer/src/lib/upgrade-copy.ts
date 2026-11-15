/** Words for the upgrade confirmation. Numbers are exact: what is left on the old plan ends with it. */
export function upgradeConfirmCopy(i: { lostWashes: number; lostPickups: number; tier: string; newName: string; priceLabel: string; fullPrice: boolean }): { title: string; body: string; cancel: string; confirm: string } {
  const w = i.lostWashes === 1 ? "1 unused wash" : `${i.lostWashes} unused washes`;
  const p = i.lostPickups === 1 ? "1 free pickup" : `${i.lostPickups} free pickups`;
  const lost = [i.lostWashes > 0 ? w : "", i.lostPickups > 0 ? p : ""].filter(Boolean).join(" and ");
  const loss = lost ? `You will lose ${lost} left on your ${i.tier} plan.` : `You have no unused washes or pickups left on your ${i.tier} plan.`;
  const price = i.fullPrice
    ? `Because you have used part of your ${i.tier} plan, you pay the full ${i.newName} price, ${i.priceLabel}.`
    : `You pay only the difference, ${i.priceLabel}.`;
  return { title: "Confirm upgrade", body: `${loss} Your ${i.tier} plan ends when you pay. ${price} Your ${i.newName} plan starts fresh today for 30 days.`, cancel: "Cancel", confirm: "Confirm upgrade" };
}
