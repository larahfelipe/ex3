import { GraphQLObjectType } from 'graphql';

import {
  CreateAssetMutation,
  DeleteAssetMutation,
  UpdateAssetMutation
} from '../modules/asset/mutations';
import {
  CreateTransactionMutation,
  DeleteTransactionMutation,
  UpdateTransactionMutation
} from '../modules/transaction/mutations';
import {
  CreateUserMutation,
  DeleteUserMutation,
  UpdateUserMutation
} from '../modules/user/mutations';

export const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  description: 'The root of all mutations',
  fields: () => ({
    createAsset: CreateAssetMutation,
    deleteAsset: DeleteAssetMutation,
    updateAsset: UpdateAssetMutation,
    createTransaction: CreateTransactionMutation,
    deleteTransaction: DeleteTransactionMutation,
    updateTransaction: UpdateTransactionMutation,
    createUser: CreateUserMutation,
    deleteUser: DeleteUserMutation,
    updateUser: UpdateUserMutation
  })
});
