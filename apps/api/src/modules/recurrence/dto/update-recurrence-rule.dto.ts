import { PartialType } from '@nestjs/swagger';

import { CreateRecurrenceRuleDto } from './create-recurrence-rule.dto';

/**
 * Request body of `PATCH /api/recurrence-rules/:id` — every field of the create body, all
 * optional. `type` is left writable: values are copied onto each transaction at generation time
 * and already-generated history is immutable (ADR-0014), so changing it does not rewrite the past
 * the way `Transaction.type` would (M4-T04, `TRANSACTION_TYPE_IMMUTABLE`).
 */
export class UpdateRecurrenceRuleDto extends PartialType(CreateRecurrenceRuleDto) {}
