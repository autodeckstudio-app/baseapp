// Brand ranges shown in the app. Every line below comes from the brand's own
// site or catalogue (source noted per brand). Warranty appears only where the
// brand states it. Prices are never listed here: the app says "ask the studio".
// Whether the studio fits each item is for the owner to confirm.
export interface BrandItem {
  name: string;
  kind: "PPF" | "Coating" | "Other";
  note?: string;
  warranty?: string;
}
export interface Brand {
  name: string;
  blurb: string;
  source: string;
  items: BrandItem[];
}

export const BRANDS: Brand[] = [
  {
    name: "XPEL",
    blurb: "Paint protection film and ceramic coatings",
    source: "xpel.com/warranty-information",
    items: [
      { name: "Ultimate Plus", kind: "PPF", note: "Gloss, self-healing film", warranty: "10-year limited warranty" },
      { name: "Stealth", kind: "PPF", note: "Satin finish film", warranty: "10-year limited warranty" },
      { name: "Fusion Plus Premium v2", kind: "Coating" },
      { name: "Fusion Plus Classic", kind: "Coating" },
      { name: "Fusion Plus Paint & PPF", kind: "Coating" },
      { name: "Fusion Plus Satin", kind: "Coating" },
      { name: "Fusion Plus Lite", kind: "Coating" },
      { name: "Fusion Plus Glass", kind: "Coating" },
      { name: "Fusion Plus Plastic & Trim", kind: "Coating" },
    ],
  },
  {
    name: "Garware",
    blurb: "Paint protection film and ceramic coating",
    source: "garwarehitechfilms.com",
    items: [
      { name: "Premium PPF", kind: "PPF", note: "Gloss film", warranty: "8-year warranty" },
      { name: "Plus PPF", kind: "PPF", warranty: "5-year warranty" },
      { name: "Protect PPF", kind: "PPF", note: "Glossy, self-healing", warranty: "3-year warranty" },
      { name: "Coloured PPF", kind: "PPF" },
      { name: "Ceramic Coating", kind: "Coating", note: "9H coating", warranty: "3-year warranty" },
    ],
  },
  {
    name: "LLumar",
    blurb: "Paint protection film",
    source: "llumar.com/en/paint-protection-film",
    items: [
      { name: "Platinum Gloss", kind: "PPF", warranty: "10-year manufacturer's limited warranty (restrictions apply, ask the studio)" },
      { name: "Platinum Matte", kind: "PPF" },
      { name: "Platinum Extra", kind: "PPF", note: "Thicker film for higher impact resistance" },
      { name: "Gloss and Matte", kind: "PPF", warranty: "5-year manufacturer's limited warranty (restrictions apply, ask the studio)" },
    ],
  },
  {
    name: "3M",
    blurb: "Paint protection film and ceramic coating",
    source: "3mindia.in",
    items: [
      { name: "Scotchgard Paint Protection Film Pro Series 200", kind: "PPF", warranty: "10-year consumer warranty (see warranty card)" },
      { name: "Ceramic Coating", kind: "Coating", note: "Brand says durable up to five years with care" },
      { name: "Ceramic Boost", kind: "Coating" },
    ],
  },
  {
    name: "Kovalent",
    blurb: "Ceramic coatings",
    source: "kovalentcoatings.com/products",
    items: [
      { name: "Borophene", kind: "Coating", note: "9H+ hardness, boron nitride formula", warranty: "Brand site says 9 years durability" },
      { name: "Graphene", kind: "Coating", warranty: "7-year warranty (brand site)" },
      { name: "Graphene Matrix", kind: "Coating", note: "Brand says it self-heals minor swirls when heat-activated" },
      { name: "Prolong", kind: "Coating", note: "9H ceramic coating" },
      { name: "Prolong Light", kind: "Coating" },
      { name: "PowerShield", kind: "Coating" },
      { name: "Overlay", kind: "Coating", note: "Coating made for use on PPF" },
      { name: "Restore", kind: "Other", note: "For leather, vinyl and plastic" },
      { name: "Matte", kind: "Other" },
      { name: "Fabric", kind: "Other" },
      { name: "Glass", kind: "Other" },
    ],
  },
  {
    name: "Fireball",
    blurb: "Ceramic coatings",
    source: "fireballkorea.com/ceramic-coating",
    items: [
      { name: "Dok Do", kind: "Coating", note: "9H flagship, top coat and base coat" },
      { name: "Butterfly Graphene", kind: "Coating" },
      { name: "Butterfly", kind: "Coating" },
      { name: "Typhoon", kind: "Coating" },
      { name: "Talon", kind: "Coating" },
      { name: "Devil's Blood", kind: "Coating" },
      { name: "Silla", kind: "Coating" },
      { name: "Aegis", kind: "Coating" },
    ],
  },
];
