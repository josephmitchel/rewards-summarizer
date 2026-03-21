import { Router } from 'express';
import Transaction from '../models/Transaction.js';

const router = Router();

router.get('/', async (req, res) => {
  console.log('GET /api/transactions', req.query);
  const { Date: date } = req.query;
  console.log(date);
  const filter = {};

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    filter.Date = { $gte: start, $lt: end };
  }

  const transactions = await Transaction.find(filter).sort({ Date: -1 });
  res.json(transactions);
});

export default router;