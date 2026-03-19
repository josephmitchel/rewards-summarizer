import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  date: Date,
  description: String,
  amount: Number,
  category: String,
  card: String,       // e.g. 'amex-gold', 'amex-blue'
});

export default mongoose.model('transactions', transactionSchema);