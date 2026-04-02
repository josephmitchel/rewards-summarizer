import mongoose, { Document } from 'mongoose';

export interface IItem extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: string;
  accessToken: string | null;
  institutionId: string | null;
  institutionName: string | null;
}

const itemSchema = new mongoose.Schema<IItem>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId: { type: String, unique: true },
  accessToken: { type: String, default: null },
  institutionId: { type: String, default: null },
  institutionName: { type: String, default: null },
});

export default mongoose.model<IItem>('Item', itemSchema);
