import express from 'express';
import { collections, buildIdQuery } from '../db.js';

const router = express.Router();

// GET /jobs - search & filter
router.get('/', async (req, res) => {
  try {
    const {
      q,
      search,
      category,
      jobType,
      isRemote,
      salaryMin,
      salaryMax,
      experienceLevel,
      companyId,
      recruiterEmail,
      status,
      featured,
      sort,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    // Keyword search
    const queryTerm = q || search;
    if (queryTerm && typeof queryTerm === 'string' && queryTerm.trim()) {
      const regex = new RegExp(queryTerm.trim(), 'i');
      filter.$or = [
        { title: regex },
        { companyName: regex },
        { overview: regex },
        { tags: regex },
        { location: regex },
      ];
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (jobType && jobType !== 'All') {
      filter.jobType = jobType;
    }

    if (isRemote !== undefined && isRemote !== '') {
      filter.isRemote = isRemote === 'true';
    }

    if (salaryMin) {
      filter.salaryMin = { $gte: Number(salaryMin) };
    }

    if (salaryMax) {
      filter.salaryMax = { $lte: Number(salaryMax) };
    }

    if (experienceLevel && experienceLevel !== 'All') {
      filter.experienceLevel = experienceLevel;
    }

    if (companyId) {
      filter.companyId = companyId;
    }

    if (recruiterEmail) {
      filter.recruiterEmail = recruiterEmail;
    }

    if (status) {
      filter.status = status;
    }

    if (featured !== undefined && featured !== '') {
      filter.featured = featured === 'true';
    }

    // Sorting
    let sortOptions = { createdAt: -1 };
    if (sort === 'salary-desc') {
      sortOptions = { salaryMax: -1 };
    } else if (sort === 'salary-asc') {
      sortOptions = { salaryMin: 1 };
    } else if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await collections.jobs().countDocuments(filter);
    const jobs = await collections.jobs()
      .find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      jobs,
    });
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /jobs/:id - single job
router.get('/:id', async (req, res) => {
  try {
    const job = await collections.jobs().findOne(buildIdQuery(req.params.id));
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    res.json({ success: true, job });
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /jobs - create job
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    if (!body.title || !body.companyId) {
      return res.status(400).json({ success: false, error: "Title and Company are required" });
    }

    const idSlug = body.id || (
      `${body.companyId}-${body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString().slice(-4)}`
    );

    const newJob = {
      id: idSlug,
      title: body.title,
      companyId: body.companyId,
      companyName: body.companyName || "Acme Corp",
      companyLogo: body.companyLogo || "/logos/google.png",
      category: body.category || "Engineering",
      jobType: body.jobType || "Full-time",
      status: body.status || "Active",
      location: body.location || "Remote",
      isRemote: body.isRemote !== undefined ? body.isRemote : true,
      salaryMin: Number(body.salaryMin) || 100000,
      salaryMax: Number(body.salaryMax) || 150000,
      currency: body.currency || "USD",
      salary: body.salary || `$${Number(body.salaryMin || 100000).toLocaleString()} - $${Number(body.salaryMax || 150000).toLocaleString()}`,
      experienceLevel: body.experienceLevel || "Mid",
      postedAt: "Just now",
      deadline: body.deadline || "Dec 31, 2026",
      overview: body.overview || "",
      responsibilities: Array.isArray(body.responsibilities) ? body.responsibilities : [],
      requirements: Array.isArray(body.requirements) ? body.requirements : [],
      benefits: Array.isArray(body.benefits) ? body.benefits : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      featured: Boolean(body.featured),
      recruiterEmail: body.recruiterEmail || "",
      recruiterId: body.recruiterId || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await collections.jobs().insertOne(newJob);
    res.status(201).json({ success: true, job: newJob, insertedId: result.insertedId });
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /jobs/:id - update job
router.patch('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData._id;

    const result = await collections.jobs().findOneAndUpdate(
      buildIdQuery(req.params.id),
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    res.json({ success: true, job: result });
  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /jobs/:id - delete job
router.delete('/:id', async (req, res) => {
  try {
    const result = await collections.jobs().deleteOne(buildIdQuery(req.params.id));
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    res.json({ success: true, message: "Job deleted successfully" });
  } catch (err) {
    console.error("Error deleting job:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
