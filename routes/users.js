import express from 'express';
import { collections, buildIdQuery } from '../db.js';

const router = express.Router();

function buildUserQuery(identifier) {
  const base = buildIdQuery(identifier);
  return {
    $or: [
      ...base.$or || [{ id: identifier }],
      { email: identifier }
    ]
  };
}

// GET /users - list & search users
router.get('/', async (req, res) => {
  try {
    const { q, search, role, status } = req.query;
    const filter = {};

    const queryTerm = q || search;
    if (queryTerm && typeof queryTerm === 'string' && queryTerm.trim()) {
      const regex = new RegExp(queryTerm.trim(), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
      ];
    }

    if (role && role !== 'All') {
      filter.role = role.toLowerCase();
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    const users = await collections.users()
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    // Map fields cleanly
    const sanitized = users.map((u) => ({
      id: u.id || u._id.toString(),
      _id: u._id,
      name: u.name || "Anonymous",
      email: u.email,
      role: u.role || "seeker",
      status: u.status || "Active",
      headline: u.headline || "",
      bio: u.bio || "",
      skills: Array.isArray(u.skills) ? u.skills : [],
      resumeName: u.resumeName || "",
      location: u.location || "",
      joinedAt: u.joinedAt || (u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "Jan 2026"),
      createdAt: u.createdAt,
    }));

    res.json({
      success: true,
      count: sanitized.length,
      users: sanitized,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /users/:id or :email - profile
router.get('/:id', async (req, res) => {
  try {
    const user = await collections.users().findOne(buildUserQuery(req.params.id));
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user.id || user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "seeker",
        status: user.status || "Active",
        headline: user.headline || "",
        bio: user.bio || "",
        skills: Array.isArray(user.skills) ? user.skills : [],
        resumeName: user.resumeName || "",
        location: user.location || "",
        joinedAt: user.joinedAt || user.createdAt,
      },
    });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /users/:id - update profile
router.patch('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData._id;

    const result = await collections.users().findOneAndUpdate(
      buildUserQuery(req.params.id),
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, user: result });
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /users/:id/role - change user role (Admin)
router.patch('/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!["seeker", "recruiter", "admin"].includes(role?.toLowerCase())) {
      return res.status(400).json({ success: false, error: "Role must be 'seeker', 'recruiter', or 'admin'" });
    }

    const result = await collections.users().findOneAndUpdate(
      buildUserQuery(req.params.id),
      { $set: { role: role.toLowerCase(), updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, user: result, message: `Role changed to ${role}` });
  } catch (err) {
    console.error("Error updating role:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /users/:id/status - suspend/activate user (Admin)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Active", "Suspended"].includes(status)) {
      return res.status(400).json({ success: false, error: "Status must be 'Active' or 'Suspended'" });
    }

    const result = await collections.users().findOneAndUpdate(
      buildUserQuery(req.params.id),
      { $set: { status, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, user: result, message: `User status set to ${status}` });
  } catch (err) {
    console.error("Error updating user status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /users/:id - remove user (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const result = await collections.users().deleteOne(buildUserQuery(req.params.id));
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
