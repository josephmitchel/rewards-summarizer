import mongoose, { Document } from 'mongoose';
import { Transaction as PlaidTransaction } from 'plaid';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: string;
  accountId: string;
  transactionId: string;
  category: string;
  plaidTransaction: PlaidTransaction;
  cashback: number;
  points: number;

  // Fields that a user is allowed to override for categorization purposes
  overrides?: {
    category?: string;
  };
}

const transactionSchema = new mongoose.Schema<ITransaction>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId: { type: String, required: true },
  accountId: { type: String, required: true },
  transactionId: { type: String, required: true, unique: true },
  category: { type: String, default: 'Other' },
  plaidTransaction: { type: mongoose.Schema.Types.Mixed, required: true },
  overrides: {
    category: String,
  },
  cashback: { type: Number, required: false },
  points: { type: Number, required: false }
});

export default mongoose.model<ITransaction>('Transaction', transactionSchema);
