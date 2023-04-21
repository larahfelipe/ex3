import type { ConnectionArguments } from 'graphql-relay';

import type { Asset } from '@/domain/models';

export type AssetQueryArgs = ConnectionArguments & Pick<Asset, 'symbol'>;
