import { createZodDto } from 'nestjs-zod';
import { PackageDefinitionSchema } from '@autodeck/domain';

/** Same derivation as CreatePackageDefinitionSchema, with every field made
 * optional for a partial update (matching UpdateServiceSchema/
 * UpdateCustomerSchema's existing convention). `validityDuration` is
 * updated as a whole object, not field-by-field within it — consistent
 * with how every other nested/composite field in this codebase is treated
 * as one atomic unit on update. */
export const UpdatePackageDefinitionSchema = PackageDefinitionSchema.omit({ packageDefinitionId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export class UpdatePackageDefinitionDto extends createZodDto(UpdatePackageDefinitionSchema) {}
