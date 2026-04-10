import mongoose, { Document } from 'mongoose';

export interface ITransactionCategory extends Document {
  plaidCategory: string;
  userCategory: string;
}

const transactionCategorySchema = new mongoose.Schema<ITransactionCategory>({
  plaidCategory: { type: String, required: true },
  userCategory: { type: String, required: true },
});

export default mongoose.model<ITransactionCategory>('TransactionCategory', transactionCategorySchema, 'transactionCategories');
