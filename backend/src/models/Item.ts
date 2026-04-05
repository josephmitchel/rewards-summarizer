import mongoose, { Document } from 'mongoose';

export interface IItem extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: string;
  accessToken: string | null;
  institutionId: string | null;
  institutionName: string | null;
  cursor: string | null;
  webhook: string | null;
  error: object | null;
  availableProducts: string[];
  billedProducts: string[];
  products: string[];
  consentedProducts: string[];
  consentExpirationTime: string | null;
  updateType: string | null;
  createdAt: string | null;
  consentedUseCases: string[];
  consentedDataScopes: string[];
}

const itemSchema = new mongoose.Schema<IItem>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId: { type: String, unique: true },
  accessToken: { type: String, default: null },
  institutionId: { type: String, default: null },
  institutionName: { type: String, default: null },
  cursor: { type: String, default: null },
  webhook: { type: String, default: null },
  error: { type: mongoose.Schema.Types.Mixed, default: null },
  availableProducts: { type: [String], default: [] },
  billedProducts: { type: [String], default: [] },
  products: { type: [String], default: [] },
  consentedProducts: { type: [String], default: [] },
  consentExpirationTime: { type: String, default: null },
  updateType: { type: String, default: null },
  createdAt: { type: String, default: null },
  consentedUseCases: { type: [String], default: [] },
  consentedDataScopes: { type: [String], default: [] },
}, { timestamps: false });

export default mongoose.model<IItem>('Item', itemSchema);
