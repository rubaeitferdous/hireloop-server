import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

async function testAll() {
  console.log("Starting backend verification test suite against", BASE_URL);

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/`);
  const health = await healthRes.json();
  assert.strictEqual(health.status, "ok");
  console.log("✓ Health check passed");

  // 2. Jobs list & filter
  const jobsRes = await fetch(`${BASE_URL}/jobs`);
  const jobsData = await jobsRes.json();
  assert.strictEqual(jobsData.success, true);
  assert(jobsData.jobs.length > 0, "Jobs should not be empty");
  console.log(`✓ GET /jobs returned ${jobsData.jobs.length} jobs (total: ${jobsData.total})`);

  // 3. Search query
  const searchRes = await fetch(`${BASE_URL}/jobs?q=AI`);
  const searchData = await searchRes.json();
  assert.strictEqual(searchData.success, true);
  console.log(`✓ GET /jobs?q=AI returned ${searchData.jobs.length} matching jobs`);

  // 4. Single job
  const firstJob = jobsData.jobs[0];
  const singleJobRes = await fetch(`${BASE_URL}/jobs/${firstJob.id}`);
  const singleJobData = await singleJobRes.json();
  assert.strictEqual(singleJobData.success, true);
  assert.strictEqual(singleJobData.job.id, firstJob.id);
  console.log(`✓ GET /jobs/:id fetched job '${singleJobData.job.title}'`);

  // 5. Create job
  const createJobRes = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: "Test Staff Site Reliability Engineer",
      companyId: "meta",
      companyName: "Meta",
      salaryMin: 180000,
      salaryMax: 240000,
      location: "Remote - US",
      category: "Engineering",
      jobType: "Full-time",
      overview: "Managing multi-region Kubernetes clusters.",
      recruiterEmail: "recruiter@meta.com"
    }),
  });
  const createdJobData = await createJobRes.json();
  assert.strictEqual(createdJobData.success, true);
  const testJobId = createdJobData.job.id;
  console.log(`✓ POST /jobs created test job with ID '${testJobId}'`);

  // 6. Update job
  const updateJobRes = await fetch(`${BASE_URL}/jobs/${testJobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: "Closed" }),
  });
  const updatedJobData = await updateJobRes.json();
  assert.strictEqual(updatedJobData.success, true);
  assert.strictEqual(updatedJobData.job.status, "Closed");
  console.log("✓ PATCH /jobs/:id updated status to 'Closed'");

  // 7. Delete job
  const deleteJobRes = await fetch(`${BASE_URL}/jobs/${testJobId}`, { method: 'DELETE' });
  const deleteJobData = await deleteJobRes.json();
  assert.strictEqual(deleteJobData.success, true);
  console.log("✓ DELETE /jobs/:id deleted test job");

  // 8. Companies list
  const companiesRes = await fetch(`${BASE_URL}/companies`);
  const companiesData = await companiesRes.json();
  assert.strictEqual(companiesData.success, true);
  assert(companiesData.companies.length > 0);
  console.log(`✓ GET /companies returned ${companiesData.companies.length} companies`);

  // 9. Single company
  const companyRes = await fetch(`${BASE_URL}/companies/meta`);
  const companyData = await companyRes.json();
  assert.strictEqual(companyData.success, true);
  assert.strictEqual(companyData.company.id, "meta");
  console.log(`✓ GET /companies/meta fetched company with ${companyData.jobs.length} active jobs`);

  // 10. Register company
  const regCompanyRes = await fetch(`${BASE_URL}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: "acme-test-" + Date.now(),
      name: "Acme Test Corp",
      industry: "AI",
      recruiterEmail: "recruiter@acmetest.com"
    }),
  });
  const regCompanyData = await regCompanyRes.json();
  assert.strictEqual(regCompanyData.success, true);
  const testCompanyId = regCompanyData.company.id;
  console.log(`✓ POST /companies registered company '${testCompanyId}'`);

  // 11. Approve company
  const approveRes = await fetch(`${BASE_URL}/companies/${testCompanyId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: "Approved" }),
  });
  const approveData = await approveRes.json();
  assert.strictEqual(approveData.success, true);
  assert.strictEqual(approveData.company.approvalStatus, "Approved");
  console.log("✓ PATCH /companies/:id/status approved company");

  // Cleanup company
  await fetch(`${BASE_URL}/companies/${testCompanyId}`, { method: 'DELETE' });

  // 12. Applications list
  const appsRes = await fetch(`${BASE_URL}/applications`);
  const appsData = await appsRes.json();
  assert.strictEqual(appsData.success, true);
  console.log(`✓ GET /applications returned ${appsData.count} applications`);

  // 13. Submit application
  const testSeekerEmail = `test.seeker.${Date.now()}@example.com`;
  const applyRes = await fetch(`${BASE_URL}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: firstJob.id,
      seekerEmail: testSeekerEmail,
      seekerName: "Test Seeker",
      coverLetter: "Automated test application submission.",
    }),
  });
  const applyData = await applyRes.json();
  assert.strictEqual(applyData.success, true);
  const testAppId = applyData.application.id;
  console.log(`✓ POST /applications submitted application '${testAppId}'`);

  // Duplicate application test
  const dupApplyRes = await fetch(`${BASE_URL}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: firstJob.id,
      seekerEmail: testSeekerEmail,
    }),
  });
  assert.strictEqual(dupApplyRes.status, 409);
  console.log("✓ Duplicate application correctly blocked with 409 Conflict");

  // 14. Update applicant status
  const statusUpdateRes = await fetch(`${BASE_URL}/applications/${testAppId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: "Shortlisted" }),
  });
  const statusUpdateData = await statusUpdateRes.json();
  assert.strictEqual(statusUpdateData.success, true);
  assert.strictEqual(statusUpdateData.application.status, "Shortlisted");
  console.log("✓ PATCH /applications/:id/status updated status to 'Shortlisted'");

  // Cleanup application
  await fetch(`${BASE_URL}/applications/${testAppId}`, { method: 'DELETE' });

  // 15. Saved Jobs (Bookmark toggle)
  const saveRes = await fetch(`${BASE_URL}/saved-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail: testSeekerEmail,
      jobId: firstJob.id,
    }),
  });
  const saveData = await saveRes.json();
  assert.strictEqual(saveData.success, true);
  assert.strictEqual(saveData.isSaved, true);
  console.log("✓ POST /saved-jobs bookmarked job");

  const getSavedRes = await fetch(`${BASE_URL}/saved-jobs?userEmail=${testSeekerEmail}`);
  const getSavedData = await getSavedRes.json();
  assert.strictEqual(getSavedData.success, true);
  assert(getSavedData.savedJobIds.includes(firstJob.id));
  console.log("✓ GET /saved-jobs retrieved saved job list");

  // Toggle remove bookmark
  const unsaveRes = await fetch(`${BASE_URL}/saved-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail: testSeekerEmail,
      jobId: firstJob.id,
    }),
  });
  const unsaveData = await unsaveRes.json();
  assert.strictEqual(unsaveData.isSaved, false);
  console.log("✓ POST /saved-jobs toggle correctly unbookmarked job");

  // 16. Users API
  const usersRes = await fetch(`${BASE_URL}/users`);
  const usersData = await usersRes.json();
  assert.strictEqual(usersData.success, true);
  assert(usersData.users.length > 0);
  console.log(`✓ GET /users returned ${usersData.count} users`);

  // 17. Subscription & Quota
  const subRes = await fetch(`${BASE_URL}/subscriptions/alex.rivera@example.com`);
  const subData = await subRes.json();
  assert.strictEqual(subData.success, true);
  assert(subData.plan.applicationsLimit !== undefined);
  console.log(`✓ GET /subscriptions/:userEmail returned plan: ${subData.plan.name} (${subData.plan.applicationsUsed}/${subData.plan.applicationsLimit} used)`);

  // 18. Plan upgrade
  const upgradeRes = await fetch(`${BASE_URL}/subscriptions/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail: testSeekerEmail,
      plan: "Pro",
      role: "seeker",
      amount: 19,
    }),
  });
  const upgradeData = await upgradeRes.json();
  assert.strictEqual(upgradeData.success, true);
  assert.strictEqual(upgradeData.subscription.plan, "Pro");
  console.log("✓ POST /subscriptions/upgrade upgraded to Pro and recorded payment");

  // 19. Payments ledger
  const paymentsRes = await fetch(`${BASE_URL}/payments`);
  const paymentsData = await paymentsRes.json();
  assert.strictEqual(paymentsData.success, true);
  assert(paymentsData.payments.length > 0);
  console.log(`✓ GET /payments returned ${paymentsData.count} payment transactions`);

  // 20. Admin stats
  const adminStatsRes = await fetch(`${BASE_URL}/admin/stats`);
  const adminStatsData = await adminStatsRes.json();
  assert.strictEqual(adminStatsData.success, true);
  assert(adminStatsData.stats.totalJobs > 0);
  assert(adminStatsData.stats.totalUsers > 0);
  console.log("✓ GET /admin/stats returned platform metrics:", JSON.stringify(adminStatsData.stats));

  console.log("\n==========================================");
  console.log("ALL 20 BACKEND VERIFICATION TESTS PASSED!");
  console.log("==========================================\n");
}

testAll().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
