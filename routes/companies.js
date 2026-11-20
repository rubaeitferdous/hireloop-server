import express from 'express';
import { collections, buildIdQuery } from '../db.js';

const router = express.Router();

// Helper to query company by id, slug, or _id
function buildCompanyQuery(identifier) {
  const base = buildIdQuery(identifier);
  return {
    $or: [
      ...base.$or || [{ id: identifier }],
      { slug: identifier }
    ]
  };
}

// GET /companies - directory & search
router.get('/', async (req, res) => {
  try {
    const {
      q,
      search,
      industry,
      approvalStatus,
      recruiterEmail,
      all,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    const queryTerm = q || search;
    if (queryTerm && typeof queryTerm === 'string' && queryTerm.trim()) {
      const regex = new RegExp(queryTerm.trim(), 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
        { tags: regex },
        { industry: regex },
        { location: regex },
      ];
    }

    if (industry && industry !== 'All') {
      filter.industry = industry;
    }

    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    } else if (all !== 'true' && !recruiterEmail) {
      // Default to public approved companies for general browsing
      filter.approvalStatus = { $in: ["Approved", undefined] };
    }

    if (recruiterEmail) {
      filter.recruiterEmail = recruiterEmail;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await collections.companies().countDocuments(filter);
    const companies = await collections.companies()
      .find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    // Dynamically update openJobsCount for each company
    const enriched = await Promise.all(
      companies.map(async (company) => {
        const count = await collections.jobs().countDocuments({
          companyId: company.id,
          status: { $ne: "Closed" },
        });
        return {
          ...company,
          openJobsCount: count > 0 ? count : (company.openJobsCount || 0),
        };
      })
    );

    res.json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      companies: enriched,
    });
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /companies/:id - single company + open jobs
router.get('/:id', async (req, res) => {
  try {
    const company = await collections.companies().findOne(buildCompanyQuery(req.params.id));
    if (!company) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    // Fetch active jobs for this company
    const openJobs = await collections.jobs().find({
      companyId: company.id,
      status: { $ne: "Closed" },
    }).sort({ createdAt: -1 }).toArray();

    res.json({
      success: true,
      company: {
        ...company,
        openJobsCount: openJobs.length,
      },
      jobs: openJobs,
    });
  } catch (err) {
    console.error("Error fetching company:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /companies - register new company
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    if (!body.name) {
      return res.status(400).json({ success: false, error: "Company name is required" });
    }

    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = body.id || slug;

    // Check if company slug/id already exists
    const existing = await collections.companies().findOne(buildCompanyQuery(id));
    if (existing) {
      return res.status(409).json({ success: false, error: "A company with this name/slug already exists" });
    }

    const newCompany = {
      id,
      name: body.name,
      slug,
      logo: body.logo || "/logos/google.png",
      industry: body.industry || "Technology",
      location: body.location || "San Francisco, CA",
      employeeCount: body.employeeCount || "50 - 200",
      website: body.website || "https://example.com",
      description: body.description || "",
      about: body.about || body.description || "",
      openJobsCount: 0,
      founded: body.founded || new Date().getFullYear().toString(),
      tags: Array.isArray(body.tags) ? body.tags : [],
      approvalStatus: body.approvalStatus || "Pending",
      recruiterEmail: body.recruiterEmail || "",
      recruiterId: body.recruiterId || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await collections.companies().insertOne(newCompany);
    res.status(201).json({ success: true, company: newCompany, insertedId: result.insertedId });
  } catch (err) {
    console.error("Error creating company:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /companies/:id - update company
router.patch('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData._id;

    const result = await collections.companies().findOneAndUpdate(
      buildCompanyQuery(req.params.id),
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    res.json({ success: true, company: result });
  } catch (err) {
    console.error("Error updating company:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /companies/:id/status - approve or reject company (Admin)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Approved", "Rejected", "Pending"].includes(status)) {
      return res.status(400).json({ success: false, error: "Status must be 'Approved', 'Rejected', or 'Pending'" });
    }

    const result = await collections.companies().findOneAndUpdate(
      buildCompanyQuery(req.params.id),
      { $set: { approvalStatus: status, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    res.json({ success: true, company: result, message: `Company marked as ${status}` });
  } catch (err) {
    console.error("Error updating company status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /companies/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await collections.companies().deleteOne(buildCompanyQuery(req.params.id));
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }
    res.json({ success: true, message: "Company deleted successfully" });
  } catch (err) {
    console.error("Error deleting company:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
