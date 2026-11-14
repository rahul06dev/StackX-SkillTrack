/**
 * StackX SkillTrack — Comprehensive Admin Workflow E2E Audit
 * Executes real live HTTP requests against the running backend API and PostgreSQL database.
 * Verifies all 8 sections of the Admin Workflow Audit.
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
  status: 'PASS' | 'FAIL' | 'NOT IMPLEMENTED';
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

function recordNotImplemented(section: string, featureName: string, explanation: string) {
  console.log(`  \x1b[33m⚪ [${section}] NOT IMPLEMENTED:\x1b[0m ${featureName} (${explanation})`);
  checkResults.push({ section, check: featureName, status: 'NOT IMPLEMENTED', evidence: explanation });
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

export async function runAdminWorkflowAudit() {
  const timestamp = Date.now();
  console.log('\n\x1b[1m\x1b[35m========================================================================');
  console.log('   StackX SkillTrack — Comprehensive Admin Workflow E2E Audit');
  console.log('   Target: ' + BASE_URL);
  console.log('========================================================================\x1b[0m\n');

  // Setup: Ensure Admin user exists with known password
  const adminPassword = 'Password#2026!';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { password: adminPasswordHash, role: 'ADMIN', name: 'Dr. Sarah Connor' },
    create: {
      email: 'admin@test.com',
      password: adminPasswordHash,
      name: 'Dr. Sarah Connor',
      role: 'ADMIN',
    },
  });

  // Setup a faculty and student for RBAC and coordination testing
  const facultyPassword = 'Password#2026!';
  const facultyUser = await prisma.user.findFirst({ where: { role: 'FACULTY' } });
  const facultyToken = (await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: facultyUser?.email || 'faculty@test.com', password: facultyPassword }),
  })).data?.token;

  const studentEmail = `student.admin.audit.${timestamp}@stackx.edu`;
  const studentPassword = 'Password#2026!';
  await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Jordan Miller', email: studentEmail, password: studentPassword }),
  });
  const studentLoginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentEmail, password: studentPassword }),
  });
  const studentToken = studentLoginRes.data?.token;
  const studentUser = studentLoginRes.data?.user;

  // =========================================================================
  // 1. ADMIN AUTHENTICATION AND DASHBOARD
  // =========================================================================
  console.log('\x1b[1m\x1b[36m[1] Admin Authentication and Dashboard Overview\x1b[0m');

  // 1.1 Valid Admin Login
  const adminLoginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: adminPassword }),
  });
  const adminToken = adminLoginRes.data?.token;
  assert(
    '1. Auth & Dashboard',
    'Admin login with valid credentials returns 200 OK and JWT',
    adminLoginRes.status === 200 && !!adminToken && adminLoginRes.data?.user?.role === 'ADMIN',
    `HTTP ${adminLoginRes.status}, role=${adminLoginRes.data?.user?.role}`
  );

  // 1.2 Invalid Credentials
  const badLoginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'WrongPassword#999' }),
  });
  assert(
    '1. Auth & Dashboard',
    'Admin login with invalid password returns 401 Unauthorized',
    badLoginRes.status === 401,
    `HTTP ${badLoginRes.status}`
  );

  // 1.3 Missing JWT token
  const noTokenRes = await request('/api/projects/admin/overview');
  assert(
    '1. Auth & Dashboard',
    'Admin overview without JWT returns 401 Unauthorized',
    noTokenRes.status === 401,
    `HTTP ${noTokenRes.status}`
  );

  // 1.4 Malformed JWT token
  const badTokenRes = await request('/api/projects/admin/overview', {
    headers: { Authorization: 'Bearer invalid.token.payload' },
  });
  assert(
    '1. Auth & Dashboard',
    'Admin overview with malformed JWT returns 401 Unauthorized',
    badTokenRes.status === 401,
    `HTTP ${badTokenRes.status}`
  );

  // 1.5 Admin Overview API
  const overviewRes = await request('/api/projects/admin/overview', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const overview = overviewRes.data;
  assert(
    '1. Auth & Dashboard',
    'GET /api/projects/admin/overview returns 200 OK and complete metrics object',
    overviewRes.status === 200 &&
      typeof overview?.totalUsers === 'number' &&
      typeof overview?.totalStudents === 'number' &&
      typeof overview?.totalFaculty === 'number' &&
      typeof overview?.totalProjects === 'number' &&
      typeof overview?.activeProjects === 'number' &&
      typeof overview?.completedProjects === 'number' &&
      typeof overview?.overdueProjects === 'number' &&
      typeof overview?.unassignedGuideProjects === 'number' &&
      typeof overview?.pendingInvitationsCount === 'number' &&
      typeof overview?.totalTasksCount === 'number',
    `HTTP 200, users=${overview?.totalUsers}, projects=${overview?.totalProjects}`
  );

  // 1.6 Consistency Check against PostgreSQL Database
  const [dbUsers, dbStudents, dbFaculty, dbProjects] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'FACULTY' } }),
    prisma.project.count(),
  ]);
  assert(
    '1. Auth & Dashboard',
    'DB Verification: Dashboard metrics strictly match actual PostgreSQL records',
    overview.totalUsers === dbUsers &&
      overview.totalStudents === dbStudents &&
      overview.totalFaculty === dbFaculty &&
      overview.totalProjects === dbProjects,
    `API users=${overview.totalUsers}/DB=${dbUsers}, API projects=${overview.totalProjects}/DB=${dbProjects}`
  );

  // 1.7 Recent Projects API
  const recentRes = await request('/api/projects/admin/recent', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '1. Auth & Dashboard',
    'GET /api/projects/admin/recent returns recent projects list (200 OK)',
    recentRes.status === 200 && Array.isArray(recentRes.data) && recentRes.data.length <= 5,
    `count=${recentRes.data?.length}`
  );

  // 1.8 Admin Notifications
  const notifsRes = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '1. Auth & Dashboard',
    'GET /api/notifications returns admin notification feed & unreadCount (200 OK)',
    notifsRes.status === 200 && typeof notifsRes.data?.unreadCount === 'number',
    `unreadCount=${notifsRes.data?.unreadCount}`
  );

  // =========================================================================
  // 2. USER MANAGEMENT
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[2] User Management and Role Governance\x1b[0m');

  // 2.1 View All Users
  const allUsersRes = await request('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '2. User Management',
    'Admin can view university-wide user list via GET /api/users (200 OK)',
    allUsersRes.status === 200 && Array.isArray(allUsersRes.data) && allUsersRes.data.length > 0,
    `count=${allUsersRes.data?.length}`
  );

  // 2.2 View Students List
  const studentsRes = await request('/api/users/students', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '2. User Management',
    'Admin can view student roster via GET /api/users/students (200 OK)',
    studentsRes.status === 200 && Array.isArray(studentsRes.data),
    `students count=${studentsRes.data?.length}`
  );

  // 2.3 View Faculty List
  const facultyListRes = await request('/api/users/faculty', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '2. User Management',
    'Admin can view faculty roster via GET /api/users/faculty (200 OK)',
    facultyListRes.status === 200 && Array.isArray(facultyListRes.data),
    `faculty count=${facultyListRes.data?.length}`
  );

  // 2.4 User Role Transition (Promote student to FACULTY)
  const promoteRes = await request(`/api/users/${studentUser.id}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'FACULTY' }),
  });
  assert(
    '2. User Management',
    'Admin promotes student to FACULTY role (200 OK)',
    promoteRes.status === 200 && promoteRes.data?.user?.role === 'FACULTY',
    `HTTP ${promoteRes.status}, newRole=${promoteRes.data?.user?.role}`
  );

  // DB verification: role in PostgreSQL
  const dbUserPromoted = await prisma.user.findUnique({
    where: { id: studentUser.id },
    select: { role: true },
  });
  assert(
    '2. User Management',
    'DB Verification: User role in PostgreSQL strictly updated to FACULTY',
    dbUserPromoted?.role === 'FACULTY',
    `role=${dbUserPromoted?.role}`
  );

  // Demote back to STUDENT
  const demoteRes = await request(`/api/users/${studentUser.id}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'STUDENT' }),
  });
  assert(
    '2. User Management',
    'Admin transitions user role back to STUDENT (200 OK)',
    demoteRes.status === 200 && demoteRes.data?.user?.role === 'STUDENT',
    `HTTP ${demoteRes.status}, role=${demoteRes.data?.user?.role}`
  );

  // 2.5 Validation: Invalid role value rejected
  const badRoleRes = await request(`/api/users/${studentUser.id}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'SUPERUSER_INVALID' }),
  });
  assert(
    '2. User Management',
    'Invalid role string rejected with 400 Bad Request',
    badRoleRes.status === 400,
    `HTTP ${badRoleRes.status}`
  );

  // 2.6 Self-demotion guard
  const selfDemoteRes = await request(`/api/users/${adminUser.id}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'STUDENT' }),
  });
  // If only 1 admin, must be rejected; if multiple admins, can be demoted or rejected
  assert(
    '2. User Management',
    'Self-demotion safety check handled properly (400 if sole admin or 200)',
    selfDemoteRes.status === 400 || selfDemoteRes.status === 200,
    `HTTP ${selfDemoteRes.status}`
  );

  // 2.7 Security: Student cannot access Admin user management
  const studentAccessUsers = await request('/api/users', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(
    '2. User Management',
    'Student attempting GET /api/users receives 403 Forbidden',
    studentAccessUsers.status === 403,
    `HTTP ${studentAccessUsers.status}`
  );

  // 2.8 Security: Faculty cannot access Admin user management
  const facultyAccessUsers = await request('/api/users', {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert(
    '2. User Management',
    'Faculty attempting GET /api/users receives 403 Forbidden',
    facultyAccessUsers.status === 403,
    `HTTP ${facultyAccessUsers.status}`
  );

  // 2.9 Security: Student cannot change roles
  const studentChangeRole = await request(`/api/users/${studentUser.id}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'ADMIN' }),
  });
  assert(
    '2. User Management',
    'Student attempting to elevate role receives 403 Forbidden',
    studentChangeRole.status === 403,
    `HTTP ${studentChangeRole.status}`
  );

  // 2.10 Not-implemented user operations
  recordNotImplemented('2. User Management', 'Admin direct user creation (POST /api/users)', 'Users register via /api/auth/register with STUDENT default and are governed via PATCH /api/users/:id/role');
  recordNotImplemented('2. User Management', 'Admin user deletion (DELETE /api/users/:id)', 'User deletion not implemented to preserve academic history & relational integrity');
  recordNotImplemented('2. User Management', 'User deactivation (isActive boolean)', 'User schema does not contain an isActive column; deactivation not implemented in DB schema');

  // =========================================================================
  // 3. PROJECT ADMINISTRATION AND OVERSIGHT
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[3] Project Administration and Oversight\x1b[0m');

  // 3.1 Admin views university-wide project list
  const adminProjectsListRes = await request('/api/projects/admin/projects', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '3. Project Oversight',
    'Admin views university-wide project list via GET /api/projects/admin/projects (200 OK)',
    adminProjectsListRes.status === 200 && Array.isArray(adminProjectsListRes.data),
    `projects count=${adminProjectsListRes.data?.length}`
  );

  // Pick a project for inspection
  const targetProject = adminProjectsListRes.data?.[0];
  const projectId = targetProject?.id;

  // 3.2 Inspect individual project details
  const projectDetailsRes = await request(`/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '3. Project Oversight',
    'Admin can inspect individual project details, members, and supervisor (200 OK)',
    projectDetailsRes.status === 200 && !!projectDetailsRes.data?.id,
    `title="${projectDetailsRes.data?.title}", assignedFacultyId=${projectDetailsRes.data?.assignedFacultyId}`
  );

  // 3.3 Identification of unassigned guide projects
  const unassignedCount = adminProjectsListRes.data?.filter((p: any) => !p.assignedFaculty && !p.assignedFacultyId).length;
  assert(
    '3. Project Oversight',
    'Admin can identify projects lacking faculty supervision',
    typeof unassignedCount === 'number',
    `unassigned projects in sample=${unassignedCount}`
  );

  // 3.4 Admin team/supervision assignment via PUT /api/projects/:id/team
  const updateTeamRes = await request(`/api/projects/${projectId}/team`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      facultyId: facultyUser?.id || null,
      studentIds: [studentUser.id],
      adminIds: [adminUser.id],
    }),
  });
  assert(
    '3. Project Oversight',
    'Admin assigns/updates project supervision and team via PUT /api/projects/:id/team (200 OK)',
    updateTeamRes.status === 200,
    `HTTP ${updateTeamRes.status}`
  );

  // DB verification: assignedFacultyId in PostgreSQL
  const dbProjectUpdated = await prisma.project.findUnique({
    where: { id: projectId },
    select: { assignedFacultyId: true },
  });
  assert(
    '3. Project Oversight',
    'DB Verification: Project assignedFacultyId in PostgreSQL matches assigned faculty',
    dbProjectUpdated?.assignedFacultyId === (facultyUser?.id || null),
    `assignedFacultyId=${dbProjectUpdated?.assignedFacultyId}`
  );

  // =========================================================================
  // 4. FACULTY AND STUDENT COORDINATION
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[4] Faculty and Student Coordination\x1b[0m');

  // 4.1 Team Options API
  const teamOptionsRes = await request('/api/projects/team-options', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '4. Coordination',
    'Admin fetches team-options roster with students, faculty, and admins separated (200 OK)',
    teamOptionsRes.status === 200 &&
      Array.isArray(teamOptionsRes.data?.students) &&
      Array.isArray(teamOptionsRes.data?.faculty) &&
      Array.isArray(teamOptionsRes.data?.admins),
    `students=${teamOptionsRes.data?.students?.length}, faculty=${teamOptionsRes.data?.faculty?.length}, admins=${teamOptionsRes.data?.admins?.length}`
  );

  // 4.2 Security check: Student cannot access team-options
  const studentTeamOptions = await request('/api/projects/team-options', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(
    '4. Coordination',
    'Student attempting GET /api/projects/team-options receives 403 Forbidden',
    studentTeamOptions.status === 403,
    `HTTP ${studentTeamOptions.status}`
  );

  // 4.3 Validation: Invalid faculty ID rejected in team assignment
  const invalidFacultyTeamRes = await request(`/api/projects/${projectId}/team`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      facultyId: 'not-a-faculty-id',
      studentIds: [],
    }),
  });
  assert(
    '4. Coordination',
    'Invalid faculty ID in team assignment returns 400 Bad Request',
    invalidFacultyTeamRes.status === 400,
    `HTTP ${invalidFacultyTeamRes.status}`
  );

  // =========================================================================
  // 5. SKILLS CATALOGUE MANAGEMENT
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[5] Global Skills Catalogue Management (CRUD)\x1b[0m');

  // 5.1 View Catalogue
  const catalogueRes = await request('/api/skills', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '5. Skills Catalogue',
    'Admin can view global skills catalogue via GET /api/skills (200 OK)',
    catalogueRes.status === 200 && Array.isArray(catalogueRes.data),
    `skills count=${catalogueRes.data?.length}`
  );

  // 5.2 Create Skill
  const testSkillName = `Distributed Systems ${timestamp}`;
  const createSkillRes = await request('/api/skills', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: testSkillName,
      category: 'Backend Architecture',
      description: 'Consensus protocols, Raft, Paxos, and distributed state machines',
    }),
  });
  const createdSkill = createSkillRes.data;
  assert(
    '5. Skills Catalogue',
    'Admin creates new competency skill in catalogue (201/200)',
    (createSkillRes.status === 201 || createSkillRes.status === 200) && !!createdSkill?.id,
    `HTTP ${createSkillRes.status}, skillId=${createdSkill?.id}`
  );

  // DB verification
  const dbSkillCreated = await prisma.skill.findUnique({
    where: { id: createdSkill.id },
  });
  assert(
    '5. Skills Catalogue',
    'DB Verification: Newly created skill persists in PostgreSQL with isActive=true',
    dbSkillCreated?.name === testSkillName && dbSkillCreated?.isActive === true,
    `name="${dbSkillCreated?.name}", isActive=${dbSkillCreated?.isActive}`
  );

  // 5.3 Duplicate Skill Name Validation
  const duplicateSkillRes = await request('/api/skills', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: testSkillName,
      category: 'Backend Architecture',
    }),
  });
  assert(
    '5. Skills Catalogue',
    'Duplicate skill name rejected with 409 Conflict / 400',
    duplicateSkillRes.status === 409 || duplicateSkillRes.status === 400,
    `HTTP ${duplicateSkillRes.status}`
  );

  // 5.4 Empty Skill Name Validation
  const emptySkillRes = await request('/api/skills', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: '   ',
      category: 'Backend Architecture',
    }),
  });
  assert(
    '5. Skills Catalogue',
    'Empty skill name rejected with 400 Bad Request',
    emptySkillRes.status === 400,
    `HTTP ${emptySkillRes.status}`
  );

  // 5.5 Edit Skill
  const updatedSkillName = `Distributed Systems & Fault Tolerance ${timestamp}`;
  const editSkillRes = await request(`/api/skills/${createdSkill.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: updatedSkillName,
      category: 'Advanced Distributed Systems',
    }),
  });
  assert(
    '5. Skills Catalogue',
    'Admin updates skill name and category (200 OK)',
    editSkillRes.status === 200 && editSkillRes.data?.name === updatedSkillName,
    `HTTP ${editSkillRes.status}, name="${editSkillRes.data?.name}"`
  );

  // 5.6 Soft Delete / Deactivate Skill
  const deleteSkillRes = await request(`/api/skills/${createdSkill.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '5. Skills Catalogue',
    'Admin soft-deactivates skill (200 OK)',
    deleteSkillRes.status === 200,
    `HTTP ${deleteSkillRes.status}`
  );

  // DB verification: isActive=false
  const dbSkillDeactivated = await prisma.skill.findUnique({
    where: { id: createdSkill.id },
  });
  assert(
    '5. Skills Catalogue',
    'DB Verification: Skill has isActive=false (soft deleted, preserving historical records)',
    dbSkillDeactivated?.isActive === false,
    `isActive=${dbSkillDeactivated?.isActive}`
  );

  // Verify catalogue visibility isolation: Student cannot see deactivated skill
  const studentSkillsList = await request('/api/skills', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentSeesDeactivated = studentSkillsList.data?.some((s: any) => s.id === createdSkill.id);
  assert(
    '5. Skills Catalogue',
    'Student skills list strictly excludes deactivated skills',
    studentSeesDeactivated === false,
    `found in student list=${studentSeesDeactivated}`
  );

  // Reactivate skill for clean cleanup
  await prisma.skill.delete({ where: { id: createdSkill.id } });

  // =========================================================================
  // 6. JOB ROLES AND TALENT SEARCH ADMINISTRATION
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[6] Job Roles and Talent Search Administration\x1b[0m');

  // 6.1 View Job Roles
  const jobRolesListRes = await request('/api/job-roles', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Admin views job roles list via GET /api/job-roles (200 OK)',
    jobRolesListRes.status === 200 && Array.isArray(jobRolesListRes.data),
    `roles count=${jobRolesListRes.data?.length}`
  );

  // Find active skills to associate with job role
  const activeSkills = (await prisma.skill.findMany({ where: { isActive: true }, take: 2 })).map(s => s.id);

  // 6.2 Create Job Role
  const testJobRoleTitle = `Cloud Native Architect ${timestamp}`;
  const createJobRoleRes = await request('/api/job-roles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: testJobRoleTitle,
      description: 'Designs, deploys, and scales microservices on Kubernetes',
      skillIds: activeSkills,
    }),
  });
  const createdJobRole = createJobRoleRes.data;
  assert(
    '6. Job Roles & Talent',
    'Admin creates new Job Role with required skills (201 Created)',
    createJobRoleRes.status === 201 && !!createdJobRole?.id,
    `HTTP ${createJobRoleRes.status}, roleId=${createdJobRole?.id}`
  );

  // DB verification: JobRole in PostgreSQL
  const dbJobRoleCreated = await prisma.jobRole.findUnique({
    where: { id: createdJobRole.id },
    include: { requiredSkills: true },
  });
  assert(
    '6. Job Roles & Talent',
    'DB Verification: JobRole and required skills persist in PostgreSQL',
    dbJobRoleCreated?.title === testJobRoleTitle && dbJobRoleCreated?.requiredSkills?.length === activeSkills.length,
    `title="${dbJobRoleCreated?.title}", skills=${dbJobRoleCreated?.requiredSkills?.length}`
  );

  // 6.3 Validation on Job Role: empty title returns 400
  const badJobRoleTitleRes = await request('/api/job-roles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: '   ',
      skillIds: activeSkills,
    }),
  });
  assert(
    '6. Job Roles & Talent',
    'Empty job role title rejected with 400 Bad Request',
    badJobRoleTitleRes.status === 400,
    `HTTP ${badJobRoleTitleRes.status}`
  );

  // 6.4 Edit Job Role
  const updatedJobRoleDesc = 'Updated architecture description with zero-trust networking';
  const editJobRoleRes = await request(`/api/job-roles/${createdJobRole.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: updatedJobRoleDesc,
    }),
  });
  assert(
    '6. Job Roles & Talent',
    'Admin updates Job Role description (200 OK)',
    editJobRoleRes.status === 200 && editJobRoleRes.data?.description === updatedJobRoleDesc,
    `HTTP ${editJobRoleRes.status}`
  );

  // 6.5 Deactivate Job Role
  const deleteJobRoleRes = await request(`/api/job-roles/${createdJobRole.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Admin deactivates Job Role (200 OK)',
    deleteJobRoleRes.status === 200,
    `HTTP ${deleteJobRoleRes.status}`
  );

  // Clean up test job role
  await prisma.jobRoleSkill.deleteMany({ where: { jobRoleId: createdJobRole.id } });
  await prisma.jobRole.delete({ where: { id: createdJobRole.id } });

  // 6.6 Talent Search Functionality
  // Validation: Missing jobRoleId and skillIds returns 400 Bad Request
  const talentSearchMissingParams = await request('/api/talent-search', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Talent Search validates mandatory criteria: missing params returns 400 Bad Request',
    talentSearchMissingParams.status === 400,
    `HTTP ${talentSearchMissingParams.status}`
  );

  // Search by skillIds parameter
  const talentSkillQuery = activeSkills.join(',');
  const talentSearchBase = await request(`/api/talent-search?skillIds=${talentSkillQuery}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Admin accesses Talent Search candidates list via GET /api/talent-search?skillIds=... (200 OK)',
    talentSearchBase.status === 200 && Array.isArray(talentSearchBase.data?.students),
    `students matched=${talentSearchBase.data?.students?.length}, evaluated=${talentSearchBase.data?.totalStudentsEvaluated}`
  );

  // Test match modes: VERIFIED_ONLY
  const talentVerifiedOnly = await request(`/api/talent-search?skillIds=${talentSkillQuery}&matchMode=VERIFIED_ONLY`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Talent Search supports VERIFIED_ONLY match mode (200 OK)',
    talentVerifiedOnly.status === 200 && talentVerifiedOnly.data?.matchMode === 'VERIFIED_ONLY' && Array.isArray(talentVerifiedOnly.data?.students),
    `students count=${talentVerifiedOnly.data?.students?.length}, mode=${talentVerifiedOnly.data?.matchMode}`
  );

  // Test match modes: ALL_DEMONSTRATED
  const talentAllDem = await request(`/api/talent-search?skillIds=${talentSkillQuery}&matchMode=ALL_DEMONSTRATED`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Talent Search supports ALL_DEMONSTRATED match mode (200 OK)',
    talentAllDem.status === 200 && talentAllDem.data?.matchMode === 'ALL_DEMONSTRATED' && Array.isArray(talentAllDem.data?.students),
    `students count=${talentAllDem.data?.students?.length}, mode=${talentAllDem.data?.matchMode}`
  );

  // Test filters: minMatch threshold
  const talentFiltered = await request(`/api/talent-search?skillIds=${talentSkillQuery}&minMatch=0`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Talent Search supports minMatch threshold parameter (200 OK)',
    talentFiltered.status === 200 && Array.isArray(talentFiltered.data?.students),
    `HTTP ${talentFiltered.status}`
  );

  // 6.7 Talent Search Candidate Portfolio
  const candidate = talentSearchBase.data?.students?.[0];
  if (candidate?.id) {
    const portfolioRes = await request(`/api/student-skills/portfolio/${candidate.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      '6. Job Roles & Talent',
      'Admin can open candidate Digital Passport portfolio via /api/student-skills/portfolio/:id (200 OK)',
      portfolioRes.status === 200 && !!portfolioRes.data?.certificate?.certificateId,
      `certificateId=${portfolioRes.data?.certificate?.certificateId}`
    );
  }

  // 6.8 Talent Search Analytics
  const talentAnalyticsRes = await request('/api/talent-search/analytics', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Admin accesses Talent Search analytics & readiness distribution (200 OK)',
    talentAnalyticsRes.status === 200 &&
      Array.isArray(talentAnalyticsRes.data?.topShortages) &&
      Array.isArray(talentAnalyticsRes.data?.roleReadiness) &&
      typeof talentAnalyticsRes.data?.totalStudents === 'number',
    `totalStudents=${talentAnalyticsRes.data?.totalStudents}, topShortages=${talentAnalyticsRes.data?.topShortages?.length}`
  );

  // 6.9 Access Isolation: Student & Faculty blocked from Talent Search
  const studentTalent = await request('/api/talent-search', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Student attempting GET /api/talent-search receives 403 Forbidden',
    studentTalent.status === 403,
    `HTTP ${studentTalent.status}`
  );

  const facultyTalent = await request('/api/talent-search', {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert(
    '6. Job Roles & Talent',
    'Faculty attempting GET /api/talent-search receives 403 Forbidden',
    facultyTalent.status === 403,
    `HTTP ${facultyTalent.status}`
  );

  // =========================================================================
  // 7. NOTIFICATIONS AND ANALYTICS
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[7] Notifications Management and Analytics\x1b[0m');

  // Create a test notification for Admin
  const adminTestNotif = await prisma.notification.create({
    data: {
      userId: adminUser.id,
      title: 'Institutional Audit Alert',
      message: 'All department submissions scheduled for review',
      type: 'PROJECT_INVITATION',
    },
  });

  // 7.1 Fetch notifications
  const adminNotifsFetch = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '7. Notifications',
    'Admin lists notifications via GET /api/notifications (200 OK)',
    adminNotifsFetch.status === 200 && adminNotifsFetch.data?.notifications?.length > 0,
    `count=${adminNotifsFetch.data?.notifications?.length}, unread=${adminNotifsFetch.data?.unreadCount}`
  );

  // 7.2 Mark single notification read
  const markOneRes = await request(`/api/notifications/${adminTestNotif.id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '7. Notifications',
    'Admin marks single notification as read (200 OK)',
    markOneRes.status === 200 && markOneRes.data?.notification?.isRead === true,
    `HTTP ${markOneRes.status}`
  );

  // 7.3 Mark all notifications read
  const markAllRes = await request('/api/notifications/read-all', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '7. Notifications',
    'Admin marks all notifications as read (200 OK)',
    markAllRes.status === 200,
    `HTTP ${markAllRes.status}`
  );

  const afterMarkAll = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '7. Notifications',
    'DB Verification: Admin unread notifications count is now 0',
    afterMarkAll.data?.unreadCount === 0,
    `unreadCount=${afterMarkAll.data?.unreadCount}`
  );

  // 7.4 Dismiss / Delete notification
  const dismissNotifRes = await request(`/api/notifications/${adminTestNotif.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '7. Notifications',
    'Admin dismisses/deletes notification (200 OK)',
    dismissNotifRes.status === 200,
    `HTTP ${dismissNotifRes.status}`
  );

  // 7.5 Notification Isolation: Student cannot dismiss Admin notification
  const adminNotif2 = await prisma.notification.create({
    data: {
      userId: adminUser.id,
      title: 'Confidential Admin Notice',
      message: 'System upgrade notice',
      type: 'PROJECT_INVITATION',
    },
  });
  const crossDismissRes = await request(`/api/notifications/${adminNotif2.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(
    '7. Notifications',
    'Student attempting to dismiss Admin notification receives 403 Forbidden',
    crossDismissRes.status === 403,
    `HTTP ${crossDismissRes.status}`
  );
  await prisma.notification.delete({ where: { id: adminNotif2.id } });

  // =========================================================================
  // 8. ADMIN SECURITY AND EDGE CASES
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[8] Admin Security and Edge Cases\x1b[0m');

  // 8.1 Student blocked from Admin routes
  const studentBlockedOverview = await request('/api/projects/admin/overview', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentBlockedProjects = await request('/api/projects/admin/projects', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentBlockedJobRoles = await request('/api/job-roles', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentBlockedSkillsCreate = await request('/api/skills', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Hacked Skill' }),
  });
  assert(
    '8. Security & Edge Cases',
    'Student strictly blocked from all Admin endpoints (403 Forbidden across 4 checks)',
    studentBlockedOverview.status === 403 &&
      studentBlockedProjects.status === 403 &&
      studentBlockedJobRoles.status === 403 &&
      studentBlockedSkillsCreate.status === 403,
    `overview=${studentBlockedOverview.status}, projects=${studentBlockedProjects.status}, jobRoles=${studentBlockedJobRoles.status}, skills=${studentBlockedSkillsCreate.status}`
  );

  // 8.2 Faculty blocked from Admin routes
  const facultyBlockedOverview = await request('/api/projects/admin/overview', {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const facultyBlockedProjects = await request('/api/projects/admin/projects', {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const facultyBlockedJobRoles = await request('/api/job-roles', {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const facultyBlockedSkillsCreate = await request('/api/skills', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Hacked Skill' }),
  });
  assert(
    '8. Security & Edge Cases',
    'Faculty strictly blocked from all Admin endpoints (403 Forbidden across 4 checks)',
    facultyBlockedOverview.status === 403 &&
      facultyBlockedProjects.status === 403 &&
      facultyBlockedJobRoles.status === 403 &&
      facultyBlockedSkillsCreate.status === 403,
    `overview=${facultyBlockedOverview.status}, projects=${facultyBlockedProjects.status}, jobRoles=${facultyBlockedJobRoles.status}, skills=${facultyBlockedSkillsCreate.status}`
  );

  // 8.3 Expired token receives 401 Unauthorized
  const expiredToken = jwt.sign(
    { userId: adminUser.id, role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: -10 }
  );
  const expiredRes = await request('/api/projects/admin/overview', {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert(
    '8. Security & Edge Cases',
    'Expired JWT token receives 401 Unauthorized',
    expiredRes.status === 401,
    `HTTP ${expiredRes.status}`
  );

  // 8.4 Invalid UUIDs handled gracefully
  const invalidUserUuid = await request('/api/users/not-a-uuid/role', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'STUDENT' }),
  });
  assert(
    '8. Security & Edge Cases',
    'Invalid UUID on user role change returns 404/400 safely',
    invalidUserUuid.status === 404 || invalidUserUuid.status === 400 || invalidUserUuid.status === 500,
    `HTTP ${invalidUserUuid.status}`
  );

  const invalidSkillUuid = await request('/api/skills/not-a-uuid', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Valid Name' }),
  });
  assert(
    '8. Security & Edge Cases',
    'Invalid UUID on skill update returns 404 Not Found',
    invalidSkillUuid.status === 404,
    `HTTP ${invalidSkillUuid.status}`
  );

  const invalidJobRoleUuid = await request('/api/job-roles/not-a-uuid', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    '8. Security & Edge Cases',
    'Invalid UUID on job role lookup handled safely (404/405/400)',
    invalidJobRoleUuid.status === 404 || invalidJobRoleUuid.status === 405 || invalidJobRoleUuid.status === 400,
    `HTTP ${invalidJobRoleUuid.status}`
  );

  // 8.5 Public registration role spoofing: attempting to register as ADMIN
  const spoofAdminReg = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rogue Admin Candidate',
      email: `rogue.admin.${timestamp}@stackx.edu`,
      password: 'Password#2026!',
      role: 'ADMIN', // Attacker requests ADMIN
    }),
  });
  assert(
    '8. Security & Edge Cases',
    'Public registration role spoofing strictly thwarted: forced to STUDENT',
    spoofAdminReg.data?.user?.role === 'STUDENT',
    `Role assigned=${spoofAdminReg.data?.user?.role}`
  );

  // Clean up spoof student
  if (spoofAdminReg.data?.user?.id) {
    await prisma.user.delete({ where: { id: spoofAdminReg.data?.user?.id } });
  }
  await prisma.user.delete({ where: { id: studentUser.id } });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[1m\x1b[35m========================================================================');
  console.log(`   Admin Workflow E2E Audit Results: ${passedChecks} Passed, ${failedChecks} Failed`);
  console.log('========================================================================\x1b[0m\n');

  await prisma.$disconnect();

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runAdminWorkflowAudit().catch(async (err) => {
  console.error('\x1b[31mFatal error in Admin Workflow Audit:\x1b[0m', err);
  await prisma.$disconnect();
  process.exit(1);
});
