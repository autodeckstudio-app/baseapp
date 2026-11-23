/** Request/response is conversation only, never a booking, quote or work authority. */
export type CoordinationRequestRead = {
  id: string;
  studioId: string;
  customerId: string;
  vehicleId: string;
  customerName: string | null;
  vehicleLabel: string;
  lines: { serviceId: string; name: string }[];
  notes: string;
  status: "requested" | "answered" | "withdrawn";
  version: number;
  reply: string | null;
  createdAt: string;
  updatedAt: string;
};
