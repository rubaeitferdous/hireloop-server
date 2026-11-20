import 'dotenv/config';
import { connectDB, collections } from './db.js';
import {
  initialCompanies,
  initialJobs,
  initialApplications,
  initialUsers,
  initialPayments
} from './data/seedData.js';

export async function seedDatabase(force = false) {
  await connectDB();
  console.log("Checking database seed status...");

  const companiesCount = await collections.companies().countDocuments();
  const jobsCount = await collections.jobs().countDocuments();
  const applicationsCount = await collections.applications().countDocuments();
  const paymentsCount = await collections.payments().countDocuments();
  const usersCount = await collections.users().countDocuments();

  if (force || companiesCount === 0) {
    console.log(`Seeding ${initialCompanies.length} companies...`);
    if (force) await collections.companies().deleteMany({});
    await collections.companies().insertMany(initialCompanies);
  }

  if (force || jobsCount === 0) {
    console.log(`Seeding ${initialJobs.length} jobs...`);
    if (force) await collections.jobs().deleteMany({});
    await collections.jobs().insertMany(initialJobs);
  }

  if (force || applicationsCount === 0) {
    console.log(`Seeding ${initialApplications.length} applications...`);
    if (force) await collections.applications().deleteMany({});
    await collections.applications().insertMany(initialApplications);
  }

  if (force || paymentsCount === 0) {
    console.log(`Seeding ${initialPayments.length} payments...`);
    if (force) await collections.payments().deleteMany({});
    await collections.payments().insertMany(initialPayments);
  }

  // Seed default platform users if missing
  for (const u of initialUsers) {
    const existing = await collections.users().findOne({ email: u.email });
    if (!existing) {
      console.log(`Seeding user: ${u.email}`);
      await collections.users().insertOne(u);
    }
  }

  console.log("Database seed check complete!");
}

// If executed directly from CLI: node seed.js [--force]
if (process.argv[1]?.endsWith('seed.js')) {
  const isForce = process.argv.includes('--force');
  seedDatabase(isForce)
    .then(() => {
      console.log("Seed finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
