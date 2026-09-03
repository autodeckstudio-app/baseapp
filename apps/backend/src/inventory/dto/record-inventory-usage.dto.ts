import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** No `inventoryUsageId` field — backend-generated. No item-identity field
 * either — that comes from the validated `:id` route parameter (see
 * InventoryController), never the body. */
export const RecordInventoryUsageSchema = z.object({
  quantityUsed: z.number().int().positive(),
});

export class RecordInventoryUsageDto extends createZodDto(RecordInventoryUsageSchema) {}
