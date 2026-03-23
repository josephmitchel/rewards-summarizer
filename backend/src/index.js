import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import router from './routes/routes.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/api', router);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    app.listen(3001, () => console.log('Server running on port 3001'));
  })
  .catch(err => console.error(err));
