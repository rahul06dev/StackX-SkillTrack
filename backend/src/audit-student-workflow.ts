/**
 * StackX SkillTrack — Comprehensive Student Workflow E2E Audit
 * Executes real live HTTP requests against the running backend API and PostgreSQL database.
 * Verifies all 12 key features of the Student Workflow (Section A).
 */

const BASE_URL = 'http://localhost:4300';

let passedChecks = 0;
let failedChecks = 0;

function assert(feature: string, checkName: string, condition: boolean, details?: any) {
  if (condition) {
    console.log(`  \x1b[32m✔ [${feature}] PASS:\x1b[0m ${checkName}`);
    passedChecks++;
  } else {
    console.error(`  \x1b[31m✘ [${feature}] FAIL:\x1b[0m ${checkName} ${details ? `-> ${JSON.stringify(details)}` : ''}`);
    failedChecks++;
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

async function runStudentWorkflowAudit() {
  const timestamp = Date.now();
  console.log('\n\x1b[1m\x1b[35m========================================================================');
  console.log('   StackX SkillTrack — Comprehensive Student Workflow E2E Audit');
  console.log('   Target: ' + BASE_URL);
  console.log('========================================================================\x1b[0m\n');

  // =========================================================================
  // 1. REGISTRATION AND LOGIN
  // =========================================================================
  console.log('\x1b[1m\x1b[36m[1] Registration and Login\x1b[0m');

  // 1a. Validation: reject weak password
  const weakReg = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Student',
      email: `student.${timestamp}@stackx.edu`,
      password: 'weak',
    }),
  });
  assert('1. Reg/Login', 'Rejects password shorter than 8 characters', weakReg.status === 400);

  // 1b. Validation: reject invalid email format
  const badEmailReg = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Student',
      email: 'not-an-email',
      password: 'Strong#Password123!',
    }),
  });
  assert('1. Reg/Login', 'Rejects malformed email address', badEmailReg.status === 400);

  // 1c. Valid Registration for Primary Student
  const studentEmail = `student.audit.${timestamp}@stackx.edu`;
  const studentPassword = 'Secure#Student2026!';
  const regStudentRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alex Rivera',
      email: studentEmail,
      password: studentPassword,
    }),
  });
  assert('1. Reg/Login', 'Registers student account successfully (201 Created)', regStudentRes.status === 201);
  const studentId = regStudentRes.data?.user?.id;
  assert('1. Reg/Login', 'Registered user has role STUDENT strictly enforced', regStudentRes.data?.user?.role === 'STUDENT');

  // 1d. Login Primary Student
  const loginStudentRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: studentEmail,
      password: studentPassword,
    }),
  });
  assert('1. Reg/Login', 'Student login returns 200 OK and JWT token', loginStudentRes.status === 200 && !!loginStudentRes.data?.token);
  const studentToken = loginStudentRes.data?.token;

  // 1e. Register Peer Student (for collaboration & team invitations)
  const peerEmail = `peer.audit.${timestamp}@stackx.edu`;
  const peerPassword = 'Secure#Peer2026!';
  const regPeerRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Jordan Lee',
      email: peerEmail,
      password: peerPassword,
    }),
  });
  assert('1. Reg/Login', 'Registers peer teammate account successfully', regPeerRes.status === 201);
  const peerId = regPeerRes.data?.user?.id;

  const loginPeerRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: peerEmail, password: peerPassword }),
  });
  const peerToken = loginPeerRes.data?.token;

  // 1f. Register 3rd Student (for decline invitation test)
  const thirdEmail = `declined.audit.${timestamp}@stackx.edu`;
  const thirdPassword = 'Secure#Third2026!';
  const regThirdRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Morgan Smith',
      email: thirdEmail,
      password: thirdPassword,
    }),
  });
  assert('1. Reg/Login', 'Registers 3rd student account successfully', regThirdRes.status === 201);
  const thirdId = regThirdRes.data?.user?.id;

  const loginThirdRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: thirdEmail, password: thirdPassword }),
  });
  const thirdToken = loginThirdRes.data?.token;

  // 1g. Login Faculty Guide
  const loginFacultyRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'faculty@test.com',
      password: 'Password#2026!',
    }),
  });
  assert('1. Reg/Login', 'Faculty guide login returns 200 OK and FACULTY role', loginFacultyRes.status === 200 && loginFacultyRes.data?.user?.role === 'FACULTY');
  const facultyToken = loginFacultyRes.data?.token;
  const facultyId = loginFacultyRes.data?.user?.id;

  // =========================================================================
  // 2. DASHBOARD
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[2] Student Dashboard\x1b[0m');

  const initialProfileRes = await request('/api/student-skills/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('2. Dashboard', 'Fetches fresh student skills profile (200 OK)', initialProfileRes.status === 200);
  assert('2. Dashboard', 'New student has 0 verified skills initially', initialProfileRes.data?.totalVerifiedSkills === 0);
  assert('2. Dashboard', 'New student has 0 pending claims initially', initialProfileRes.data?.totalPendingClaims === 0);
  assert('2. Dashboard', 'New student has 0 rejected claims initially', initialProfileRes.data?.totalRejectedClaims === 0);

  const initialProjectsRes = await request('/api/projects', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('2. Dashboard', 'Fetches initial projects list (200 OK, empty array)', initialProjectsRes.status === 200 && Array.isArray(initialProjectsRes.data) && initialProjectsRes.data.length === 0);

  const initialNotifRes = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('2. Dashboard', 'Fetches initial notifications (200 OK, unreadCount 0)', initialNotifRes.status === 200 && initialNotifRes.data?.unreadCount === 0);

  // =========================================================================
  // 3. PROJECT CREATION
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[3] Project Creation\x1b[0m');

  const createProjRes = await request('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      title: 'Autonomous Drone Navigation System',
      description: 'Computer vision and obstacle avoidance algorithms for autonomous UAVs',
      technologies: 'React, TypeScript, PostgreSQL',
      studentIds: [peerId],
      assignedFacultyId: facultyId,
    }),
  });
  assert('3. Project Creation', 'Creates student project successfully (201/200)', createProjRes.status === 201 || createProjRes.status === 200);
  const projectId = createProjRes.data?.id;
  assert('3. Project Creation', 'Student is registered as project owner / creator (createdById)', createProjRes.data?.createdById === studentId);
  assert('3. Project Creation', 'Faculty supervisor is NOT assigned until invitation acceptance', createProjRes.data?.assignedFacultyId === null || createProjRes.data?.assignedFacultyId === undefined);

  // =========================================================================
  // 4. TEAM MANAGEMENT (Invite, Accept, Decline, Cancel)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[4] Team Management\x1b[0m');

  // 4a. Verify pending invitations created during project creation
  const projInvsRes = await request(`/api/invitations/project/${projectId}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('4. Team Management', 'Project has pending invitations created', projInvsRes.status === 200 && Array.isArray(projInvsRes.data) && projInvsRes.data.length >= 2);
  
  const peerInvitation = projInvsRes.data?.find((i: any) => i.recipient?.id === peerId && i.type === 'TEAM_MEMBER');
  assert('4. Team Management', 'Pending team member invitation exists for Peer Student', !!peerInvitation && peerInvitation.status === 'PENDING');

  const facultyInvitation = projInvsRes.data?.find((i: any) => i.recipient?.id === facultyId && i.type === 'FACULTY_GUIDE');
  assert('4. Team Management', 'Pending faculty supervision invitation exists for Faculty Guide', !!facultyInvitation && facultyInvitation.status === 'PENDING');

  // 4b. Student invites 3rd student directly via team invitation endpoint
  const invite3rdRes = await request(`/api/invitations/project/${projectId}/team`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      recipientId: thirdId,
      message: 'Join our drone navigation project team',
    }),
  });
  assert('4. Team Management', 'Student invites 3rd teammate via /api/invitations/project/:id/team', invite3rdRes.status === 201 || invite3rdRes.status === 200);
  const thirdInvitationId = invite3rdRes.data?.invitation?.id;

  // 4c. 3rd Student declines the invitation
  const declineRes = await request(`/api/invitations/${thirdInvitationId}/decline`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${thirdToken}` },
  });
  assert('4. Team Management', '3rd student successfully declines invitation (200 OK)', declineRes.status === 200);

  // 4d. Student cancels an invitation test: invite student again and cancel
  const tempInviteRes = await request(`/api/invitations/project/${projectId}/team`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      recipientId: thirdId,
      message: 'Temporary invite to test cancellation',
    }),
  });
  const tempInviteId = tempInviteRes.data?.invitation?.id;
  const cancelRes = await request(`/api/invitations/${tempInviteId}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('4. Team Management', 'Project owner successfully cancels pending invitation', cancelRes.status === 200);

  // 4e. Peer Student accepts invitation
  const peerAcceptRes = await request(`/api/invitations/${peerInvitation.id}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${peerToken}` },
  });
  assert('4. Team Management', 'Peer student accepts team invitation (200 OK)', peerAcceptRes.status === 200);

  // Verify peer is now enrolled in project members
  const checkMembersRes = await request(`/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const memberIds = checkMembersRes.data?.students?.map((s: any) => s.studentId || s.id);
  assert('4. Team Management', 'Peer student is now enrolled as an active project member', memberIds.includes(peerId));

  // 4f. Faculty Guide accepts supervision invitation
  const facultyAcceptRes = await request(`/api/invitations/${facultyInvitation.id}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert('4. Team Management', 'Faculty supervisor accepts supervision invitation (200 OK)', facultyAcceptRes.status === 200);

  const checkFacultyRes = await request(`/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('4. Team Management', 'Project assignedFacultyId is now updated to the accepting faculty member', checkFacultyRes.data?.assignedFacultyId === facultyId);

  // =========================================================================
  // 5. PROJECT WORKSPACE (Kanban Columns & Task Creation)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[5] Project Workspace\x1b[0m');

  const getColsRes = await request(`/api/columns?projectId=${projectId}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const columns = Array.isArray(getColsRes.data) ? getColsRes.data : [];
  assert('5. Workspace', 'Project workspace contains 4 default Kanban columns', columns.length >= 4);

  const todoCol = columns.find((c: any) => c.title.toLowerCase().includes('to do') || c.order === 0) || columns[0];
  const inProgressCol = columns.find((c: any) => c.title.toLowerCase().includes('in progress') || c.order === 1) || columns[1];
  const inReviewCol = columns.find((c: any) => c.title.toLowerCase().includes('review') || c.order === 2) || columns[2];
  const completedCol = columns.find((c: any) => c.title.toLowerCase().includes('completed') || c.title.toLowerCase().includes('done') || c.order === 3) || columns[3];

  assert('5. Workspace', 'Identified To Do, In Progress, In Review, and Completed columns', !!todoCol && !!inProgressCol && !!inReviewCol && !!completedCol);

  // Create Task in To Do
  const createTaskRes = await request('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      columnId: todoCol.id,
      title: 'Implement Kalman Filter for Sensor Fusion',
      description: 'Integrate IMU and GPS telemetry stream for accurate position estimation',
      priority: 'high',
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    }),
  });
  assert('5. Workspace', 'Student creates task in To Do column (201/200)', createTaskRes.status === 201 || createTaskRes.status === 200);
  const taskId = createTaskRes.data?.id;

  // =========================================================================
  // 6. TASK MANAGEMENT (Edit, Assign, Move, Comment, Attach)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[6] Task Management\x1b[0m');

  // 6a. Edit task details and assign to Peer Student
  const editTaskRes = await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      title: 'Implement Extended Kalman Filter (EKF)',
      description: 'Updated with nonlinear state transition models and noise covariance tuning',
      assignee: 'Jordan Lee',
    }),
  });
  assert('6. Task Management', 'Edits task title, description, and assignee (200 OK)', editTaskRes.status === 200 && editTaskRes.data?.title.includes('Extended Kalman Filter'));

  // 6b. Move task to In Progress
  const moveInProgressRes = await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      columnId: inProgressCol.id,
    }),
  });
  assert('6. Task Management', 'Moves task from To Do to In Progress', moveInProgressRes.status === 200 && moveInProgressRes.data?.columnId === inProgressCol.id);

  // 6c. Add Comment to Task
  const addCommentRes = await request('/api/comments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      taskId,
      content: 'Telemetry dataset collected and verified against ROS bag simulation.',
    }),
  });
  assert('6. Task Management', 'Student posts comment on task (201/200)', addCommentRes.status === 201 || addCommentRes.status === 200);

  // 6d. File Attachment Upload (multipart form-data using native FormData)
  const formData = new FormData();
  const fileBlob = new Blob(['%PDF-1.4 E2E Test Sensor Fusion Telemetry Report Data'], { type: 'application/pdf' });
  formData.append('file', fileBlob, 'sensor-telemetry-report.pdf');

  const uploadRes = await fetch(`${BASE_URL}/api/attachments/task/${taskId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  assert('6. Task Management', 'Student uploads PDF file attachment to task', uploadRes.status === 201 || uploadRes.status === 200);
  const attachmentId = uploadData?.id;

  // 6e. File Attachment Download
  const downloadRes = await request(`/api/attachments/${attachmentId}/download`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('6. Task Management', 'Student downloads attachment with 200 OK and valid content', downloadRes.status === 200 && typeof downloadRes.data === 'string' && downloadRes.data.includes('%PDF-1.4'));

  // =========================================================================
  // 7. TASK REVIEW (Submit work, RBAC guard, Faculty Approval)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[7] Task Review\x1b[0m');

  // 7a. Student moves task to In Review
  const moveInReviewRes = await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      columnId: inReviewCol.id,
    }),
  });
  assert('7. Task Review', 'Student submits task for review by moving to In Review column', moveInReviewRes.status === 200 && moveInReviewRes.data?.columnId === inReviewCol.id);

  // 7b. RBAC Guard Enforcement: Student CANNOT move directly to Completed
  const studentAttemptCompleteRes = await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      columnId: completedCol.id,
    }),
  });
  assert('7. Task Review', 'RBAC Guard: Student cannot move task directly to Completed (403 Forbidden)', studentAttemptCompleteRes.status === 403);

  // 7c. Faculty approves task to Completed
  const facultyApproveRes = await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      columnId: completedCol.id,
    }),
  });
  assert('7. Task Review', 'Faculty supervisor approves task to Completed column (200 OK)', facultyApproveRes.status === 200 && facultyApproveRes.data?.columnId === completedCol.id);

  // =========================================================================
  // 8. SKILL SUBMISSION (Submit competency with project evidence)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[8] Skill Submission\x1b[0m');

  // Look up React skill id
  const skillsRes = await request('/api/skills', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('8. Skill Submission', 'Fetches active skills catalogue (200 OK)', skillsRes.status === 200 && Array.isArray(skillsRes.data));
  const reactSkill = skillsRes.data?.find((s: any) => s.name.toLowerCase().includes('react')) || skillsRes.data?.[0];
  assert('8. Skill Submission', 'Active competency skill identified in catalogue', !!reactSkill);

  // Student submits initial skill claim
  const submitSkillRes = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      skillId: reactSkill.id,
      projectId,
      level: 'INTERMEDIATE',
    }),
  });
  const claim = submitSkillRes.data?.studentSkill || submitSkillRes.data;
  const claimId = claim?.id;
  assert('8. Skill Submission', 'Student submits skill claim backed by project evidence (201/200)', submitSkillRes.status === 201 || submitSkillRes.status === 200);
  assert('8. Skill Submission', 'Initial claim status is PENDING', claim?.verification === 'PENDING');

  // Verify claim appears in Student pending list
  const studentSkillsCheck = await request('/api/student-skills/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const pendingClaims = studentSkillsCheck.data?.pendingSkills || [];
  assert('8. Skill Submission', 'Claim appears in student dashboard pendingSkills queue', pendingClaims.some((c: any) => c.id === claimId || c.name === reactSkill.name));

  // =========================================================================
  // 9. RESUBMISSION FLOW (Rejection, Feedback & Resubmission)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[9] Resubmission Flow\x1b[0m');

  // 9a. Faculty rejects claim with constructive feedback
  const rejectClaimRes = await request(`/api/student-skills/${claimId}/reject`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      rejectionReason: 'Needs comprehensive automated unit test evidence for React components',
      feedback: 'Please attach Jest or Vitest test execution output to the project repository.',
    }),
  });
  assert('9. Resubmission', 'Faculty rejects claim with constructive feedback (200 OK)', rejectClaimRes.status === 200 && rejectClaimRes.data?.studentSkill?.verification === 'REJECTED');

  // Verify claim moves to rejected list in student dashboard
  const studentCheckRejected = await request('/api/student-skills/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const rejectedClaims = studentCheckRejected.data?.rejectedSkills || [];
  assert('9. Resubmission', 'Claim moves to rejectedSkills on student dashboard', rejectedClaims.some((c: any) => c.id === claimId || c.name === reactSkill.name));

  // 9b. Student resubmits claim with upgraded level and fresh evidence
  const resubmitClaimRes = await request('/api/student-skills/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      skillId: reactSkill.id,
      projectId,
      level: 'ADVANCED',
    }),
  });
  const resubmitted = resubmitClaimRes.data?.studentSkill || resubmitClaimRes.data;
  assert('9. Resubmission', 'Student resubmits claim with ADVANCED level (201/200)', resubmitClaimRes.status === 201 || resubmitClaimRes.status === 200);
  assert('9. Resubmission', 'Resubmission resets status back to PENDING and clears rejection state', resubmitted?.verification === 'PENDING');

  // 9c. Faculty reviews resubmitted claim and approves
  const approveClaimRes = await request(`/api/student-skills/${claimId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      level: 'ADVANCED',
      feedback: 'Excellent work. Comprehensive component test coverage verified.',
    }),
  });
  assert('9. Resubmission', 'Faculty approves resubmitted claim (status VERIFIED)', approveClaimRes.status === 200 && approveClaimRes.data?.studentSkill?.verification === 'VERIFIED');

  // =========================================================================
  // 10. SKILL PASSPORT (Paper Eq. 3-4 Verification Rule)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[10] Skill Passport\x1b[0m');

  const finalProfileRes = await request('/api/student-skills/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const verifiedList = finalProfileRes.data?.verifiedSkills || [];
  assert('10. Skill Passport', 'Approved competency strictly appears in verifiedSkills list', verifiedList.some((s: any) => s.name === reactSkill.name));
  assert('10. Skill Passport', 'totalVerifiedSkills count is accurately incremented to 1', finalProfileRes.data?.totalVerifiedSkills === 1);
  assert('10. Skill Passport', 'Verified skill is no longer in pending claims queue', !finalProfileRes.data?.pendingSkills?.some((s: any) => s.name === reactSkill.name));
  assert('10. Skill Passport', 'Rejected claims count resets to 0', finalProfileRes.data?.totalRejectedClaims === 0);

  // =========================================================================
  // 11. PORTFOLIO (Public Sharing, Profile Information & Privacy)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[11] Portfolio\x1b[0m');

  const customSlug = `alex-rivera-${timestamp}`;

  // 11a. Student updates portfolio profile
  const updateProfileRes = await request('/api/users/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      headline: 'Robotics & Autonomous Systems Engineer',
      bio: 'Pioneering UAV navigation systems and state estimation algorithms.',
      department: 'Electrical Engineering & Computer Science',
      studentIdNo: 'STX-2026-9081',
      graduationYear: '2027',
      githubUrl: 'https://github.com/alex-rivera-robotics',
      linkedinUrl: 'https://linkedin.com/in/alex-rivera-robotics',
      shareableSlug: customSlug,
    }),
  });
  assert('11. Portfolio', 'Student successfully updates profile details & custom shareable slug', updateProfileRes.status === 200);

  // 11b. Student accesses own authenticated portfolio
  const studentPortfolioRes = await request('/api/student-skills/portfolio', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('11. Portfolio', 'Student fetches personal Digital Passport portfolio (200 OK)', studentPortfolioRes.status === 200);
  assert('11. Portfolio', 'Portfolio contains student identity details', studentPortfolioRes.data?.student?.headline === 'Robotics & Autonomous Systems Engineer');
  assert('11. Portfolio', 'Portfolio contains verified competencies with faculty credentials', studentPortfolioRes.data?.verifiedSkills?.length >= 1 && !!studentPortfolioRes.data?.verifiedSkills[0].verifiedBy);

  // 11c. Public unauthenticated access to portfolio via shareableSlug
  const publicPortfolioRes = await request(`/api/student-skills/public/${customSlug}`);
  assert('11. Portfolio', 'Public portfolio accessible without authentication (200 OK)', publicPortfolioRes.status === 200);
  assert('11. Portfolio', 'Public portfolio strictly excludes sensitive password hashes', publicPortfolioRes.data?.student?.password === undefined && publicPortfolioRes.data?.student?.passwordHash === undefined);
  assert('11. Portfolio', 'Public portfolio includes project portfolio and faculty supervisor details', publicPortfolioRes.data?.projects?.length >= 1 && !!publicPortfolioRes.data?.projects[0].supervisor);

  // =========================================================================
  // 12. NOTIFICATIONS (Lifecycle, Dispatch, Read, Dismiss)
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m[12] Notifications\x1b[0m');

  const notifsRes = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('12. Notifications', 'Fetches student notifications list (200 OK)', notifsRes.status === 200);
  const notifs = notifsRes.data?.notifications || [];
  assert('12. Notifications', 'Student received automated notifications across events', notifs.length >= 1);

  // 12a. Mark single notification as read
  if (notifs.length > 0) {
    const markOneRes = await request(`/api/notifications/${notifs[0].id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert('12. Notifications', 'Marks single notification as read (200 OK)', markOneRes.status === 200 && markOneRes.data?.notification?.isRead === true);
  }

  // 12b. Mark all notifications as read
  const markAllRes = await request('/api/notifications/read-all', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('12. Notifications', 'Marks all notifications as read (200 OK)', markAllRes.status === 200);

  const notifsAfterMarkAll = await request('/api/notifications', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('12. Notifications', 'Unread count is now 0 after mark-all-read', notifsAfterMarkAll.data?.unreadCount === 0);

  // 12c. Dismiss/delete a notification
  if (notifs.length > 0) {
    const deleteNotifRes = await request(`/api/notifications/${notifs[0].id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert('12. Notifications', 'Dismisses/deletes notification from user feed (200 OK)', deleteNotifRes.status === 200);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[1m\x1b[35m========================================================================');
  console.log(`   Student Workflow E2E Audit Results: ${passedChecks} Passed, ${failedChecks} Failed`);
  console.log('========================================================================\x1b[0m\n');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runStudentWorkflowAudit().catch((err) => {
  console.error('\x1b[31mFatal error during Student Workflow audit:\x1b[0m', err);
  process.exit(1);
});
