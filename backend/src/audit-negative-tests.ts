/**
 * StackX SkillTrack — Negative Security & Authorization Tests
 * Explicitly tests attack vectors with separate test accounts against live endpoints.
 * Verifies real HTTP status codes and real database isolation.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:4300';

let passed = 0;
let failed = 0;

function assert(testGroup: string, name: string, condition: boolean, details?: any) {
  if (condition) {
    console.log(`  \x1b[32m✔ [${testGroup}] PASS:\x1b[0m ${name}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✘ [${testGroup}] FAIL:\x1b[0m ${name} ${details ? `-> ${JSON.stringify(details)}` : ''}`);
    failed++;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  return { status: response.status, ok: response.ok, data };
}

async function runNegativeSecurityTests() {
  const ts = Date.now();
  console.log('\n\x1b[1m\x1b[31m========================================================================');
  console.log('   StackX SkillTrack — Targeted Negative Security & Authorization Tests');
  console.log('   Target: ' + BASE_URL);
  console.log('========================================================================\x1b[0m\n');

  // --- Setup Users ---
  // Student A: Legitimate Project Creator
  const studentAEmail = `student.a.${ts}@stackx.edu`;
  const regA = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Student Alpha', email: studentAEmail, password: 'Password#2026!' }),
  });
  const studentA = regA.data.user;
  const loginA = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentAEmail, password: 'Password#2026!' }),
  });
  const tokenA = loginA.data.token;

  // Student B: Enrolled Team Member
  const studentBEmail = `student.b.${ts}@stackx.edu`;
  const regB = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Student Beta', email: studentBEmail, password: 'Password#2026!' }),
  });
  const studentB = regB.data.user;
  const loginB = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentBEmail, password: 'Password#2026!' }),
  });
  const tokenB = loginB.data.token;

  // Student X: Completely Unrelated Attacker
  const studentXEmail = `student.x.attacker.${ts}@stackx.edu`;
  const regX = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Attacker Xavier', email: studentXEmail, password: 'Password#2026!' }),
  });
  const studentX = regX.data.user;
  const loginX = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentXEmail, password: 'Password#2026!' }),
  });
  const tokenX = loginX.data.token;

  // Faculty User
  const loginFaculty = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty@test.com', password: 'Password#2026!' }),
  });
  const facultyToken = loginFaculty.data.token;
  const facultyId = loginFaculty.data.user.id;

  // Student A creates Project Alpha
  const createProjRes = await request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      title: 'Project Alpha Confidential',
      description: 'Proprietary AI research project',
      technologies: 'React, TypeScript',
      studentIds: [studentB.id],
      assignedFacultyId: facultyId,
    }),
  });
  const projectId = createProjRes.data.id;

  // Student B accepts invitation to become official team member
  const projInvsRes = await request(`/api/invitations/project/${projectId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const invB = projInvsRes.data.find((i: any) => i.recipientId === studentB.id);
  await request(`/api/invitations/${invB.id}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenB}` },
  });

  // Fetch columns and create Task Alpha
  const colsRes = await request(`/api/columns?projectId=${projectId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const columns = colsRes.data;
  const todoCol = columns.find((c: any) => c.order === 0) || columns[0];
  const inProgressCol = columns.find((c: any) => c.order === 1) || columns[1];
  const inReviewCol = columns.find((c: any) => c.order === 2) || columns[2];
  const completedCol = columns.find((c: any) => c.order === 3) || columns[3];

  const createTaskRes = await request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      columnId: todoCol.id,
      title: 'Original Task Alpha Title',
      description: 'Original Task Description',
      priority: 'high',
    }),
  });
  const taskId = createTaskRes.data.id;

  // =========================================================================
  // TEST 1: UNRELATED STUDENT COMMENT ATTEMPTS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[33m[Test 1] Unrelated Student Comment Authorization\x1b[0m');

  // 1a. Project creator CAN comment
  const creatorCommentRes = await request(`/api/comments/task/${taskId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ content: 'Creator legitimate comment' }),
  });
  assert('Comments', 'Project creator is authorized to comment (201 Created)', creatorCommentRes.status === 201);

  // 1b. Accepted team member CAN comment
  const memberCommentRes = await request(`/api/comments/task/${taskId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ content: 'Member legitimate comment' }),
  });
  assert('Comments', 'Accepted team member is authorized to comment (201 Created)', memberCommentRes.status === 201);

  // 1c. Unrelated student CANNOT comment via /task/:taskId
  const attackerComment1 = await request(`/api/comments/task/${taskId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenX}` },
    body: JSON.stringify({ content: 'Attacker unauthorized injection attempt 1' }),
  });
  assert('Comments', 'Unrelated student commenting via /task/:taskId receives 403 Forbidden', attackerComment1.status === 403);

  // 1d. Unrelated student CANNOT comment via POST /
  const attackerComment2 = await request('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenX}` },
    body: JSON.stringify({ taskId, content: 'Attacker unauthorized injection attempt 2' }),
  });
  assert('Comments', 'Unrelated student commenting via POST / receives 403 Forbidden', attackerComment2.status === 403);

  // 1e. Verify DB state: zero comments by Student X
  const dbCommentsAttacker = await prisma.comment.count({
    where: { taskId, userId: studentX.id },
  });
  assert('Comments', 'Database verification: exactly 0 comments recorded from attacker', dbCommentsAttacker === 0);

  // =========================================================================
  // TEST 2: UNRELATED STUDENT TASK MODIFICATION ATTEMPTS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[33m[Test 2] Unrelated Student Task Modification Authorization\x1b[0m');

  // 2a. Unrelated student attempts PATCH task
  const attackerPatchTask = await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenX}` },
    body: JSON.stringify({ title: 'Hacked by Attacker' }),
  });
  assert('Tasks', 'Unrelated student attempting PATCH task receives 403 Forbidden', attackerPatchTask.status === 403);

  // 2b. Unrelated student attempts PUT task
  const attackerPutTask = await request(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenX}` },
    body: JSON.stringify({ title: 'Hacked by Attacker via PUT' }),
  });
  assert('Tasks', 'Unrelated student attempting PUT task receives 403 Forbidden', attackerPutTask.status === 403);

  // 2c. Unrelated student attempts DELETE task
  const attackerDeleteTask = await request(`/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenX}` },
  });
  assert('Tasks', 'Unrelated student attempting DELETE task receives 403 Forbidden', attackerDeleteTask.status === 403);

  // 2d. Verify DB state: task title is unchanged
  const dbTaskCheck = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true },
  });
  assert('Tasks', 'Database verification: task title remains uncorrupted ("Original Task Alpha Title")', dbTaskCheck?.title === 'Original Task Alpha Title');

  // =========================================================================
  // TEST 3: UNRELATED STUDENT SKILL CLAIM ATTEMPTS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[33m[Test 3] Unrelated Student Skill Claim Evidence Authorization\x1b[0m');

  const skills = await prisma.skill.findMany({ where: { isActive: true }, take: 1 });
  const targetSkill = skills[0];

  // 3a. Unrelated student attempts to claim skill citing Project Alpha
  const attackerClaimRes = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenX}` },
    body: JSON.stringify({
      skillId: targetSkill.id,
      projectId: projectId,
      level: 'ADVANCED',
    }),
  });
  assert('Skills', 'Unrelated student claiming skill with another student project receives 403 Forbidden', attackerClaimRes.status === 403);

  // 3b. Verify DB state: zero evidence links created for attacker on Project Alpha
  const dbAttackerClaims = await prisma.studentSkillEvidence.count({
    where: {
      projectId: projectId,
      studentSkill: { studentId: studentX.id },
    },
  });
  assert('Skills', 'Database verification: 0 evidence links created for attacker on Project Alpha', dbAttackerClaims === 0);

  // 3c. Legitimate creator CAN submit claim backed by Project Alpha
  const creatorClaimRes = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      skillId: targetSkill.id,
      projectId: projectId,
      level: 'INTERMEDIATE',
    }),
  });
  assert('Skills', 'Legitimate project creator can submit skill claim (201/200)', creatorClaimRes.status === 201 || creatorClaimRes.status === 200);

  // =========================================================================
  // TEST 4: TASK WORKFLOW BYPASS ATTEMPTS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[33m[Test 4] Task Review Bypass & RBAC Guard Enforcement\x1b[0m');

  // 4a. Move task from To Do to In Progress
  await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ columnId: inProgressCol.id }),
  });

  // 4b. Student attempts to jump from In Progress directly to Completed
  const bypassAttempt1 = await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ columnId: completedCol.id }),
  });
  assert('Review Guard', 'Student jumping from In Progress directly to Completed receives 403 Forbidden', bypassAttempt1.status === 403);

  // 4c. Student moves task to In Review
  await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ columnId: inReviewCol.id }),
  });

  // 4d. Student attempts to self-approve from In Review to Completed
  const bypassAttempt2 = await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ columnId: completedCol.id }),
  });
  assert('Review Guard', 'Student self-approving from In Review to Completed receives 403 Forbidden', bypassAttempt2.status === 403);

  // 4e. Verify DB state: task is still in In Review
  const dbTaskColumnCheck = await prisma.task.findUnique({
    where: { id: taskId },
    select: { columnId: true },
  });
  assert('Review Guard', 'Database verification: task remains in In Review column (not Completed)', dbTaskColumnCheck?.columnId === inReviewCol.id);

  // =========================================================================
  // TEST 5: CREATOR ENROLLMENT IDEMPOTENCY
  // =========================================================================
  console.log('\n\x1b[1m\x1b[33m[Test 5] Creator Enrollment Idempotency\x1b[0m');

  // Student A submits another skill claim on Project Alpha
  const secondSkill = skills[1] || targetSkill;
  await request('/api/student-skills/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      skillId: secondSkill.id,
      projectId: projectId,
      level: 'ADVANCED',
    }),
  });

  // Verify exactly 1 ProjectStudent record for Student A on Project Alpha
  const creatorEnrollmentCount = await prisma.projectStudent.count({
    where: { projectId: projectId, studentId: studentA.id },
  });
  assert('Enrollment', 'Database verification: creator has exactly 1 ProjectStudent record (no duplicates)', creatorEnrollmentCount === 1);

  // =========================================================================
  // TEST 6: INVALID & UNAUTHORIZED INVITATION ATTEMPTS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[33m[Test 6] Invitation Authorization & Validation Guards\x1b[0m');

  // 6a. Unrelated student attempts to invite someone to Project Alpha
  const unauthorizedInviteRes = await request(`/api/invitations/project/${projectId}/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenX}` },
    body: JSON.stringify({ recipientId: studentX.id, message: 'Attacker invite' }),
  });
  assert('Invitations', 'Non-creator student attempting to invite to project receives 403 Forbidden', unauthorizedInviteRes.status === 403);

  // 6b. Student A attempts to invite themselves
  const selfInviteRes = await request(`/api/invitations/project/${projectId}/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: studentA.id, message: 'Self invite' }),
  });
  assert('Invitations', 'Creator attempting to invite themselves receives 400 Bad Request', selfInviteRes.status === 400);

  // 6c. Student A invites Student X
  const legitInviteXRes = await request(`/api/invitations/project/${projectId}/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: studentX.id, message: 'Legitimate invite to X' }),
  });
  const inviteXId = legitInviteXRes.data.invitation.id;

  // 6d. Student B attempts to cancel Student A's invitation to X
  const unauthorizedCancel = await request(`/api/invitations/${inviteXId}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert('Invitations', 'Non-creator teammate attempting to cancel another user invitation receives 403 Forbidden', unauthorizedCancel.status === 403);

  // 6e. Student B attempts to accept invitation addressed to Student X
  const unauthorizedAccept = await request(`/api/invitations/${inviteXId}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert('Invitations', 'User attempting to accept invitation addressed to someone else receives 403 Forbidden', unauthorizedAccept.status === 403);

  // 6f. Student A attempts to invite a student as a faculty guide
  const invalidFacultyInvite = await request(`/api/invitations/project/${projectId}/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: studentB.id, message: 'Student as guide' }),
  });
  assert('Invitations', 'Attempting to invite non-faculty user as faculty guide receives 400 Bad Request', invalidFacultyInvite.status === 400);

  // =========================================================================
  // TEST 7: RATE LIMITING ENVIRONMENT CONFIGURATION & FAIL-SAFE LIMITS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[33m[Test 7] Rate Limiting Environment Safety & Configured Limits Verification\x1b[0m');

  const {
    loginRateLimiter,
    registerRateLimiter,
    isExplicitDevelopmentEnv,
    getRateLimitConfig,
    createAuthRateLimiters,
  } = await import('./middleware/rateLimiter.js');

  assert('Rate Limiter', 'loginRateLimiter is properly instantiated middleware function', typeof loginRateLimiter === 'function');
  assert('Rate Limiter', 'registerRateLimiter is properly instantiated middleware function', typeof registerRateLimiter === 'function');
  assert('Rate Limiter', 'loginRateLimiter carries numeric maxRequests property', typeof loginRateLimiter.maxRequests === 'number');
  assert('Rate Limiter', 'registerRateLimiter carries numeric maxRequests property', typeof registerRateLimiter.maxRequests === 'number');

  // Case 1: Explicit development mode (NODE_ENV=development)
  const devConfig = getRateLimitConfig('development');
  const devLimiters = createAuthRateLimiters('development');
  assert('Rate Limiter [Case 1: dev]', 'NODE_ENV=development recognized as explicit development', isExplicitDevelopmentEnv('development') === true);
  assert('Rate Limiter [Case 1: dev]', 'NODE_ENV=development configures 1,000 registrations/hr', devConfig.registerMaxRequests === 1000);
  assert('Rate Limiter [Case 1: dev]', 'NODE_ENV=development configures 100 logins/15min', devConfig.loginMaxRequests === 100);
  assert('Rate Limiter [Case 1: dev]', 'Actual register middleware instance enforces 1,000 limit', devLimiters.register.maxRequests === 1000);
  assert('Rate Limiter [Case 1: dev]', 'Actual login middleware instance enforces 100 limit', devLimiters.login.maxRequests === 100);

  // Case 2: Production mode (NODE_ENV=production)
  const prodConfig = getRateLimitConfig('production');
  const prodLimiters = createAuthRateLimiters('production');
  assert('Rate Limiter [Case 2: prod]', 'NODE_ENV=production recognized as non-development', isExplicitDevelopmentEnv('production') === false);
  assert('Rate Limiter [Case 2: prod]', 'NODE_ENV=production strictly enforces 10 registrations/hr', prodConfig.registerMaxRequests === 10);
  assert('Rate Limiter [Case 2: prod]', 'NODE_ENV=production strictly enforces 5 logins/15min', prodConfig.loginMaxRequests === 5);
  assert('Rate Limiter [Case 2: prod]', 'Actual register middleware instance enforces 10 limit in production', prodLimiters.register.maxRequests === 10);
  assert('Rate Limiter [Case 2: prod]', 'Actual login middleware instance enforces 5 limit in production', prodLimiters.login.maxRequests === 5);

  // Case 3: Missing NODE_ENV (undefined / empty)
  const missingConfig = getRateLimitConfig(undefined);
  const missingLimiters = createAuthRateLimiters(undefined);
  assert('Rate Limiter [Case 3: missing]', 'Missing NODE_ENV recognized as non-development (fails closed)', isExplicitDevelopmentEnv(undefined) === false);
  assert('Rate Limiter [Case 3: missing]', 'Missing NODE_ENV strictly enforces 10 registrations/hr', missingConfig.registerMaxRequests === 10);
  assert('Rate Limiter [Case 3: missing]', 'Missing NODE_ENV strictly enforces 5 logins/15min', missingConfig.loginMaxRequests === 5);
  assert('Rate Limiter [Case 3: missing]', 'Actual register middleware instance enforces 10 limit when missing', missingLimiters.register.maxRequests === 10);
  assert('Rate Limiter [Case 3: missing]', 'Actual login middleware instance enforces 5 limit when missing', missingLimiters.login.maxRequests === 5);

  // Case 4: Unexpected NODE_ENV value (staging, test, unknown, random)
  const unexpectedConfig = getRateLimitConfig('staging-v2');
  const unexpectedLimiters = createAuthRateLimiters('staging-v2');
  assert('Rate Limiter [Case 4: unexpected]', 'Unexpected NODE_ENV recognized as non-development (fails closed)', isExplicitDevelopmentEnv('staging-v2') === false);
  assert('Rate Limiter [Case 4: unexpected]', 'Unexpected NODE_ENV strictly enforces 10 registrations/hr', unexpectedConfig.registerMaxRequests === 10);
  assert('Rate Limiter [Case 4: unexpected]', 'Unexpected NODE_ENV strictly enforces 5 logins/15min', unexpectedConfig.loginMaxRequests === 5);
  assert('Rate Limiter [Case 4: unexpected]', 'Actual register middleware instance enforces 10 limit for unexpected value', unexpectedLimiters.register.maxRequests === 10);
  assert('Rate Limiter [Case 4: unexpected]', 'Actual login middleware instance enforces 5 limit for unexpected value', unexpectedLimiters.login.maxRequests === 5);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[1m\x1b[31m========================================================================');
  console.log(`   Negative Tests Execution: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\x1b[0m\n');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runNegativeSecurityTests().catch(async (err) => {
  console.error('\x1b[31mFatal error in negative security tests:\x1b[0m', err);
  await prisma.$disconnect();
  process.exit(1);
});

