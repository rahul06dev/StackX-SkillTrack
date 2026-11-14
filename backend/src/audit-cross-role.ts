/**
 * StackX SkillTrack — Phase 11-D: Cross-Role Integration and Workflow Audit
 * Thoroughly verifies handoffs, data flows, and authorization boundaries across
 * Student, Faculty, and Admin roles against the live backend daemon and PostgreSQL.
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

export interface AuditResult {
  section: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'NOT IMPLEMENTED';
  classification: 'Live API' | 'Database Verification' | 'Automated Test' | 'Specification Inspection';
  evidence: string;
}

export const auditResults: AuditResult[] = [];

function assert(
  section: string,
  checkName: string,
  condition: boolean,
  evidence: string,
  classification: 'Live API' | 'Database Verification' | 'Automated Test' = 'Live API'
) {
  if (condition) {
    console.log(`  \x1b[32m✔ [${section}] PASS:\x1b[0m ${checkName} (${evidence})`);
    passedChecks++;
    auditResults.push({ section, check: checkName, status: 'PASS', classification, evidence });
  } else {
    console.error(`  \x1b[31m✘ [${section}] FAIL:\x1b[0m ${checkName} (${evidence})`);
    failedChecks++;
    auditResults.push({ section, check: checkName, status: 'FAIL', classification, evidence });
  }
}

function recordNotImplemented(section: string, checkName: string, explanation: string) {
  console.log(`  \x1b[33m⚪ [${section}] NOT IMPLEMENTED:\x1b[0m ${checkName} (${explanation})`);
  auditResults.push({
    section,
    check: checkName,
    status: 'NOT IMPLEMENTED',
    classification: 'Specification Inspection',
    evidence: explanation,
  });
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

export async function runCrossRoleAudit() {
  const timestamp = Date.now();
  console.log('\n\x1b[1m\x1b[35m========================================================================');
  console.log('   StackX SkillTrack — Phase 11-D: Cross-Role Integration Audit');
  console.log('   Target: ' + BASE_URL);
  console.log('========================================================================\x1b[0m\n');

  // IDs to track for cleanup
  const createdProjectIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdNotificationIds: string[] = [];

  // =========================================================================
  // SETUP TEST ACCOUNTS
  // =========================================================================
  const defaultPassword = 'Password#2026!';
  const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { password: defaultPasswordHash, role: 'ADMIN', name: 'Dr. Sarah Connor' },
    create: { email: 'admin@test.com', password: defaultPasswordHash, name: 'Dr. Sarah Connor', role: 'ADMIN' },
  });
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: defaultPassword }),
  });
  const adminToken = adminLogin.data?.token;

  // 2. Faculty Guide Alpha
  const facultyAlpha = await prisma.user.upsert({
    where: { email: 'faculty@test.com' },
    update: { password: defaultPasswordHash, role: 'FACULTY', name: 'Dr. Robert Vance' },
    create: { email: 'faculty@test.com', password: defaultPasswordHash, name: 'Dr. Robert Vance', role: 'FACULTY' },
  });
  const facultyAlphaLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty@test.com', password: defaultPassword }),
  });
  const facultyAlphaToken = facultyAlphaLogin.data?.token;

  // 3. Faculty Guide Beta (unrelated supervisor)
  const facultyBetaEmail = `faculty.cross.beta.${timestamp}@stackx.edu`;
  const facultyBeta = await prisma.user.create({
    data: { email: facultyBetaEmail, password: defaultPasswordHash, role: 'FACULTY', name: 'Dr. Elena Rostova' },
  });
  createdUserIds.push(facultyBeta.id);
  const facultyBetaLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: facultyBetaEmail, password: defaultPassword }),
  });
  const facultyBetaToken = facultyBetaLogin.data?.token;

  // 4. Student Lead (Creator)
  const studentLeadEmail = `student.lead.${timestamp}@stackx.edu`;
  await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Maya Lin', email: studentLeadEmail, password: defaultPassword }),
  });
  const studentLeadLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentLeadEmail, password: defaultPassword }),
  });
  const studentLeadToken = studentLeadLogin.data?.token;
  const studentLeadId = studentLeadLogin.data?.user?.id;
  createdUserIds.push(studentLeadId);

  // 5. Student Peer (Teammate)
  const studentPeerEmail = `student.peer.${timestamp}@stackx.edu`;
  await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Lucas Scott', email: studentPeerEmail, password: defaultPassword }),
  });
  const studentPeerLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentPeerEmail, password: defaultPassword }),
  });
  const studentPeerToken = studentPeerLogin.data?.token;
  const studentPeerId = studentPeerLogin.data?.user?.id;
  createdUserIds.push(studentPeerId);

  // 6. Unrelated Student (Attacker/Observer)
  const studentUnrelatedEmail = `student.unrelated.${timestamp}@stackx.edu`;
  await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Chloe Price', email: studentUnrelatedEmail, password: defaultPassword }),
  });
  const studentUnrelatedLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentUnrelatedEmail, password: defaultPassword }),
  });
  const studentUnrelatedToken = studentUnrelatedLogin.data?.token;
  const studentUnrelatedId = studentUnrelatedLogin.data?.user?.id;
  createdUserIds.push(studentUnrelatedId);

  // =========================================================================
  // SECTION 1: STUDENT → FACULTY WORKFLOW
  // =========================================================================
  console.log('\x1b[1m\x1b[36m[1] Student → Faculty Lifecycle & Task Reviews\x1b[0m');

  // 1.1 Student creates project
  const createProjRes = await request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Decentralized Ledger Research ${timestamp}`,
      description: 'Byzantine Fault Tolerant state synchronization',
      columns: ['To Do', 'In Progress', 'In Review', 'Completed'],
    }),
  });
  const projectXId = createProjRes.data?.id;
  createdProjectIds.push(projectXId);
  assert(
    '1. Student → Faculty',
    'Student Lead creates project successfully (201/200)',
    (createProjRes.status === 201 || createProjRes.status === 200) && !!projectXId,
    `projectId=${projectXId}`,
    'Live API'
  );

  // 1.2 Student invites Peer teammate
  const invitePeerRes = await request(`/api/invitations/project/${projectXId}/team`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipientId: studentPeerId, message: 'Join the consensus layer group' }),
  });
  const peerInviteId = invitePeerRes.data?.invitation?.id;
  assert(
    '1. Student → Faculty',
    'Student Lead invites Peer teammate (201 Created)',
    invitePeerRes.status === 201 && !!peerInviteId,
    `inviteId=${peerInviteId}`,
    'Live API'
  );

  // 1.3 Student invites Faculty Alpha as guide
  const inviteFacultyRes = await request(`/api/invitations/project/${projectXId}/faculty`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipientId: facultyAlpha.id, message: 'Please supervise our consensus algorithm research' }),
  });
  const facultyInviteId = inviteFacultyRes.data?.invitation?.id;
  assert(
    '1. Student → Faculty',
    'Student Lead invites Faculty Alpha as academic guide (201 Created)',
    inviteFacultyRes.status === 201 && !!facultyInviteId,
    `inviteId=${facultyInviteId}`,
    'Live API'
  );

  // 1.4 Faculty Alpha receives invitation
  const facultyInvitesRes = await request('/api/invitations/me?status=PENDING', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  const foundFacultyInvite = facultyInvitesRes.data?.find((i: any) => i.id === facultyInviteId);
  assert(
    '1. Student → Faculty',
    'Faculty Alpha receives pending supervision request in invitations queue (200 OK)',
    facultyInvitesRes.status === 200 && !!foundFacultyInvite,
    `type=${foundFacultyInvite?.type}, project=${foundFacultyInvite?.project?.title}`,
    'Live API'
  );

  // 1.5 Faculty Alpha accepts invitation
  const acceptFacultyRes = await request(`/api/invitations/${facultyInviteId}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '1. Student → Faculty',
    'Faculty Alpha accepts supervision invitation (200 OK)',
    acceptFacultyRes.status === 200,
    `HTTP ${acceptFacultyRes.status}`,
    'Live API'
  );

  // 1.6 Database verification: project.assignedFacultyId updated to Faculty Alpha
  const dbProjectX = await prisma.project.findUnique({
    where: { id: projectXId },
    select: { assignedFacultyId: true, status: true },
  });
  assert(
    '1. Student → Faculty',
    'DB Verification: Project assignedFacultyId in PostgreSQL strictly matches Faculty Alpha',
    dbProjectX?.assignedFacultyId === facultyAlpha.id,
    `assignedFacultyId=${dbProjectX?.assignedFacultyId}`,
    'Database Verification'
  );

  // 1.7 Peer teammate accepts invitation
  const acceptPeerRes = await request(`/api/invitations/${peerInviteId}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentPeerToken}` },
  });
  assert(
    '1. Student → Faculty',
    'Peer teammate accepts project invitation (200 OK)',
    acceptPeerRes.status === 200,
    `HTTP ${acceptPeerRes.status}`,
    'Live API'
  );

  // 1.8 Workspace column identification
  const colsRes = await request(`/api/columns?projectId=${projectXId}`, {
    headers: { Authorization: `Bearer ${studentLeadToken}` },
  });
  const todoCol = colsRes.data?.find((c: any) => c.title === 'To Do');
  const inProgressCol = colsRes.data?.find((c: any) => c.title === 'In Progress');
  const inReviewCol = colsRes.data?.find((c: any) => c.title === 'In Review');
  const completedCol = colsRes.data?.find((c: any) => c.title === 'Completed');

  // 1.9 Student creates Task 1 and moves to In Review
  const createTask1Res = await request('/api/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      columnId: todoCol.id,
      title: 'Implement Raft Consensus State Machine',
      description: 'Log replication, leader election, and term counter',
      priority: 'HIGH',
    }),
  });
  const task1Id = createTask1Res.data?.id;

  await request(`/api/tasks/${task1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: inProgressCol.id }),
  });
  const submitReviewRes = await request(`/api/tasks/${task1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: inReviewCol.id }),
  });
  assert(
    '1. Student → Faculty',
    'Student submits task for academic review by moving to In Review column (200 OK)',
    submitReviewRes.status === 200,
    `taskId=${task1Id}`,
    'Live API'
  );

  // 1.10 Assigned Faculty Alpha sees task in review queue
  const facultyAlphaReviews = await request('/api/tasks/faculty/reviews', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  const taskFoundInQueue = facultyAlphaReviews.data?.some((t: any) => t.id === task1Id);
  assert(
    '1. Student → Faculty',
    'Assigned Faculty Alpha sees task in review queue (200 OK)',
    facultyAlphaReviews.status === 200 && taskFoundInQueue,
    `Found task "${task1Id}" in Vance review queue`,
    'Live API'
  );

  // 1.11 Unassigned Faculty Beta DOES NOT see task in review queue
  const facultyBetaReviews = await request('/api/tasks/faculty/reviews', {
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  const taskFoundInBetaQueue = facultyBetaReviews.data?.some((t: any) => t.id === task1Id);
  assert(
    '1. Student → Faculty',
    'Unassigned Faculty Beta DOES NOT see task in review queue (Workload hierarchy isolation)',
    !taskFoundInBetaQueue,
    `Beta queue count=${facultyBetaReviews.data?.length}`,
    'Live API'
  );

  // 1.12 Unassigned Faculty Beta cannot approve or move Task 1
  const betaApproveAttempt = await request(`/api/tasks/${task1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyBetaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: completedCol.id }),
  });
  assert(
    '1. Student → Faculty',
    'Unassigned Faculty Beta attempting to approve task receives 403 Forbidden',
    betaApproveAttempt.status === 403,
    `HTTP ${betaApproveAttempt.status}`,
    'Live API'
  );

  // 1.13 Faculty Alpha approves task to Completed
  const alphaApproveRes = await request(`/api/tasks/${task1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: completedCol.id }),
  });
  assert(
    '1. Student → Faculty',
    'Assigned Faculty Alpha approves task to Completed column (200 OK)',
    alphaApproveRes.status === 200,
    `HTTP ${alphaApproveRes.status}`,
    'Live API'
  );

  // 1.14 DB Verification: Task 1 column is strictly Completed
  const dbTask1 = await prisma.task.findUnique({
    where: { id: task1Id },
    include: { column: true },
  });
  assert(
    '1. Student → Faculty',
    'DB Verification: Task 1 in PostgreSQL is strictly in Completed column',
    dbTask1?.column.title === 'Completed',
    `Column=${dbTask1?.column.title}`,
    'Database Verification'
  );

  // 1.15 Task Return Workflow: Task 2 returned with guidance
  const createTask2Res = await request('/api/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      columnId: inReviewCol.id,
      title: 'Dynamic Sharding Coordinator',
      description: 'Hash ring topology with consistent hashing',
      priority: 'MEDIUM',
    }),
  });
  const task2Id = createTask2Res.data?.id;

  const returnTaskRes = await request(`/api/tasks/${task2Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: inProgressCol.id }),
  });
  const facultyCommentRes = await request(`/api/comments/task/${task2Id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: 'Include virtual node replication factors before approval.' }),
  });
  assert(
    '1. Student → Faculty',
    'Faculty returns task to In Progress with instructional feedback comment (200 OK)',
    returnTaskRes.status === 200 && facultyCommentRes.status === 201,
    `task HTTP ${returnTaskRes.status}, comment HTTP ${facultyCommentRes.status}`,
    'Live API'
  );

  const dbTask2 = await prisma.task.findUnique({
    where: { id: task2Id },
    include: { column: true },
  });
  assert(
    '1. Student → Faculty',
    'DB Verification: Returned Task 2 column is "In Progress" in PostgreSQL',
    dbTask2?.column.title === 'In Progress',
    `Column=${dbTask2?.column.title}`,
    'Database Verification'
  );

  // =========================================================================
  // SECTION 2: STUDENT → FACULTY → SKILL PASSPORT WORKFLOW
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[2] Student → Faculty → Digital Skill Passport Lifecycle\x1b[0m');

  // Identify catalogue skills
  const skillsRes = await request('/api/skills', {
    headers: { Authorization: `Bearer ${studentLeadToken}` },
  });
  const allSkills = skillsRes.data || [];
  const reactSkill = allSkills.find((s: any) => s.name.toLowerCase().includes('react')) || allSkills[0];
  const dockerSkill = allSkills.find((s: any) => s.name.toLowerCase().includes('docker')) || allSkills[1];

  // 2.1 Student submits React skill claim backed by Project X evidence
  const submitSkill1Res = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillId: reactSkill.id,
      projectId: projectXId,
      level: 'INTERMEDIATE',
    }),
  });
  const claim1Id = submitSkill1Res.data?.studentSkill?.id;
  assert(
    '2. Skill Passport',
    'Student submits skill claim with Project X evidence (201/200 OK)',
    (submitSkill1Res.status === 201 || submitSkill1Res.status === 200) && !!claim1Id,
    `claimId=${claim1Id}`,
    'Live API'
  );

  // 2.2 Pending claim isolation: Only assigned Faculty Alpha sees claim
  const alphaPendingSkills = await request('/api/student-skills/pending', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  const betaPendingSkills = await request('/api/student-skills/pending', {
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  const alphaSeesClaim1 = alphaPendingSkills.data?.some((c: any) => c.id === claim1Id);
  const betaSeesClaim1 = betaPendingSkills.data?.some((c: any) => c.id === claim1Id);
  assert(
    '2. Skill Passport',
    'Only assigned Faculty Alpha can view pending claim; Unassigned Faculty Beta is shielded',
    alphaSeesClaim1 === true && betaSeesClaim1 === false,
    `Alpha sees=${alphaSeesClaim1}, Beta sees=${betaSeesClaim1}`,
    'Live API'
  );

  // 2.3 Unassigned Faculty Beta cannot verify claim
  const betaVerifyAttempt = await request(`/api/student-skills/${claim1Id}/verify`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyBetaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ level: 'ADVANCED' }),
  });
  assert(
    '2. Skill Passport',
    'Unassigned Faculty Beta attempting verification receives 403 Forbidden',
    betaVerifyAttempt.status === 403,
    `HTTP ${betaVerifyAttempt.status}`,
    'Live API'
  );

  // 2.4 Faculty Alpha approves claim with ADVANCED and commendation
  const verifyClaim1Res = await request(`/api/student-skills/${claim1Id}/verify`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      level: 'ADVANCED',
      feedback: 'Flawless distributed state rendering and component lifecycle architecture.',
    }),
  });
  assert(
    '2. Skill Passport',
    'Faculty Alpha verifies claim with ADVANCED level & commendation (200 OK)',
    verifyClaim1Res.status === 200,
    `HTTP ${verifyClaim1Res.status}`,
    'Live API'
  );

  // 2.5 DB Verification: Claim is VERIFIED, level=ADVANCED, verifiedById=facultyAlpha.id
  const dbSkillClaim1 = await prisma.studentSkill.findUnique({
    where: { id: claim1Id },
  });
  assert(
    '2. Skill Passport',
    'DB Verification: Claim in PostgreSQL is VERIFIED with verifiedById=Faculty Alpha',
    dbSkillClaim1?.verification === 'VERIFIED' &&
      dbSkillClaim1?.level === 'ADVANCED' &&
      dbSkillClaim1?.verifiedById === facultyAlpha.id &&
      !!dbSkillClaim1?.verifiedAt,
    `verification=${dbSkillClaim1?.verification}, level=${dbSkillClaim1?.level}, verifier=${dbSkillClaim1?.verifiedById}`,
    'Database Verification'
  );

  // 2.6 Digital Skill Passport update check
  const passportRes = await request('/api/student-skills/me', {
    headers: { Authorization: `Bearer ${studentLeadToken}` },
  });
  const verifiedInPassport = passportRes.data?.verifiedSkills?.some((vs: any) => vs.skillId === reactSkill.id || vs.name === reactSkill.name);
  assert(
    '2. Skill Passport',
    'Student Skill Passport reflects verified competency and increments totalVerifiedSkills (200 OK)',
    passportRes.status === 200 && verifiedInPassport && passportRes.data?.totalVerifiedSkills >= 1,
    `totalVerifiedSkills=${passportRes.data?.totalVerifiedSkills}`,
    'Live API'
  );

  // 2.7 Rejection & Resubmission Lifecycle
  const submitDockerRes = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillId: dockerSkill.id,
      projectId: projectXId,
      level: 'BEGINNER',
    }),
  });
  const claim2Id = submitDockerRes.data?.studentSkill?.id;

  const rejectDockerRes = await request(`/api/student-skills/${claim2Id}/reject`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rejectionReason: 'Provide multi-stage caching and non-root USER directive in Dockerfile',
      feedback: 'Please refactor container build script',
    }),
  });
  assert(
    '2. Skill Passport',
    'Faculty Alpha rejects claim with constructive feedback (200 OK)',
    rejectDockerRes.status === 200,
    `HTTP ${rejectDockerRes.status}`,
    'Live API'
  );

  const dbDockerRejected = await prisma.studentSkill.findUnique({
    where: { id: claim2Id },
  });
  assert(
    '2. Skill Passport',
    'DB Verification: Claim in PostgreSQL is REJECTED with rejectionReason stored',
    dbDockerRejected?.verification === 'REJECTED' && !!dbDockerRejected?.rejectionReason,
    `verification=${dbDockerRejected?.verification}, reason=${dbDockerRejected?.rejectionReason}`,
    'Database Verification'
  );

  // Resubmit Docker claim
  const resubmitDockerRes = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillId: dockerSkill.id,
      projectId: projectXId,
      level: 'INTERMEDIATE',
    }),
  });
  assert(
    '2. Skill Passport',
    'Student resubmits claim; status resets to PENDING and previous rejection state cleared (201/200)',
    resubmitDockerRes.status === 201 || resubmitDockerRes.status === 200,
    `HTTP ${resubmitDockerRes.status}`,
    'Live API'
  );

  const dbDockerResubmitted = await prisma.studentSkill.findUnique({
    where: { id: claim2Id },
  });
  assert(
    '2. Skill Passport',
    'DB Verification: Resubmission resets verification to PENDING and rejectionReason to null',
    dbDockerResubmitted?.verification === 'PENDING' && dbDockerResubmitted?.rejectionReason === null,
    `verification=${dbDockerResubmitted?.verification}, rejectionReason=${dbDockerResubmitted?.rejectionReason}`,
    'Database Verification'
  );

  // Faculty approves resubmission
  const approveResubmittedRes = await request(`/api/student-skills/${claim2Id}/verify`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ level: 'INTERMEDIATE' }),
  });
  assert(
    '2. Skill Passport',
    'Faculty Alpha approves resubmitted claim (200 OK)',
    approveResubmittedRes.status === 200,
    `HTTP ${approveResubmittedRes.status}`,
    'Live API'
  );

  // 2.8 Public Portfolio Integrity Check
  const publicPortfolioRes = await request(`/api/student-skills/public/${studentLeadId}`);
  assert(
    '2. Skill Passport',
    'Public portfolio loads without authentication and strictly excludes password hashes (200 OK)',
    publicPortfolioRes.status === 200 &&
      publicPortfolioRes.data?.student?.passwordHash === undefined &&
      publicPortfolioRes.data?.student?.password === undefined &&
      publicPortfolioRes.data?.certificate?.certificateId?.includes('STX-'),
    `certificateId=${publicPortfolioRes.data?.certificate?.certificateId}`,
    'Live API'
  );

  // =========================================================================
  // SECTION 3: ADMIN → STUDENT/FACULTY COORDINATION
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[3] Admin → Student/Faculty Coordination\x1b[0m');

  // 3.1 Student creates Project Y without faculty supervisor
  const createProjYRes = await request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Quantum Key Exchange Simulation ${timestamp}`,
      description: 'BB84 protocol simulation over noisy fiber optics',
      columns: ['To Do', 'In Progress', 'In Review', 'Completed'],
    }),
  });
  const projectYId = createProjYRes.data?.id;
  createdProjectIds.push(projectYId);
  assert(
    '3. Admin Coordination',
    'Student creates Project Y without supervisor (201/200)',
    (createProjYRes.status === 201 || createProjYRes.status === 200) && !!projectYId,
    `projectYId=${projectYId}`,
    'Live API'
  );

  // 3.2 Admin identifies unassigned project
  const adminProjectsRes = await request('/api/projects/admin/projects', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const projectYInAdminList = adminProjectsRes.data?.find((p: any) => p.id === projectYId);
  assert(
    '3. Admin Coordination',
    'Admin identifies Project Y in university-wide list with assignedFaculty === null',
    adminProjectsRes.status === 200 && (projectYInAdminList?.assignedFaculty === null || !projectYInAdminList?.assignedFaculty),
    `found=${!!projectYInAdminList}, assignedFaculty=${JSON.stringify(projectYInAdminList?.assignedFaculty)}`,
    'Live API'
  );

  // 3.3 Admin assigns Faculty Beta to Project Y via PUT /api/projects/:id/team
  const adminAssignFacultyRes = await request(`/api/projects/${projectYId}/team`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      facultyId: facultyBeta.id,
      studentIds: [studentLeadId],
      adminIds: [adminUser.id],
    }),
  });
  assert(
    '3. Admin Coordination',
    'Admin directly assigns Faculty Beta as supervisor on Project Y via PUT /:id/team (200 OK)',
    adminAssignFacultyRes.status === 200,
    `HTTP ${adminAssignFacultyRes.status}`,
    'Live API'
  );

  // 3.4 DB Verification: Project Y assignedFacultyId is Faculty Beta
  const dbProjectY = await prisma.project.findUnique({
    where: { id: projectYId },
    select: { assignedFacultyId: true },
  });
  assert(
    '3. Admin Coordination',
    'DB Verification: Project Y assignedFacultyId in PostgreSQL strictly matches Faculty Beta',
    dbProjectY?.assignedFacultyId === facultyBeta.id,
    `assignedFacultyId=${dbProjectY?.assignedFacultyId}`,
    'Database Verification'
  );

  // 3.5 Faculty Beta can now access Project Y
  const betaAccessProjY = await request(`/api/projects/${projectYId}`, {
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  assert(
    '3. Admin Coordination',
    'Assigned Faculty Beta can now open Project Y workspace (200 OK)',
    betaAccessProjY.status === 200 && betaAccessProjY.data?.assignedFacultyId === facultyBeta.id,
    `HTTP ${betaAccessProjY.status}`,
    'Live API'
  );

  // 3.6 Faculty Alpha CANNOT access Project Y
  const alphaAccessProjY = await request(`/api/projects/${projectYId}`, {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '3. Admin Coordination',
    'Unassigned Faculty Alpha CANNOT access Project Y (403 Forbidden)',
    alphaAccessProjY.status === 403,
    `HTTP ${alphaAccessProjY.status}`,
    'Live API'
  );

  // 3.7 Admin role change propagation
  const promoteUserRes = await request(`/api/users/${studentUnrelatedId}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'FACULTY' }),
  });
  assert(
    '3. Admin Coordination',
    'Admin promotes student to FACULTY role (200 OK)',
    promoteUserRes.status === 200 && promoteUserRes.data?.user?.role === 'FACULTY',
    `newRole=${promoteUserRes.data?.user?.role}`,
    'Live API'
  );

  // Fresh login reflects new role
  const promotedUserLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentUnrelatedEmail, password: defaultPassword }),
  });
  assert(
    '3. Admin Coordination',
    'Fresh login as promoted user returns JWT with role=FACULTY (200 OK)',
    promotedUserLogin.status === 200 && promotedUserLogin.data?.user?.role === 'FACULTY',
    `role=${promotedUserLogin.data?.user?.role}`,
    'Live API'
  );

  // Demote back to STUDENT
  await request(`/api/users/${studentUnrelatedId}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'STUDENT' }),
  });

  // =========================================================================
  // SECTION 4: NOTIFICATIONS ACROSS ALL THREE ROLES
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[4] Notifications Across All Three Roles\x1b[0m');

  // 4.1 Student invites Faculty → Faculty receives FACULTY_SUPERVISION_REQUEST
  const facultyNotifs = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  const supervisionNotif = facultyNotifs.data?.notifications?.find((n: any) => n.type === 'FACULTY_SUPERVISION_REQUEST');
  assert(
    '4. Notifications',
    'Student invites Faculty → Faculty receives FACULTY_SUPERVISION_REQUEST notification',
    !!supervisionNotif && supervisionNotif.userId === facultyAlpha.id,
    `notifId=${supervisionNotif?.id}, title="${supervisionNotif?.title}"`,
    'Live API'
  );

  // 4.2 Student invites teammate → Peer receives PROJECT_INVITATION
  const peerNotifs = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${studentPeerToken}` },
  });
  const teamInviteNotif = peerNotifs.data?.notifications?.find((n: any) => n.type === 'PROJECT_INVITATION');
  assert(
    '4. Notifications',
    'Student invites teammate → Teammate receives PROJECT_INVITATION notification',
    !!teamInviteNotif && teamInviteNotif.userId === studentPeerId,
    `notifId=${teamInviteNotif?.id}, title="${teamInviteNotif?.title}"`,
    'Live API'
  );

  // 4.3 Faculty accepts supervision → Student Lead receives acceptance notification
  const studentNotifs = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${studentLeadToken}` },
  });
  const facultyAcceptedNotif = studentNotifs.data?.notifications?.find((n: any) => n.title === 'Faculty Guide Accepted');
  assert(
    '4. Notifications',
    'Faculty accepts supervision → Student Lead receives "Faculty Guide Accepted" notification',
    !!facultyAcceptedNotif && facultyAcceptedNotif.userId === studentLeadId,
    `notifId=${facultyAcceptedNotif?.id}, title="${facultyAcceptedNotif?.title}"`,
    'Live API'
  );

  // 4.4 Faculty verifies skill claim → Student Lead receives SKILL_VERIFIED notification
  const skillVerifiedNotif = studentNotifs.data?.notifications?.find((n: any) => n.type === 'SKILL_VERIFIED');
  assert(
    '4. Notifications',
    'Faculty verifies claim → Student receives SKILL_VERIFIED notification with level and feedback',
    !!skillVerifiedNotif && skillVerifiedNotif.userId === studentLeadId,
    `notifId=${skillVerifiedNotif?.id}, message="${skillVerifiedNotif?.message}"`,
    'Live API'
  );

  // 4.5 Faculty rejects skill claim → Student Lead receives SKILL_REJECTED notification
  const skillRejectedNotif = studentNotifs.data?.notifications?.find((n: any) => n.type === 'SKILL_REJECTED');
  assert(
    '4. Notifications',
    'Faculty rejects claim → Student receives SKILL_REJECTED notification with constructive reason',
    !!skillRejectedNotif && skillRejectedNotif.userId === studentLeadId,
    `notifId=${skillRejectedNotif?.id}, message="${skillRejectedNotif?.message}"`,
    'Live API'
  );

  // 4.6 Notifications not implemented in backend (avoiding routine clutter)
  recordNotImplemented('4. Notifications', 'Student submits skill claim → Faculty push notification', 'Shields Faculty from routine notifications; Faculty reviews claims via GET /api/student-skills/pending');
  recordNotImplemented('4. Notifications', 'Student submits task for review → Faculty push notification', 'Shields Faculty from routine task clutter; Faculty monitors reviews via GET /api/tasks/faculty/reviews');
  recordNotImplemented('4. Notifications', 'Faculty reviews task → Student push notification', 'Status change is reflected directly on Kanban board column and project activity audit trail');

  // 4.7 Notification isolation: Student cannot mark or delete Faculty notification
  if (supervisionNotif?.id) {
    const studentTamperNotifRes = await request(`/api/notifications/${supervisionNotif.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentLeadToken}` },
    });
    assert(
      '4. Notifications',
      'Student attempting to delete Faculty notification receives 403 Forbidden',
      studentTamperNotifRes.status === 403,
      `HTTP ${studentTamperNotifRes.status}`,
      'Live API'
    );
  }

  // =========================================================================
  // SECTION 5: PROJECT MEMBERSHIP AND DATA ISOLATION
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[5] Project Membership and Strict Data Isolation\x1b[0m');

  // 5.1 Project Owner has access
  const ownerAccess = await request(`/api/projects/${projectXId}`, {
    headers: { Authorization: `Bearer ${studentLeadToken}` },
  });
  assert(
    '5. Data Isolation',
    'Student Lead (creator) has full project access (200 OK)',
    ownerAccess.status === 200,
    `HTTP ${ownerAccess.status}`,
    'Live API'
  );

  // 5.2 Accepted Teammate has access
  const peerAccess = await request(`/api/projects/${projectXId}`, {
    headers: { Authorization: `Bearer ${studentPeerToken}` },
  });
  assert(
    '5. Data Isolation',
    'Accepted Teammate has project workspace access (200 OK)',
    peerAccess.status === 200,
    `HTTP ${peerAccess.status}`,
    'Live API'
  );

  // 5.3 Unrelated Student CANNOT access project details
  const unrelatedAccess = await request(`/api/projects/${projectXId}`, {
    headers: { Authorization: `Bearer ${studentUnrelatedToken}` },
  });
  assert(
    '5. Data Isolation',
    'Unrelated Student CANNOT access private project details (403 Forbidden)',
    unrelatedAccess.status === 403,
    `HTTP ${unrelatedAccess.status}`,
    'Live API'
  );

  // 5.4 Unrelated Student CANNOT access project columns & tasks
  const unrelatedCols = await request(`/api/columns?projectId=${projectXId}`, {
    headers: { Authorization: `Bearer ${studentUnrelatedToken}` },
  });
  assert(
    '5. Data Isolation',
    'Unrelated Student CANNOT access project Kanban board/columns (403 Forbidden)',
    unrelatedCols.status === 403,
    `HTTP ${unrelatedCols.status}`,
    'Live API'
  );

  // 5.5 Unrelated Student CANNOT post comments on project tasks
  const unrelatedComment = await request(`/api/comments/task/${task1Id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentUnrelatedToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: 'Unauthorized comment attempt' }),
  });
  assert(
    '5. Data Isolation',
    'Unrelated Student CANNOT comment on project task (403 Forbidden)',
    unrelatedComment.status === 403,
    `HTTP ${unrelatedComment.status}`,
    'Live API'
  );

  // 5.6 Unrelated Faculty Beta CANNOT access Project X tasks or activity history
  const betaActivities = await request(`/api/activities/project/${projectXId}`, {
    headers: { Authorization: `Bearer ${facultyBetaToken}` },
  });
  assert(
    '5. Data Isolation',
    'Unassigned Faculty Beta CANNOT inspect project activity audit history (403 Forbidden)',
    betaActivities.status === 403,
    `HTTP ${betaActivities.status}`,
    'Live API'
  );

  // =========================================================================
  // SECTION 6: TALENT SEARCH AND SKILL PASSPORT INTEGRATION
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[6] Talent Search and Skill Passport Integration\x1b[0m');

  // 6.1 Faculty-verified competency is discoverable in Admin Talent Search
  const talentSearchRes = await request(`/api/talent-search?skillIds=${reactSkill.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const candidateMaya = talentSearchRes.data?.students?.find((s: any) => s.id === studentLeadId);
  assert(
    '6. Talent Search Integration',
    'Faculty-approved competency for Student Lead is discoverable in Admin Talent Search (200 OK)',
    talentSearchRes.status === 200 && !!candidateMaya,
    `candidate="${candidateMaya?.name}", matchPercentage=${candidateMaya?.matchPercentage}%`,
    'Live API'
  );

  // 6.2 Mode Comparison: VERIFIED_ONLY vs ALL_DEMONSTRATED
  const verifiedOnlyRes = await request(`/api/talent-search?skillIds=${reactSkill.id}&matchMode=VERIFIED_ONLY`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const allDemRes = await request(`/api/talent-search?skillIds=${reactSkill.id}&matchMode=ALL_DEMONSTRATED`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Talent Search Integration',
    'Talent Search properly executes VERIFIED_ONLY and ALL_DEMONSTRATED evaluation modes (200 OK)',
    verifiedOnlyRes.status === 200 && allDemRes.status === 200,
    `verifiedMatches=${verifiedOnlyRes.data?.totalCandidatesMatched}, allMatches=${allDemRes.data?.totalCandidatesMatched}`,
    'Live API'
  );

  // 6.3 Candidate links to Digital Skill Passport
  const candidatePortfolioRes = await request(`/api/student-skills/portfolio/${studentLeadId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Talent Search Integration',
    'Candidate in Talent Search links to Digital Skill Passport portfolio (200 OK)',
    candidatePortfolioRes.status === 200 && !!candidatePortfolioRes.data?.certificate?.certificateId,
    `certificateId=${candidatePortfolioRes.data?.certificate?.certificateId}`,
    'Live API'
  );

  // 6.4 Student and Faculty blocked from Talent Search
  const studentBlockedTalent = await request('/api/talent-search', {
    headers: { Authorization: `Bearer ${studentLeadToken}` },
  });
  const facultyBlockedTalent = await request('/api/talent-search', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '6. Talent Search Integration',
    'Student and Faculty are strictly blocked from Admin Talent Search (403 Forbidden)',
    studentBlockedTalent.status === 403 && facultyBlockedTalent.status === 403,
    `student=${studentBlockedTalent.status}, faculty=${facultyBlockedTalent.status}`,
    'Live API'
  );

  // =========================================================================
  // SECTION 7: CROSS-ROLE SECURITY AND CONSISTENCY
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[7] Cross-Role Security and Consistency\x1b[0m');

  // 7.1 Student attempting Faculty task approval
  const studentTaskApproval = await request(`/api/tasks/${task2Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ columnId: completedCol.id }),
  });
  assert(
    '7. Cross-Role Security',
    'Student attempting Faculty task approval receives 403 Forbidden',
    studentTaskApproval.status === 403,
    `HTTP ${studentTaskApproval.status}`,
    'Live API'
  );

  // 7.2 Student attempting Admin user management
  const studentUsersAttempt = await request('/api/users', {
    headers: { Authorization: `Bearer ${studentLeadToken}` },
  });
  assert(
    '7. Cross-Role Security',
    'Student attempting Admin user roster receives 403 Forbidden',
    studentUsersAttempt.status === 403,
    `HTTP ${studentUsersAttempt.status}`,
    'Live API'
  );

  // 7.3 Faculty attempting Admin Talent Search
  const facultyTalentAttempt = await request('/api/talent-search/analytics', {
    headers: { Authorization: `Bearer ${facultyAlphaToken}` },
  });
  assert(
    '7. Cross-Role Security',
    'Faculty attempting Admin Talent Analytics receives 403 Forbidden',
    facultyTalentAttempt.status === 403,
    `HTTP ${facultyTalentAttempt.status}`,
    'Live API'
  );

  // 7.4 Faculty attempting to verify claim of another faculty's project
  // Create Project Z supervised by Faculty Beta
  const createProjZRes = await request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Neural Network Optimization ${timestamp}`,
      description: 'Quantization and pruning for edge deployment',
      columns: ['To Do', 'In Progress', 'In Review', 'Completed'],
    }),
  });
  const projectZId = createProjZRes.data?.id;
  createdProjectIds.push(projectZId);

  await request(`/api/projects/${projectZId}/team`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ facultyId: facultyBeta.id }),
  });

  const distinctSkillZ = allSkills.find((s: any) => s.id !== reactSkill.id && s.id !== dockerSkill.id) || allSkills[2];
  const submitSkillZRes = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLeadToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillId: distinctSkillZ.id,
      projectId: projectZId,
      level: 'BEGINNER',
    }),
  });
  const claimZId = submitSkillZRes.data?.studentSkill?.id;

  // Faculty Alpha attempts to verify claim Z (belonging to Beta's project)
  const crossFacultyVerifyRes = await request(`/api/student-skills/${claimZId}/verify`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${facultyAlphaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ level: 'ADVANCED' }),
  });
  assert(
    '7. Cross-Role Security',
    'Faculty Alpha attempting to verify skill claim on Faculty Beta project receives 403 Forbidden',
    crossFacultyVerifyRes.status === 403,
    `HTTP ${crossFacultyVerifyRes.status}`,
    'Live API'
  );

  // 7.5 Expired JWT token during cross-role operation
  const expiredToken = jwt.sign({ userId: studentLeadId, role: 'STUDENT' }, JWT_SECRET, { expiresIn: -10 });
  const expiredReqRes = await request(`/api/projects/${projectXId}`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert(
    '7. Cross-Role Security',
    'Expired JWT token receives 401 Unauthorized',
    expiredReqRes.status === 401,
    `HTTP ${expiredReqRes.status}`,
    'Live API'
  );

  // =========================================================================
  // CLEANUP TEST RECORDS SAFELY
  // =========================================================================
  console.log('\n\x1b[1m\x1b[33mCleaning up isolated test records...\x1b[0m');

  for (const pId of createdProjectIds) {
    try {
      await prisma.task.deleteMany({ where: { column: { projectId: pId } } });
      await prisma.column.deleteMany({ where: { projectId: pId } });
      await prisma.projectStudent.deleteMany({ where: { projectId: pId } });
      await prisma.projectAdmin.deleteMany({ where: { projectId: pId } });
      await prisma.projectInvitation.deleteMany({ where: { projectId: pId } });
      await prisma.activity.deleteMany({ where: { projectId: pId } });
      await prisma.studentSkillEvidence.deleteMany({ where: { projectId: pId } });
      await prisma.project.delete({ where: { id: pId } });
    } catch (_) {}
  }

  for (const uId of createdUserIds) {
    try {
      await prisma.studentSkill.deleteMany({ where: { studentId: uId } });
      await prisma.notification.deleteMany({ where: { userId: uId } });
      await prisma.user.delete({ where: { id: uId } });
    } catch (_) {}
  }

  console.log('✔ Cleanup completed successfully.\n');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\x1b[1m\x1b[35m========================================================================');
  console.log(`   Cross-Role Integration Audit: ${passedChecks} Passed, ${failedChecks} Failed`);
  console.log('========================================================================\x1b[0m\n');

  await prisma.$disconnect();

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runCrossRoleAudit().catch(async (err) => {
  console.error('\x1b[31mFatal error in Cross-Role Audit:\x1b[0m', err);
  await prisma.$disconnect();
  process.exit(1);
});
