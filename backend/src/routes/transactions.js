import { Router } from 'express';
import Transaction from '../models/Transaction.js';

const router = Router();

// GET /api/transactions?card=amex-gold&month=2026-03
router.get('/', async (req, res) => {
  console.log('GET /api/transactions', req.query);
  const { card, month } = req.query;
  const filter = {};
  if (card) filter.card = card;
  if (month) {
    const start = new Date(`${month}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    filter.date = { $gte: start, $lt: end };
  }
  const transactions = await Transaction.find(filter).sort({ Date: -1 });
  res.json(transactions);
});

export default router;