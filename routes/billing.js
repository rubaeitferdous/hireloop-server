import express from 'express';
import { collections } from '../db.js';

const router = express.Router();

const SEEKER_LIMITS = {
  Free: { price: 0, applicationsLimit: 10 },
  Pro: { price: 19, applicationsLimit: 30 },
  Premium: { price: 39, applicationsLimit: Infinity },
};

const RECRUITER_LIMITS = {
  Free: { price: 0, activeJobsLimit: 3 },
  Growth: { price: 49, activeJobsLimit: 10 },
  Enterprise: { price: 149, activeJobsLimit: 50 },
};

// GET /subscriptions/:userEmail - get active plan and quota
router.get('/subscriptions/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { role } = req.query; // 'seeker' or 'recruiter'

    let subscription = await collections.subscriptions().findOne({ userEmail });

    if (!subscription) {
      // Default free plan
      subscription = {
        userEmail,
        plan: "Free",
        role: role || "seeker",
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
    }

    // Calculate usage dynamically
    if (subscription.role === "recruiter") {
      const activeJobsCount = await collections.jobs().countDocuments({
        recruiterEmail: userEmail,
        status: { $ne: "Closed" },
      });
      const planLimits = RECRUITER_LIMITS[subscription.plan] || RECRUITER_LIMITS.Free;

      return res.json({
        success: true,
        plan: {
          name: subscription.plan,
          price: planLimits.price,
          activeJobsLimit: planLimits.activeJobsLimit,
          activeJobsUsed: activeJobsCount,
          renewsAt: subscription.renewsAt,
        },
      });
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const appsCount = await collections.applications().countDocuments({
        seekerEmail: userEmail,
        createdAt: { $gte: thirtyDaysAgo },
      });
      const planLimits = SEEKER_LIMITS[subscription.plan] || SEEKER_LIMITS.Free;

      return res.json({
        success: true,
        plan: {
          name: subscription.plan,
          price: planLimits.price,
          applicationsLimit: planLimits.applicationsLimit,
          applicationsUsed: appsCount,
          renewsAt: subscription.renewsAt,
        },
      });
    }
  } catch (err) {
    console.error("Error fetching subscription:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /subscriptions/upgrade - upgrade plan (simulated Stripe checkout completion)
router.post('/subscriptions/upgrade', async (req, res) => {
  try {
    const { userEmail, plan, role, amount } = req.body;

    if (!userEmail || !plan) {
      return res.status(400).json({ success: false, error: "userEmail and plan are required" });
    }

    const price = amount !== undefined ? Number(amount) : (
      role === "recruiter" ? (RECRUITER_LIMITS[plan]?.price ?? 49) : (SEEKER_LIMITS[plan]?.price ?? 19)
    );

    const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert subscription
    const updatedSub = await collections.subscriptions().findOneAndUpdate(
      { userEmail },
      {
        $set: {
          userEmail,
          plan,
          role: role || "seeker",
          price,
          renewsAt,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: {
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Record completed transaction
    const transaction = {
      id: `tx_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`,
      userEmail,
      plan: `${plan} (${role === "recruiter" ? "Recruiter" : "Seeker"})`,
      amount: price,
      currency: "USD",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      status: "Completed",
      createdAt: new Date().toISOString(),
    };

    if (price > 0) {
      await collections.payments().insertOne(transaction);
    }

    res.json({
      success: true,
      subscription: updatedSub,
      transaction,
      message: `Successfully upgraded to ${plan} plan`,
    });
  } catch (err) {
    console.error("Error upgrading plan:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /payments - transaction receipts
router.get('/payments', async (req, res) => {
  try {
    const { userEmail } = req.query;
    const filter = {};
    if (userEmail) filter.userEmail = userEmail;

    const payments = await collections.payments()
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /payments - record transaction
router.post('/payments', async (req, res) => {
  try {
    const { userEmail, plan, amount, currency = "USD", status = "Completed" } = req.body;

    const transaction = {
      id: `tx_${Date.now().toString(36)}`,
      userEmail: userEmail || "anonymous",
      plan: plan || "Subscription",
      amount: Number(amount) || 0,
      currency,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      status,
      createdAt: new Date().toISOString(),
    };

    const result = await collections.payments().insertOne(transaction);
    res.status(201).json({ success: true, transaction, insertedId: result.insertedId });
  } catch (err) {
    console.error("Error recording payment:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
