import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Deliberately has NO `currentStock` field: stock is a contested counter
 * that must only ever change through `restock` or usage-recording, both of
 * which run inside a Firestore transaction — never through this plain
 * batch-based update. */
export const UpdateInventoryItemSchema = z
  .object({
    name: z.string().min(1).optional(),
    lowStockThreshold: z.number().int().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export class UpdateInventoryItemDto extends createZodDto(UpdateInventoryItemSchema) {}
