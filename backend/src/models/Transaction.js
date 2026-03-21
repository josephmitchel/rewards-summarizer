import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  Date: Date,
  Card: Number,
  Status: String,
  Description: String,
  Multiplier: String,
  Amount: String,
  Cash: String,
});

export default mongoose.model('transactions', transactionSchema);
