import express from 'express';
import { collections, buildIdQuery } from '../db.js';

const router = express.Router();

const VALID_STATUSES = ["Applied", "Under Review", "Shortlisted", "Rejected", "Offered"];

// GET /applications - filter by seekerEmail, jobId, companyId
router.get('/', async (req, res) => {
  try {
    const { seekerEmail, seekerId, jobId, companyId, status } = req.query;
    const filter = {};

    if (seekerEmail) filter.seekerEmail = seekerEmail;
    if (seekerId) filter.seekerId = seekerId;
    if (jobId) filter.jobId = jobId;
    if (companyId) filter.companyId = companyId;
    if (status) filter.status = status;

    const applications = await collections.applications()
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /applications/job/:jobId - all applicants for a specific job
router.get('/job/:jobId', async (req, res) => {
  try {
    const applications = await collections.applications()
      .find({ jobId: req.params.jobId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (err) {
    console.error("Error fetching job applicants:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /applications/:id - single application
router.get('/:id', async (req, res) => {
  try {
    const application = await collections.applications().findOne(buildIdQuery(req.params.id));
    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }
    res.json({ success: true, application });
  } catch (err) {
    console.error("Error fetching application:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /applications - submit new application with quota check & duplicate prevention
router.post('/', async (req, res) => {
  try {
    const { jobId, seekerEmail, seekerName, seekerId, resumeUrl, coverLetter } = req.body;

    if (!jobId || !seekerEmail) {
      return res.status(400).json({ success: false, error: "jobId and seekerEmail are required" });
    }

    // Verify job exists
    const job = await collections.jobs().findOne(buildIdQuery(jobId));
    if (!job) {
      return res.status(404).json({ success: false, error: "Job posting not found" });
    }

    // Check duplicate
    const existing = await collections.applications().findOne({
      jobId: job.id,
      seekerEmail: seekerEmail,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "You have already applied for this position",
      });
    }

    // Check monthly quota
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentCount = await collections.applications().countDocuments({
      seekerEmail: seekerEmail,
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Check user subscription plan
    const subscription = await collections.subscriptions().findOne({ userEmail: seekerEmail });
    const planName = subscription?.plan || "Free";
    const limits = { Free: 10, Pro: 30, Premium: Infinity };
    const limit = limits[planName] ?? 10;

    if (recentCount >= limit) {
      return res.status(403).json({
        success: false,
        error: `Monthly application limit reached (${recentCount}/${limit} used for ${planName} plan). Upgrade to Pro or Premium for more applications.`,
      });
    }

    const newApp = {
      id: `app-${Date.now()}`,
      jobId: job.id,
      jobTitle: job.title,
      companyId: job.companyId,
      companyName: job.companyName,
      companyLogo: job.companyLogo,
      seekerId: seekerId || "",
      seekerName: seekerName || "Candidate",
      seekerEmail: seekerEmail,
      resumeUrl: resumeUrl || "/resumes/candidate-resume.pdf",
      coverLetter: coverLetter || "",
      appliedAt: "Just now",
      status: "Applied",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await collections.applications().insertOne(newApp);

    res.status(201).json({
      success: true,
      application: newApp,
      insertedId: result.insertedId,
      message: "Application submitted successfully",
    });
  } catch (err) {
    console.error("Error submitting application:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /applications/:id/status - candidate review status progression
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, recruiterNotes } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const updateFields = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (recruiterNotes) {
      updateFields.recruiterNotes = recruiterNotes;
    }

    const result = await collections.applications().findOneAndUpdate(
      buildIdQuery(req.params.id),
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    res.json({
      success: true,
      application: result,
      message: `Applicant moved to ${status}`,
    });
  } catch (err) {
    console.error("Error updating application status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /applications/:id - withdraw application
router.delete('/:id', async (req, res) => {
  try {
    const result = await collections.applications().deleteOne(buildIdQuery(req.params.id));
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }
    res.json({ success: true, message: "Application withdrawn successfully" });
  } catch (err) {
    console.error("Error withdrawing application:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
