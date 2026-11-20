import express from 'express';
import { collections } from '../db.js';

const router = express.Router();

// GET /saved-jobs - get user's saved job IDs & populated jobs
router.get('/', async (req, res) => {
  try {
    const { userEmail, userId } = req.query;

    if (!userEmail && !userId) {
      return res.status(400).json({ success: false, error: "userEmail or userId is required" });
    }

    const filter = {};
    if (userEmail) filter.userEmail = userEmail;
    if (userId) filter.userId = userId;

    const savedRecords = await collections.savedJobs().find(filter).toArray();
    const savedJobIds = savedRecords.map((r) => r.jobId);

    // Populate actual jobs
    const jobs = await collections.jobs().find({ id: { $in: savedJobIds } }).toArray();

    res.json({
      success: true,
      savedJobIds,
      jobs,
    });
  } catch (err) {
    console.error("Error fetching saved jobs:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /saved-jobs - toggle or save a job
router.post('/', async (req, res) => {
  try {
    const { userEmail, userId, jobId } = req.body;

    if ((!userEmail && !userId) || !jobId) {
      return res.status(400).json({ success: false, error: "userEmail/userId and jobId are required" });
    }

    const filter = { jobId };
    if (userEmail) filter.userEmail = userEmail;
    if (userId) filter.userId = userId;

    const existing = await collections.savedJobs().findOne(filter);

    if (existing) {
      // If already saved, remove it (toggle behavior)
      await collections.savedJobs().deleteOne({ _id: existing._id });
      return res.json({ success: true, action: "removed", jobId, isSaved: false });
    }

    const newRecord = {
      ...filter,
      createdAt: new Date().toISOString(),
    };

    await collections.savedJobs().insertOne(newRecord);
    res.status(201).json({ success: true, action: "saved", jobId, isSaved: true });
  } catch (err) {
    console.error("Error saving job:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /saved-jobs/:jobId - unbookmark
router.delete('/:jobId', async (req, res) => {
  try {
    const { userEmail, userId } = req.query;
    const jobId = req.params.jobId;

    const filter = { jobId };
    if (userEmail) filter.userEmail = userEmail;
    if (userId) filter.userId = userId;

    const result = await collections.savedJobs().deleteOne(filter);
    res.json({
      success: true,
      jobId,
      isSaved: false,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Error removing saved job:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
