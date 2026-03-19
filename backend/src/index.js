import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import transactionsRouter from './routes/transactions.js';

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:5173' })); // your Vite dev server
app.use(express.json());

app.use('/api/transactions', transactionsRouter);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    app.listen(3001, () => console.log('Server running on port 3001'));
  })
  .catch(err => console.error(err));