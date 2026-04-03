import mongoose, { Document } from 'mongoose';

export interface IAccount extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: string;
  accountId: string;
  balances: {
    available: number | null;
    current: number;
    isoCurrencyCode: string | null;
    limit: number | null;
    unofficialCurrencyCode: string | null;
  };
  mask: string | null; 
  name: string;
  officialName: string | null;
  subtype: string;
  type: string;  
}

const itemSchema = new mongoose.Schema<IAccount>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId: { type: String },
  accountId: { type: String, unique: true },
  balances: {
    available: { type: Number, default: null },
    current: { type: Number, required: true },
    isoCurrencyCode: { type: String, default: null },
    limit: { type: Number, default: null },
    unofficialCurrencyCode: { type: String, default: null },
  },
  mask: { type: String, default: null },
  name: { type: String, required: true },
  officialName: { type: String, default: null },
  subtype: { type: String, required: true },
  type: { type: String, required: true },
});

export default mongoose.model<IAccount>('Account', itemSchema);
