import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import { seedDatabase } from './seed.js';

import jobsRouter from './routes/jobs.js';
import companiesRouter from './routes/companies.js';
import applicationsRouter from './routes/applications.js';
import savedJobsRouter from './routes/savedJobs.js';
import usersRouter from './routes/users.js';
import billingRouter from './routes/billing.js';
import adminRouter from './routes/admin.js';

const app = express();
const port = process.env.PORT || 5000;

// Middlewares
const rawOrigins = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000,http://127.0.0.1:3000';
const configuredOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, server-to-server, curl) or matched origins
    if (!origin) return callback(null, true);
    if (
      configuredOrigins.includes(origin) ||
      configuredOrigins.includes('*') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }
    return callback(new Error(`Origin '${origin}' not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json());

// Base health check
app.get('/', (req, res) => {
  res.json({
    status: "ok",
    message: "Hireloop API is looping!",
    timestamp: new Date().toISOString(),
    endpoints: [
      "/jobs",
      "/companies",
      "/applications",
      "/saved-jobs",
      "/users",
      "/subscriptions/:userEmail",
      "/payments",
      "/admin/stats",
    ],
  });
});

// Seed trigger endpoint (for easy testing or reset)
app.post('/api/seed', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    await seedDatabase(force);
    res.json({ success: true, message: `Database seed executed (force=${force})` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount Routes (supporting both direct path and /api prefix)
app.use('/jobs', jobsRouter);
app.use('/api/jobs', jobsRouter);

app.use('/companies', companiesRouter);
app.use('/api/companies', companiesRouter);

app.use('/applications', applicationsRouter);
app.use('/api/applications', applicationsRouter);

app.use('/saved-jobs', savedJobsRouter);
app.use('/api/saved-jobs', savedJobsRouter);

app.use('/users', usersRouter);
app.use('/api/users', usersRouter);

app.use('/', billingRouter);
app.use('/api', billingRouter);

app.use('/admin', adminRouter);
app.use('/api/admin', adminRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
});

// Connect to MongoDB and start server
async function startServer() {
  try {
    await connectDB();
    await seedDatabase(false);

    app.listen(port, () => {
      console.log(`HireLoop server is running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Failed to start HireLoop server:", err);
    process.exit(1);
  }
}

startServer();
