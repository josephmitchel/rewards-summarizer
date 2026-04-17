import mongoose, { Document } from 'mongoose';

export interface ICard extends Document {
  name: string;
  network: string;
  rewardType: 'cashback' | 'points';
  rewardUnit: string;
  baseRedemptionValue: number;
  rewards: {
    category: string;
    rate: number;
    cap?: {
      period: string;
      amount: number;
      rate: number;
    };
  }[];
  annualFee: number;
  isActive: boolean;
  institutionId?: string;
  institutionName?: string;
  benefits?: {
    id: string;
    name: string;
    description: string;
    type: string;
    amount: number;
    period: 'monthly' | 'annually' | 'semi-annually';
    trackingType: 'automatic' | 'manual';
    merchants?: string[];
  }[];
}

const cardSchema = new mongoose.Schema<ICard>({
  name: { type: String, required: true },
  network: { type: String, required: true },
  rewardType: { type: String, enum: ['cashback', 'points'], required: true },
  rewardUnit: { type: String, required: true },
  baseRedemptionValue: { type: Number, required: true },
  rewards: [{
    category: String,
    rate: Number,
    cap: { period: String, amount: Number, rate: Number },
    _id: false,
  }],
  annualFee: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  institutionId: String,
  institutionName: String,
  benefits: [{
    id: String,
    name: String,
    description: String,
    type: { type: String },
    amount: Number,
    period: String,
    trackingType: { type: String, enum: ['automatic', 'manual'], default: 'automatic' },
    merchants: [String],
    _id: false,
  }],
});

export default mongoose.model<ICard>('Card', cardSchema);
