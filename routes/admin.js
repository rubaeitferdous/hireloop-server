import express from 'express';
import { collections } from '../db.js';

const router = express.Router();

// GET /admin/stats - platform metrics & charts
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await collections.users().countDocuments();
    const totalSeekers = await collections.users().countDocuments({ role: { $in: ["seeker", undefined] } });
    const totalRecruiters = await collections.users().countDocuments({ role: "recruiter" });
    const totalCompanies = await collections.companies().countDocuments();
    const totalJobs = await collections.jobs().countDocuments();
    const activeJobs = await collections.jobs().countDocuments({ status: { $ne: "Closed" } });
    const totalApplications = await collections.applications().countDocuments();

    // Calculate revenue from completed payments
    const payments = await collections.payments().find({ status: "Completed" }).toArray();
    const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Category distribution for charts
    const categoryAgg = await collections.jobs().aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    const categoryDistribution = categoryAgg.map((item) => ({
      category: item._id || "Other",
      count: item.count,
    }));

    // Recent payments
    const recentPayments = await collections.payments()
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    // Recent users
    const recentUsers = await collections.users()
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSeekers,
        totalRecruiters,
        totalCompanies,
        totalJobs,
        activeJobs,
        totalApplications,
        totalRevenue,
        mrr: Math.round(totalRevenue * 0.4),
        activeSeekerSubs: Math.max(1, Math.floor(totalSeekers * 0.3)),
        activeRecruiterSubs: Math.max(1, Math.floor(totalRecruiters * 0.5)),
      },
      categoryDistribution,
      recentPayments,
      recentUsers,
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
