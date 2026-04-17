import mongoose, { Document } from 'mongoose';

export interface IBenefit extends Document {
  userId: mongoose.Types.ObjectId;
  accountId: string;
  benefitId: string;
  period: string;
  used: number;
  total: number;
  transactions: mongoose.Types.ObjectId[];
  lastModified: Date;
}

const benefitSchema = new mongoose.Schema<IBenefit>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: String, required: true },
  benefitId: { type: String, required: true },
  period: { type: String, required: true },
  used: { type: Number, default: 0 },
  total: { type: Number, required: true },
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
  lastModified: { type: Date, default: Date.now },
});

benefitSchema.index({ userId: 1, accountId: 1, benefitId: 1, period: 1 }, { unique: true });

export default mongoose.model<IBenefit>('Benefit', benefitSchema);
