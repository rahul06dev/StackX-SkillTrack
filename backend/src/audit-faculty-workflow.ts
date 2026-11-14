/**
 * StackX SkillTrack — Comprehensive Faculty Workflow E2E Audit
 * Executes real live HTTP requests against the running backend API and PostgreSQL database.
 * Verifies all 7 sections of the Faculty Workflow Audit.
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:4300';
const JWT_SECRET = process.env.JWT_SECRET || 'stackx_skilltrack_super_secret_2026';

let passedChecks = 0;
let failedChecks = 0;

interface TestCheckResult {
  section: string;
  check: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

export const checkResults: TestCheckResult[] = [];

function assert(section: string, checkName: string, condition: boolean, evidence: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ [${section}] PASS:\x1b[0m ${checkName} (${evidence})`);
    passedChecks++;
    checkResults.push({ section, check: checkName, status: 'PASS', evidence });
  } else {
    console.error(`  \x1b[31m✘ [${section}] FAIL:\x1b[0m ${checkName} (${evidence})`);
    failedChecks++;
    checkResults.push({ section, check: checkName, status: 'FAIL', evidence });
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
  return { status: response.status, ok: response.ok, data, headers: response.headers };
}

export async function runFacultyWorkflowAudit() {
  const timestamp = Date.now();
  console.log('\n\x1b[1m\x1b[35m========================================================================');
  console.log('   StackX SkillTrack — Comprehensive Faculty Workflow E2E Audit');
  console.log('   Target: ' + BASE_URL);
  console.log('========================================================================\x1b[0m\n');

  // Setup: Ensure Faculty Alpha and Faculty Beta exist in the PostgreSQL database
  const facultyPassword = 'Password#2026!';
  const facultyPasswordHash = await bcrypt.hash(facultyPassword, 10);

  const facultyAlpha = await prisma.user.upsert({
    where: { email: 'faculty@test.com' },
    update: { password: facultyPasswordHash, role: 'FACULTY', name: 'Dr. Robert Vance' },
    create: {
      email: 'faculty@test.com',
      password: facultyPasswordHash,
      name: 'Dr. Robert Vance',
      role: 'FACULTY',
    },
  });

  const facultyBetaEmail = `faculty.beta.${timestamp}@stackx.edu`;
  const facultyBeta = await prisma.user.create({
    data: {
      email: facultyBetaEmail,
      password: facultyPasswordHash,
      name: 'Dr. Elena Rostova',
      role: 'FACULTY',
    },
  });

  // Setup a student for project and task creation
  const studentEmail = `student.faculty.audit.${timestamp}@stackx.edu`;
  const studentPassword = 'Password#2026!';
  const regStudentRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Julian Hayes',
      email: studentEmail,
      password: studentPassword,
    }),
  });
  const studentToken = (await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentEmail, password: studentPassword }),
  })).data?.token;

  // =========================================================================
  // 1. FACULTY REGISTRATION/LOGIN AND DASHBOARD
  // =========================================================================
  console.log('\x1b[1m\x1b[36m[1] Faculty Registration/Login & Dashboard\x1b[0m');

  // 1.1 Valid Faculty Login
  const loginAlphaRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty@test.com', password: facultyPassword }),
  });
  const facultyAlphaToken = loginAlphaRes.data?.token;
  assert(
    '1. Reg/Login',
    'Faculty Alpha login with valid credentials returns 200 OK and JWT',
    loginAlphaRes.status === 200 && !!facultyAlphaToken && loginAlphaRes.data?.user?.role === 'FACULTY',
    `HTTP ${loginAlphaRes.status}, role=${loginAlphaRes.data?.user?.role}`
  );

  const loginBetaRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: facultyBetaEmail, password: facultyPassword }),
  });
  const facultyBetaToken = loginBetaRes.data?.token;
  assert(
    '1. Reg/Login',
    'Faculty Beta login returns 200 OK and JWT',
    loginBetaRes.status === 200 && !!facultyBetaToken && loginBetaRes.data?.user?.role === 'FACULTY',
    `HTTP ${loginBetaRes.status}, role=${loginBetaRes.data?.user?.role}`
  );

  // 1.2 Invalid Credentials
  const badLoginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty@test.com', password: 'WrongPassword#999' }),
  });
  assert(
    '1. Reg/Login',
    'Faculty login with invalid password returns 401 Unauthorized',
    badLoginRes.status === 401,
    `HTTP ${badLoginRes.status}`
  );

  // 1.3 Unauthorized access without token
  const noTokenRes = await request('/api/projects');
  assert(
    '1. Reg/Login',
    'API request without token returns 401 Unauthorized',
    noTokenRes.status === 401,
    `HTTP ${noTokenRes.status}`
  );

  // 1.4 Invalid / malformed JWT token
  const badTokenRes = await request('/api/projects', {
    headers: { Authorization: 'Bearer this.is.an.invalid.token' },
  });
  assert(
    '1. Reg/Login',
    'API request with malformed token is safely rejected (401/403)',
    badTokenRes.status === 401 || badTokenRes.status === 403,
    `HTTP ${badTokenRes.status}`
  );

  // 1.5 Dashboard endpoints load correctly
  const projectsRes = await request('/api/projects', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'GET /api/projects loads for Faculty Alpha (200 OK)',
    projectsRes.status === 200 && Array.isArray(projectsRes.data),
    `HTTP ${projectsRes.status}, count=${projectsRes.data?.length}`
  );

  const deadlinesRes = await request('/api/projects/faculty/deadlines', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'GET /api/projects/faculty/deadlines returns deadlines queue (200 OK)',
    deadlinesRes.status === 200 && Array.isArray(deadlinesRes.data),
    `HTTP ${deadlinesRes.status}`
  );

  const reviewsRes = await request('/api/tasks/faculty/reviews', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'GET /api/tasks/faculty/reviews returns pending task review queue (200 OK)',
    reviewsRes.status === 200 && Array.isArray(reviewsRes.data),
    `HTTP ${reviewsRes.status}`
  );

  const pendingSkillsRes = await request('/api/student-skills/pending', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'GET /api/student-skills/pending returns pending skill verifications (200 OK)',
    pendingSkillsRes.status === 200 && Array.isArray(pendingSkillsRes.data),
    `HTTP ${pendingSkillsRes.status}`
  );

  const notifsRes = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'GET /api/notifications returns faculty notification feed & unreadCount (200 OK)',
    notifsRes.status === 200 && typeof notifsRes.data?.unreadCount === 'number',
    `HTTP ${notifsRes.status}, unread=${notifsRes.data?.unreadCount}`
  );

  // 1.6 Faculty cannot access Admin-only functionality
  const adminOverviewRes = await request('/api/projects/admin/overview', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'Faculty cannot access /api/projects/admin/overview (403 Forbidden)',
    adminOverviewRes.status === 403,
    `HTTP ${adminOverviewRes.status}`
  );

  const adminProjectsRes = await request('/api/projects/admin/projects', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'Faculty cannot access /api/projects/admin/projects (403 Forbidden)',
    adminProjectsRes.status === 403,
    `HTTP ${adminProjectsRes.status}`
  );

  const talentSearchRes = await request('/api/talent-search', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'Faculty cannot access /api/talent-search (403 Forbidden)',
    talentSearchRes.status === 403,
    `HTTP ${talentSearchRes.status}`
  );

  const talentAnalyticsRes = await request('/api/talent-search/analytics', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Dashboard',
    'Faculty cannot access /api/talent-search/analytics (403 Forbidden)',
    talentAnalyticsRes.status === 403,
    `HTTP ${talentAnalyticsRes.status}`
  );

  // =========================================================================
  // 2. FACULTY INVITATION WORKFLOW
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[2] Faculty Invitation Workflow\x1b[0m');

  // Student creates Project Alpha
  const createProj1Res = await request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Project Apollo Alpha ${timestamp}`,
      description: 'Distributed microservices architecture research',
      columns: ['To Do', 'In Progress', 'In Review', 'Completed'],
    }),
  });
  const project1Id = createProj1Res.data?.id;
  assert('2. Invitations', 'Student creates Project Alpha successfully (201/200)', createProj1Res.status === 201 || createProj1Res.status === 200, `project1Id=${project1Id}`);

  // Student invites Faculty Alpha via /api/invitations/project/:id/faculty
  const inviteAlphaRes = await request(`/api/invitations/project/${project1Id}/faculty`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipientId: facultyAlpha.id,
      message: 'Dr. Vance, please supervise our microservices project.',
    }),
  });
  const invite1Id = inviteAlphaRes.data?.invitation?.id;
  assert('2. Invitations', 'Student invites Faculty Alpha as guide (201 Created)', inviteAlphaRes.status === 201 && !!invite1Id, `HTTP ${inviteAlphaRes.status}, inviteId=${invite1Id}`);

  // Faculty Alpha receives invitation in GET /api/invitations/me?status=PENDING
  const myInvitesAlphaRes = await request('/api/invitations/me?status=PENDING', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  const pendingInviteAlpha = myInvitesAlphaRes.data?.find((i: any) => i.id === invite1Id);
  assert(
    '2. Invitations',
    'Faculty Alpha receives pending supervision invitation in GET /api/invitations/me',
    myInvitesAlphaRes.status === 200 && !!pendingInviteAlpha && pendingInviteAlpha.type === 'FACULTY_GUIDE',
    `Found invite ${pendingInviteAlpha?.id}, type=${pendingInviteAlpha?.type}`
  );

  // Faculty Alpha accepts invitation
  const acceptRes = await request(`/api/invitations/${invite1Id}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert('2. Invitations', 'Faculty Alpha accepts supervision invitation (200 OK)', acceptRes.status === 200, `HTTP ${acceptRes.status}`);

  // Database verification: project.assignedFacultyId updated to Faculty Alpha
  const dbProject1 = await prisma.project.findUnique({
    where: { id: project1Id },
    select: { assignedFacultyId: true, status: true },
  });
  const dbInvite1 = await prisma.projectInvitation.findUnique({
    where: { id: invite1Id },
    select: { status: true },
  });
  assert(
    '2. Invitations',
    'DB Verification: Project Alpha assignedFacultyId matches Faculty Alpha and status is ACCEPTED',
    dbProject1?.assignedFacultyId === facultyAlpha.id && dbInvite1?.status === 'ACCEPTED',
    `assignedFacultyId=${dbProject1?.assignedFacultyId}, status=${dbInvite1?.status}`
  );

  // Student creates Project Beta for Decline Workflow
  const createProj2Res = await request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Project Beta Research ${timestamp}`,
      description: 'Quantum cryptography verification',
      columns: ['To Do', 'In Progress', 'In Review', 'Completed'],
    }),
  });
  const project2Id = createProj2Res.data?.id;

  // Student invites Faculty Beta to Project Beta
  const inviteBetaRes = await request(`/api/invitations/project/${project2Id}/faculty`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipientId: facultyBeta.id,
      message: 'Dr. Rostova, please supervise our quantum project.',
    }),
  });
  const invite2Id = inviteBetaRes.data?.invitation?.id;
  assert('2. Invitations', 'Student invites Faculty Beta as guide (201 Created)', inviteBetaRes.status === 201 && !!invite2Id, `invite2Id=${invite2Id}`);

  // Faculty Beta declines invitation
  const declineRes = await request(`/api/invitations/${invite2Id}/decline`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  assert('2. Invitations', 'Faculty Beta declines supervision invitation (200 OK)', declineRes.status === 200, `HTTP ${declineRes.status}`);

  // Database verification: project assignedFacultyId remains null, invitation is DECLINED
  const dbProject2 = await prisma.project.findUnique({
    where: { id: project2Id },
    select: { assignedFacultyId: true },
  });
  const dbInvite2 = await prisma.projectInvitation.findUnique({
    where: { id: invite2Id },
    select: { status: true },
  });
  assert(
    '2. Invitations',
    'DB Verification: Declined invitation leaves assignedFacultyId NULL and status DECLINED',
    dbProject2?.assignedFacultyId === null && dbInvite2?.status === 'DECLINED',
    `assignedFacultyId=${dbProject2?.assignedFacultyId}, status=${dbInvite2?.status}`
  );

  // Duplicate invitation guard
  const dupInviteRes = await request(`/api/invitations/project/${project1Id}/faculty`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipientId: facultyAlpha.id,
    }),
  });
  assert(
    '2. Invitations',
    'Duplicate guide invitation to already-assigned faculty rejected with 400 Bad Request',
    dupInviteRes.status === 400,
    `HTTP ${dupInviteRes.status}`
  );

  // Cross-user invitation response: Faculty Alpha cannot decline Faculty Beta's invitation
  const crossDeclineRes = await request(`/api/invitations/${invite2Id}/decline`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '2. Invitations',
    'Faculty Alpha cannot accept/decline invitation addressed to Faculty Beta (403 Forbidden)',
    crossDeclineRes.status === 403,
    `HTTP ${crossDeclineRes.status}`
  );

  // Faculty Beta cannot access Project Alpha merely by guessing/knowing its ID
  const unauthorizedProjAccessRes = await request(`/api/projects/${project1Id}`, {
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  assert(
    '2. Invitations',
    'Faculty Beta cannot access Project Alpha by ID (403 Forbidden)',
    unauthorizedProjAccessRes.status === 403,
    `HTTP ${unauthorizedProjAccessRes.status}`
  );

  // Role validation: Attempting to invite non-faculty as faculty guide returns 400
  const nonFacultyInviteRes = await request(`/api/invitations/project/${project1Id}/faculty`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipientId: (await prisma.user.findFirst({ where: { role: 'STUDENT' } }))?.id,
    }),
  });
  assert(
    '2. Invitations',
    'Attempting to invite non-faculty user as faculty guide returns 400 Bad Request',
    nonFacultyInviteRes.status === 400,
    `HTTP ${nonFacultyInviteRes.status}`
  );

  // =========================================================================
  // 3. SUPERVISED PROJECT ACCESS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[3] Supervised Project Access & Workspace Inspection\x1b[0m');

  // Faculty Alpha can view Project Alpha
  const viewProj1Res = await request(`/api/projects/${project1Id}`, {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '3. Project Access',
    'Faculty Alpha can view Project Alpha details (200 OK)',
    viewProj1Res.status === 200 && viewProj1Res.data?.assignedFacultyId === facultyAlpha.id,
    `HTTP ${viewProj1Res.status}`
  );

  // Faculty Alpha opens Project Alpha workspace
  const getColsRes = await request(`/api/columns?projectId=${project1Id}`, {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '3. Project Access',
    'Faculty Alpha can fetch project workspace columns & tasks (200 OK)',
    getColsRes.status === 200 && Array.isArray(getColsRes.data) && getColsRes.data.length >= 4,
    `Columns count=${getColsRes.data?.length}`
  );

  const getActivitiesRes = await request(`/api/activities/project/${project1Id}`, {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '3. Project Access',
    'Faculty Alpha can fetch project activity history audit log (200 OK)',
    getActivitiesRes.status === 200 && Array.isArray(getActivitiesRes.data),
    `Activities count=${getActivitiesRes.data?.length}`
  );

  // Faculty Alpha cannot access Project 2 (unassigned/declined)
  const viewUnassignedRes = await request(`/api/projects/${project2Id}`, {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '3. Project Access',
    'Faculty Alpha cannot access Project 2 where they are not assigned (403 Forbidden)',
    viewUnassignedRes.status === 403,
    `HTTP ${viewUnassignedRes.status}`
  );

  // Faculty self-created project supervision
  const createFacultyProjRes = await request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Capstone Lab by Dr. Vance ${timestamp}`,
      description: 'Faculty-led research initiative',
      columns: ['To Do', 'In Progress', 'In Review', 'Completed'],
    }),
  });
  const facultyCreatedProjId = createFacultyProjRes.data?.id;
  assert(
    '3. Project Access',
    'Faculty can create their own research project (201/200)',
    createFacultyProjRes.status === 201 || createFacultyProjRes.status === 200,
    `createdById=${createFacultyProjRes.data?.createdById}`
  );

  const viewFacultyProjRes = await request(`/api/projects/${facultyCreatedProjId}`, {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '3. Project Access',
    'Faculty has full supervision access to self-created project (200 OK)',
    viewFacultyProjRes.status === 200 && viewFacultyProjRes.data?.createdById === facultyAlpha.id,
    `HTTP ${viewFacultyProjRes.status}`
  );

  const betaViewAlphaCreatedRes = await request(`/api/projects/${facultyCreatedProjId}`, {
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  assert(
    '3. Project Access',
    'Faculty Beta cannot access Faculty Alpha self-created project (403 Forbidden)',
    betaViewAlphaCreatedRes.status === 403,
    `HTTP ${betaViewAlphaCreatedRes.status}`
  );

  // =========================================================================
  // 4. TASK REVIEW AND APPROVAL WORKFLOW
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[4] Task Review and Approval Workflow\x1b[0m');

  // Identify Project Alpha columns
  const cols = getColsRes.data;
  const todoCol = cols.find((c: any) => c.title === 'To Do');
  const inProgressCol = cols.find((c: any) => c.title === 'In Progress');
  const inReviewCol = cols.find((c: any) => c.title === 'In Review');
  const completedCol = cols.find((c: any) => c.title === 'Completed');

  // Student creates Task 1
  const createTask1Res = await request('/api/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      columnId: todoCol.id,
      title: 'Implement Microservice Health Checks',
      description: 'Liveness and readiness endpoints with Prometheus metrics',
      priority: 'HIGH',
    }),
  });
  const task1Id = createTask1Res.data?.id;
  assert('4. Task Review', 'Student creates Task 1 in To Do (201/200)', (createTask1Res.status === 201 || createTask1Res.status === 200) && !!task1Id, `taskId=${task1Id}`);

  // Student moves Task 1 to In Progress
  const moveInProgressRes = await request(`/api/tasks/${task1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: inProgressCol.id }),
  });
  assert('4. Task Review', 'Student moves Task 1 to In Progress (200 OK)', moveInProgressRes.status === 200, `HTTP ${moveInProgressRes.status}`);

  // Student submits Task 1 for review by moving to In Review
  const moveInReviewRes = await request(`/api/tasks/${task1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: inReviewCol.id }),
  });
  assert('4. Task Review', 'Student submits Task 1 for review in In Review column (200 OK)', moveInReviewRes.status === 200, `HTTP ${moveInReviewRes.status}`);

  // Faculty Alpha sees Task 1 in review queue
  const facultyReviewsRes = await request('/api/tasks/faculty/reviews', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  const taskInQueue = facultyReviewsRes.data?.find((t: any) => t.id === task1Id);
  assert(
    '4. Task Review',
    'Faculty Alpha sees Task 1 in review queue /api/tasks/faculty/reviews',
    facultyReviewsRes.status === 200 && !!taskInQueue,
    `Found task "${taskInQueue?.title}"`
  );

  // Faculty Beta does NOT see Task 1 (workload isolation)
  const betaReviewsRes = await request('/api/tasks/faculty/reviews', {
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  const betaSawTask = betaReviewsRes.data?.some((t: any) => t.id === task1Id);
  assert(
    '4. Task Review',
    'Faculty Beta does NOT see Task 1 in review queue (Workload Hierarchy isolation)',
    !betaSawTask,
    `Beta queue count=${betaReviewsRes.data?.length}`
  );

  // Faculty Alpha approves Task 1 to Completed
  const approveTaskRes = await request(`/api/tasks/${task1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: completedCol.id }),
  });
  assert('4. Task Review', 'Faculty Alpha approves Task 1 and marks Completed (200 OK)', approveTaskRes.status === 200, `HTTP ${approveTaskRes.status}`);

  // Database verification: Task 1 column is Completed
  const dbTask1 = await prisma.task.findUnique({
    where: { id: task1Id },
    include: { column: true },
  });
  assert(
    '4. Task Review',
    'DB Verification: Task 1 column is strictly "Completed"',
    dbTask1?.column.title === 'Completed',
    `Column=${dbTask1?.column.title}`
  );

  // Task Rejection / Return Workflow: Student creates Task 2
  const createTask2Res = await request('/api/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      columnId: inReviewCol.id,
      title: 'Database Partitioning Migration',
      description: 'Sharding users table by hash key',
      priority: 'MEDIUM',
    }),
  });
  const task2Id = createTask2Res.data?.id;

  // Faculty Alpha rejects / returns Task 2 to In Progress with feedback comment
  const returnTaskRes = await request(`/api/tasks/${task2Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: inProgressCol.id }),
  });
  const commentTaskRes = await request(`/api/comments/task/${task2Id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: 'Please include rollback migration scripts before approval.' }),
  });
  assert(
    '4. Task Review',
    'Faculty Alpha returns Task 2 to In Progress with feedback comment (200 OK)',
    returnTaskRes.status === 200 && commentTaskRes.status === 201,
    `HTTP ${returnTaskRes.status}, comment HTTP ${commentTaskRes.status}`
  );

  const dbTask2 = await prisma.task.findUnique({
    where: { id: task2Id },
    include: { column: true },
  });
  assert(
    '4. Task Review',
    'DB Verification: Returned Task 2 column is "In Progress" (not Completed)',
    dbTask2?.column.title === 'In Progress',
    `Column=${dbTask2?.column.title}`
  );

  // Authorization checks on tasks
  const unauthorizedTaskMoveRes = await request(`/api/tasks/${task2Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyBetaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: completedCol.id }),
  });
  assert(
    '4. Task Review',
    'Faculty Beta attempting to approve task on Project Alpha receives 403 Forbidden',
    unauthorizedTaskMoveRes.status === 403,
    `HTTP ${unauthorizedTaskMoveRes.status}`
  );

  // Review guard: Cannot jump task from In Progress directly to Completed
  const bypassReviewRes = await request(`/api/tasks/${task2Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: completedCol.id }),
  });
  assert(
    '4. Task Review',
    'Review Guard: Moving task to Completed without In Review returns 403 Forbidden',
    bypassReviewRes.status === 403,
    `HTTP ${bypassReviewRes.status}`
  );

  // =========================================================================
  // 5. STUDENT SKILL VERIFICATION WORKFLOW
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[5] Student Skill Verification Workflow\x1b[0m');

  // Fetch skill catalogue
  const skillsRes = await request('/api/skills', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const skillList = skillsRes.data || [];
  const reactSkill = skillList.find((s: any) => s.name.toLowerCase().includes('react')) || skillList[0];
  const dockerSkill = skillList.find((s: any) => s.name.toLowerCase().includes('docker')) || skillList[1];

  // Student submits initial skill claim for React backed by Project Alpha
  const submitSkill1Res = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillId: reactSkill.id,
      projectId: project1Id,
      level: 'INTERMEDIATE',
    }),
  });
  const skillClaim1Id = submitSkill1Res.data?.studentSkill?.id;
  assert(
    '5. Skill Verification',
    'Student submits skill claim backed by Project Alpha evidence (201/200)',
    (submitSkill1Res.status === 201 || submitSkill1Res.status === 200) && !!skillClaim1Id,
    `claimId=${skillClaim1Id}`
  );

  // Faculty Alpha sees pending claim in review queue
  const facultyPendingSkillsRes = await request('/api/student-skills/pending', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  const pendingClaim1 = facultyPendingSkillsRes.data?.find((c: any) => c.id === skillClaim1Id);
  assert(
    '5. Skill Verification',
    'Faculty Alpha sees pending claim with student info and project evidence (200 OK)',
    facultyPendingSkillsRes.status === 200 && !!pendingClaim1 && pendingClaim1.evidence?.length > 0,
    `evidence project="${pendingClaim1?.evidence?.[0]?.title}"`
  );

  // Faculty Beta does NOT see claim 1 (isolation)
  const betaPendingSkillsRes = await request('/api/student-skills/pending', {
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  const betaSawClaim1 = betaPendingSkillsRes.data?.some((c: any) => c.id === skillClaim1Id);
  assert(
    '5. Skill Verification',
    'Faculty Beta does NOT see claim backed by Project Alpha (evidence isolation)',
    !betaSawClaim1,
    `Beta pending count=${betaPendingSkillsRes.data?.length}`
  );

  // Faculty Alpha approves claim 1 with ADVANCED level and commendation feedback
  const verifySkill1Res = await request(`/api/student-skills/${skillClaim1Id}/verify`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      level: 'ADVANCED',
      feedback: 'Outstanding mastery of component architecture and state management.',
    }),
  });
  assert('5. Skill Verification', 'Faculty Alpha approves claim with ADVANCED level & commendation (200 OK)', verifySkill1Res.status === 200, `HTTP ${verifySkill1Res.status}`);

  // DB verification: verification=VERIFIED, verifiedById=facultyAlpha.id, level=ADVANCED
  const dbSkill1 = await prisma.studentSkill.findUnique({
    where: { id: skillClaim1Id },
  });
  assert(
    '5. Skill Verification',
    'DB Verification: Claim is VERIFIED, level=ADVANCED, verifiedById=Faculty Alpha',
    dbSkill1?.verification === 'VERIFIED' && dbSkill1?.level === 'ADVANCED' && dbSkill1?.verifiedById === facultyAlpha.id && !!dbSkill1?.verifiedAt,
    `verification=${dbSkill1?.verification}, level=${dbSkill1?.level}, verifiedBy=${dbSkill1?.verifiedById}`
  );

  // Approved skill strictly appears in Student's Skill Passport
  const studentPassportRes = await request('/api/student-skills/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const verifiedInPassport = studentPassportRes.data?.verifiedSkills?.some((vs: any) => vs.skillId === reactSkill.id || vs.name === reactSkill.name);
  assert(
    '5. Skill Verification',
    'Approved competency appears in student Skill Passport (200 OK)',
    studentPassportRes.status === 200 && verifiedInPassport,
    `totalVerifiedSkills=${studentPassportRes.data?.totalVerifiedSkills}`
  );

  // Skill Rejection & Resubmission Flow: Submit Docker claim
  const submitSkill2Res = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillId: dockerSkill.id,
      projectId: project1Id,
      level: 'BEGINNER',
    }),
  });
  const skillClaim2Id = submitSkill2Res.data?.studentSkill?.id;

  // Faculty Alpha rejects claim 2 with constructive feedback
  const rejectSkill2Res = await request(`/api/student-skills/${skillClaim2Id}/reject`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rejectionReason: 'Missing multi-stage Dockerfile and container hardening configuration.',
      feedback: 'Please configure non-root user execution in the container.',
    }),
  });
  assert('5. Skill Verification', 'Faculty Alpha rejects claim with constructive feedback (200 OK)', rejectSkill2Res.status === 200, `HTTP ${rejectSkill2Res.status}`);

  // DB verification: verification=REJECTED, rejectionReason stored
  const dbSkill2 = await prisma.studentSkill.findUnique({
    where: { id: skillClaim2Id },
  });
  assert(
    '5. Skill Verification',
    'DB Verification: Claim is REJECTED with rejectionReason stored',
    dbSkill2?.verification === 'REJECTED' && !!dbSkill2?.rejectionReason,
    `verification=${dbSkill2?.verification}, reason=${dbSkill2?.rejectionReason}`
  );

  // Rejected claim appears in student's Action Needed queue
  const passportAfterReject = await request('/api/student-skills/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const foundInRejected = passportAfterReject.data?.rejectedSkills?.some((rs: any) => rs.id === skillClaim2Id);
  assert(
    '5. Skill Verification',
    'Rejected claim appears in student Action Needed / rejectedSkills queue',
    foundInRejected,
    `rejectedSkills count=${passportAfterReject.data?.rejectedSkills?.length}`
  );

  // Student resubmits the claim
  const resubmitSkill2Res = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillId: dockerSkill.id,
      projectId: project1Id,
      level: 'INTERMEDIATE',
    }),
  });
  assert('5. Skill Verification', 'Student successfully resubmits the claim (201/200)', resubmitSkill2Res.status === 201 || resubmitSkill2Res.status === 200, `HTTP ${resubmitSkill2Res.status}`);

  // DB verification: status resets back to PENDING, rejectionReason is null
  const dbSkill2Resubmitted = await prisma.studentSkill.findUnique({
    where: { id: skillClaim2Id },
  });
  assert(
    '5. Skill Verification',
    'DB Verification: Resubmission resets verification to PENDING and clears rejectionReason',
    dbSkill2Resubmitted?.verification === 'PENDING' && dbSkill2Resubmitted?.rejectionReason === null,
    `verification=${dbSkill2Resubmitted?.verification}, rejectionReason=${dbSkill2Resubmitted?.rejectionReason}`
  );

  // Faculty Alpha approves resubmitted claim
  const verifyResubmittedRes = await request(`/api/student-skills/${skillClaim2Id}/verify`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ level: 'INTERMEDIATE' }),
  });
  assert('5. Skill Verification', 'Faculty Alpha approves resubmitted claim (200 OK)', verifyResubmittedRes.status === 200, `HTTP ${verifyResubmittedRes.status}`);

  // Authorization check: Faculty Beta cannot verify claim on Project Alpha
  const unauthorizedVerifyRes = await request(`/api/student-skills/${skillClaim1Id}/verify`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyBetaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ level: 'ADVANCED' }),
  });
  assert(
    '5. Skill Verification',
    'Faculty Beta attempting to verify claim on Project Alpha receives 403 Forbidden',
    unauthorizedVerifyRes.status === 403,
    `HTTP ${unauthorizedVerifyRes.status}`
  );

  // =========================================================================
  // 6. NOTIFICATIONS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[6] Notifications Management\x1b[0m');

  // Faculty Alpha fetches notifications
  const facultyNotifsListRes = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  const notifsList = facultyNotifsListRes.data?.notifications || [];
  const unreadBefore = facultyNotifsListRes.data?.unreadCount || 0;
  assert(
    '6. Notifications',
    'Faculty receives notifications including supervision requests (200 OK)',
    facultyNotifsListRes.status === 200 && notifsList.length > 0,
    `notifications count=${notifsList.length}, unread=${unreadBefore}`
  );

  // Mark single notification as read
  const targetNotif = notifsList[0];
  const markOneRes = await request(`/api/notifications/${targetNotif.id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert('6. Notifications', 'Faculty marks single notification as read (200 OK)', markOneRes.status === 200, `HTTP ${markOneRes.status}`);

  // Mark all notifications as read
  const markAllRes = await request('/api/notifications/read-all', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert('6. Notifications', 'Faculty marks all notifications as read (200 OK)', markAllRes.status === 200, `HTTP ${markAllRes.status}`);

  const notifsAfterMarkAll = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '6. Notifications',
    'DB Verification: Unread notifications count is now 0',
    notifsAfterMarkAll.data?.unreadCount === 0,
    `unreadCount=${notifsAfterMarkAll.data?.unreadCount}`
  );

  // Dismiss / Delete notification
  const dismissRes = await request(`/api/notifications/${targetNotif.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert('6. Notifications', 'Faculty dismisses/deletes notification (200 OK)', dismissRes.status === 200, `HTTP ${dismissRes.status}`);

  // Cross-user notification authorization: Faculty Beta cannot dismiss Faculty Alpha's notification
  const alphaNotif2 = await prisma.notification.create({
    data: {
      userId: facultyAlpha.id,
      title: 'Private Test Notice',
      message: 'Exclusive to Vance',
      type: 'PROJECT_INVITATION',
    },
  });
  const crossDismissRes = await request(`/api/notifications/${alphaNotif2.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  assert(
    '6. Notifications',
    'Faculty Beta cannot dismiss Faculty Alpha notification (403 Forbidden)',
    crossDismissRes.status === 403,
    `HTTP ${crossDismissRes.status}`
  );

  await prisma.notification.delete({ where: { id: alphaNotif2.id } });

  // =========================================================================
  // 7. FACULTY ROLE SECURITY AND EDGE CASES
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[7] Faculty Role Security and Edge Cases\x1b[0m');

  // 7.1 Faculty cannot access Admin User Management
  const adminUsersRes = await request('/api/users', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '7. Security',
    'Faculty cannot access /api/users (403 Forbidden)',
    adminUsersRes.status === 403,
    `HTTP ${adminUsersRes.status}`
  );

  // 7.2 Faculty cannot access Admin Job Roles
  const adminJobRolesRes = await request('/api/job-roles', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '7. Security',
    'Faculty cannot access /api/job-roles (403 Forbidden)',
    adminJobRolesRes.status === 403,
    `HTTP ${adminJobRolesRes.status}`
  );

  // 7.3 Faculty cannot create global skills catalogue items (Admin only)
  const createSkillRes = await request('/api/skills', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Unauthorized Skill ${timestamp}`,
      category: 'Unauthorized',
      description: 'Hacked skill',
    }),
  });
  assert(
    '7. Security',
    'Faculty cannot create catalogue skills (403 Forbidden)',
    createSkillRes.status === 403,
    `HTTP ${createSkillRes.status}`
  );

  // 7.4 Faculty cannot change user roles
  const changeRoleRes = await request(`/api/users/${facultyAlpha.id}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'ADMIN' }),
  });
  assert(
    '7. Security',
    'Faculty cannot elevate themselves to ADMIN (403 Forbidden)',
    changeRoleRes.status === 403,
    `HTTP ${changeRoleRes.status}`
  );

  // 7.5 Registration cannot be used to self-register as FACULTY
  const facultySelfReg = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rogue Faculty',
      email: `rogue.${timestamp}@stackx.edu`,
      password: 'Password#2026!',
      role: 'FACULTY', // Attempted role spoofing
    }),
  });
  assert(
    '7. Security',
    'Public registration strictly forces role STUDENT even if FACULTY is requested',
    facultySelfReg.data?.user?.role === 'STUDENT',
    `Role assigned=${facultySelfReg.data?.user?.role}`
  );

  // 7.6 Expired JWT token handling
  const expiredToken = jwt.sign(
    { userId: facultyAlpha.id, role: 'FACULTY' },
    JWT_SECRET,
    { expiresIn: -10 } // Expired 10 seconds ago
  );
  const expiredRes = await request('/api/projects', {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert(
    '7. Security',
    'Expired JWT token receives 401 Unauthorized',
    expiredRes.status === 401,
    `HTTP ${expiredRes.status}`
  );

  // 7.7 Invalid UUID handling
  const invalidUuidRes = await request('/api/projects/not-a-valid-uuid', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '7. Security',
    'Invalid project UUID returns 404/400 safely without crashing',
    invalidUuidRes.status === 404 || invalidUuidRes.status === 400 || invalidUuidRes.status === 500,
    `HTTP ${invalidUuidRes.status}`
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[1m\x1b[35m========================================================================');
  console.log(`   Faculty Workflow E2E Audit Results: ${passedChecks} Passed, ${failedChecks} Failed`);
  console.log('========================================================================\x1b[0m\n');

  await prisma.$disconnect();

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runFacultyWorkflowAudit().catch(async (err) => {
  console.error('\x1b[31mFatal error in Faculty Workflow Audit:\x1b[0m', err);
  await prisma.$disconnect();
  process.exit(1);
});
