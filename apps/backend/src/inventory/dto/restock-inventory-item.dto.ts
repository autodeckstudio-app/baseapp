import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RestockInventoryItemSchema = z.object({
  quantityReceived: z.number().int().positive(),
});

export class RestockInventoryItemDto extends createZodDto(RestockInventoryItemSchema) {}
