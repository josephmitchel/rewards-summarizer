import mongoose, { Document } from 'mongoose';

export interface ITransaction extends Document {
  userId?: mongoose.Types.ObjectId;
  itemId?: string;
  accountId?: string;
  accountOwner?: string;
  amount?: number;
  authorizedDate?: Date;
  authorizedDatetime?: Date;
  category?: string;
  categoryId?: string;
  checkNumber?: number;
  counterparties?: {
    confidenceLevel?: string;
    entityId?: string;
    logoUrl?: string;
    name?: string;
    phoneNumber?: string;
    type?: string;
    website?: string;
  }[];
  date?: Date;
  datetime?: Date;
  isoCurrencyCode?: string;
  location?: {
    address?: string;
    city?: string;
    country?: string;
    lat?: number;
    lon?: number;
    postalCode?: string;
    region?: string;
    storeNumber?: string;
  };
  logoUrl?: string;
  merchantIdentityId?: string;
  merchantName?: string;
  name?: string;
  paymentChannel?: string;
  paymentMeta?: {
    byOrderOf?: string;
    payee?: string;
    payer?: string;
    paymentMethod?: string;
    paymentProcessor?: string;
    ppdId?: string;
    reason?: string;
    referenceNumber?: string;
  };
  pending?: boolean;
  pendingTransactionId?: string;
  personalFinanceCategory?: {
    confidenceLevel?: string;
    detailed?: string;
    primary?: string;
    version?: string;
  };
  personalFinanceCategoryIconUrl?: string;
  transactionCode?: string;
  transactionId?: string;
  transactionType?: string;
  unofficialCurrencyCode?: string;
  website?: string;
}

const counterpartySchema = new mongoose.Schema({
  confidenceLevel: String,
  entityId: String,
  logoUrl: String,
  name: String,
  phoneNumber: String,
  type: String,
  website: String,
}, { _id: false });

const transactionSchema = new mongoose.Schema<ITransaction>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  itemId: String,
  accountId: String,
  accountOwner: String,
  amount: Number,
  authorizedDate: Date,
  authorizedDatetime: Date,
  category: String,
  categoryId: String,
  checkNumber: Number,
  counterparties: [counterpartySchema],
  date: Date,
  datetime: Date,
  isoCurrencyCode: String,
  location: {
    address: String,
    city: String,
    country: String,
    lat: Number,
    lon: Number,
    postalCode: String,
    region: String,
    storeNumber: String,
  },
  logoUrl: String,
  merchantIdentityId: String,
  merchantName: String,
  name: String,
  paymentChannel: String,
  paymentMeta: {
    byOrderOf: String,
    payee: String,
    payer: String,
    paymentMethod: String,
    paymentProcessor: String,
    ppdId: String,
    reason: String,
    referenceNumber: String,
  },
  pending: Boolean,
  pendingTransactionId: String,
  personalFinanceCategory: {
    confidenceLevel: String,
    detailed: String,
    primary: String,
    version: String,
  },
  personalFinanceCategoryIconUrl: String,
  transactionCode: String,
  transactionId: { type: String, unique: true },
  transactionType: String,
  unofficialCurrencyCode: String,
  website: String,
});

export default mongoose.model<ITransaction>('Transaction', transactionSchema);
