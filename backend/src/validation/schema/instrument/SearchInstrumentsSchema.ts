import { z } from 'zod';

import { InstrumentSearchTermSchema } from './GetAllInstrumentsSchema';

export const SearchInstrumentsSchema = z.object({
  query: InstrumentSearchTermSchema
});
