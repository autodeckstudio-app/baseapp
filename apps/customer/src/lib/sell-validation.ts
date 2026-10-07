export type SellForm = { make: string; model: string; variant: string; year: string; km: string; fuel: string; gearbox: string; body: string; owners: string; colour: string; area: string; price: string; description: string; name: string; phone: string; reg: string };
export type SellErrors = Partial<Record<keyof SellForm | "photos", string | undefined>>;
export const sellNumber = (s: string): number => Number(s.replace(/,/g, "").trim());
const integer = (s: string, min: number, max: number) => /^\d+$/.test(s.replace(/,/g, "").trim()) && sellNumber(s) >= min && sellNumber(s) <= max;
export function validateSellStep(f: SellForm, step: number, photoCount: number, year = new Date().getFullYear()): SellErrors {
  const errors: SellErrors = {};
  if (step === 0) {
    if (!f.make.trim()) errors.make = "Enter the car make.";
    if (!f.model.trim()) errors.model = "Enter the car model.";
    if (!/^\d{4}$/.test(f.year.trim()) || !integer(f.year, 1990, year + 1)) errors.year = `Enter a year between 1990 and ${year + 1}.`;
    if (!integer(f.km, 0, 1500000)) errors.km = "Enter kilometres driven between 0 and 1,500,000.";
    if (!integer(f.owners, 1, 10)) errors.owners = "Enter an owner count between 1 and 10.";
    if (!f.colour.trim()) errors.colour = "Enter the car colour.";
    if (!f.area.trim()) errors.area = "Enter your area or city.";
    if (!["petrol", "diesel", "cng", "electric", "hybrid"].includes(f.fuel)) errors.fuel = "Choose a fuel type.";
    if (!["manual", "automatic"].includes(f.gearbox)) errors.gearbox = "Choose a gearbox.";
    if (f.body && !["hatchback", "sedan", "suv", "muv", "coupe", "other"].includes(f.body)) errors.body = "Choose a body type or leave it blank.";
  }
  if (step === 1) {
    if (!integer(f.price, 1000, 100000000)) errors.price = "Enter an asking price between ₹1,000 and ₹10 crore.";
    if (!photoCount) errors.photos = "Add at least one car photo.";
    if (/(https?:\/\/|www\.|\d[\d\s-]{8,}\d)/i.test(f.description)) errors.description = "Remove phone numbers and links from the description.";
  }
  if (step === 2) {
    if (!f.name.trim()) errors.name = "Enter your name.";
    const phone = f.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "Enter a valid 10-digit mobile number.";
  }
  return errors;
}
