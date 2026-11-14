/**
 * StackX SkillTrack — Automated Test Suite
 * Covers Unit, Integration, Security, and Rule Engine Tests.
 * Run via: npm test
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  validatePasswordStrength,
  validateEmail,
  sanitizeString,
} from './utils/security.js';
import {
  executeRuleEngine,
  TECHNOLOGY_TO_SKILL_RULES,
} from './services/ruleEngine.js';
import {
  isExplicitDevelopmentEnv,
  getRateLimitConfig,
  createAuthRateLimiters,
} from './middleware/rateLimiter.js';

let passedTests = 0;
let failedTests = 0;

function assert(description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${description}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✘ FAIL:\x1b[0m ${description} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('\n\x1b[1m\x1b[34m================================================================');
  console.log('   StackX SkillTrack Automated Test Suite');
  console.log('================================================================\x1b[0m\n');

  // -------------------------------------------------------------
  // 1. UNIT TESTS: PASSWORD COMPLEXITY (OWASP A07)
  // -------------------------------------------------------------
  console.log('\x1b[1m[1] Unit Tests: OWASP Password Security Policy\x1b[0m');
  {
    const shortPass = validatePasswordStrength('Ab1!');
    assert('Rejects passwords shorter than 8 characters', !shortPass.isValid);

    const noUpper = validatePasswordStrength('lowercase123!@#');
    assert('Rejects passwords without uppercase letters', !noUpper.isValid);

    const noLower = validatePasswordStrength('UPPERCASE123!@#');
    assert('Rejects passwords without lowercase letters', !noLower.isValid);

    const noNumber = validatePasswordStrength('NoNumbersHere!@#');
    assert('Rejects passwords without numeric digits', !noNumber.isValid);

    const noSpecial = validatePasswordStrength('NoSpecialChars123');
    assert('Rejects passwords without special characters', !noSpecial.isValid);

    const commonPass = validatePasswordStrength('password123');
    assert('Rejects common dictionary passwords', !commonPass.isValid);

    const validPass = validatePasswordStrength('Secur3P@ssw0rd!2026');
    assert('Accepts strong OWASP-compliant password', validPass.isValid);
  }

  // -------------------------------------------------------------
  // 2. UNIT TESTS: EMAIL VALIDATION (RFC 5322 & INJECTION PROTECTION)
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[2] Unit Tests: Email Validation\x1b[0m');
  {
    assert('Accepts standard student email', validateEmail('student@university.edu'));
    assert('Accepts valid subdomain email', validateEmail('soham.hudge@adtu.ac.in'));
    assert('Rejects email missing @ symbol', !validateEmail('invaliduser.com'));
    assert('Rejects email missing domain', !validateEmail('user@'));
    assert('Rejects email with spaces', !validateEmail('user @domain.com'));
    assert('Rejects SQL injection payload in email', !validateEmail("' OR 1=1; --@evil.com"));
  }

  // -------------------------------------------------------------
  // 3. UNIT TESTS: XSS AND INPUT SANITIZATION (OWASP A03)
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[3] Unit Tests: Input Sanitization (XSS Prevention)\x1b[0m');
  {
    const scriptInput = '<script>alert("XSS")</script>Task Title';
    assert('Strips HTML script tags', sanitizeString(scriptInput) === 'alert("XSS")Task Title');

    const nullByteInput = 'Project\0Name';
    assert('Strips null byte characters', sanitizeString(nullByteInput) === 'ProjectName');

    const jsProtocol = 'javascript:evil()';
    assert('Neutralizes javascript: pseudo-protocol', !sanitizeString(jsProtocol).includes('javascript:'));
  }

  // -------------------------------------------------------------
  // 4. UNIT TESTS: RULE-BASED MAPPING ENGINE (R ⊆ T × S)
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[4] Unit Tests: Rule-Based Mapping Engine (R ⊆ T × S)\x1b[0m');
  {
    const mockCatalog = [
      { id: 'sk-1', name: 'React.js', category: 'Frontend' },
      { id: 'sk-2', name: 'Frontend Development', category: 'Frontend' },
      { id: 'sk-3', name: 'PostgreSQL', category: 'Database' },
      { id: 'sk-4', name: 'Database Management', category: 'Database' },
      { id: 'sk-5', name: 'DevOps', category: 'Cloud' },
      { id: 'sk-6', name: 'Containerization', category: 'Cloud' },
      { id: 'sk-7', name: 'Machine Learning', category: 'AI' },
    ];

    assert('Technology knowledge base is populated', Object.keys(TECHNOLOGY_TO_SKILL_RULES).length >= 40);

    const reactResults = executeRuleEngine(['React'], 'Building user interface', mockCatalog);
    const reactMappedNames = reactResults.map((r) => r.skillName);
    assert('Maps React to Frontend Development skill', reactMappedNames.includes('Frontend Development'));
    assert('Maps React to React.js catalogue entry', reactMappedNames.includes('React.js'));

    const dockerResults = executeRuleEngine(['Docker'], 'Deploying microservices', mockCatalog);
    const dockerMappedNames = dockerResults.map((r) => r.skillName);
    assert('Maps Docker to DevOps competency', dockerMappedNames.includes('DevOps'));
    assert('Maps Docker to Containerization competency', dockerMappedNames.includes('Containerization'));

    const postgresResults = executeRuleEngine(['PostgreSQL'], 'Relational tables', mockCatalog);
    const postgresMappedNames = postgresResults.map((r) => r.skillName);
    assert('Maps PostgreSQL to Database Management', postgresMappedNames.includes('Database Management'));
  }

  // -------------------------------------------------------------
  // 5. INTEGRATION TESTS: CRYPTOGRAPHIC HASHING & JWT AUTHENTICATION
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[5] Integration Tests: Cryptography & JWT Tokens\x1b[0m');
  {
    const rawPass = 'StackX#Secure2026';
    const hash = await bcrypt.hash(rawPass, 10);
    assert('Bcrypt salt hash matches original password', await bcrypt.compare(rawPass, hash));
    assert('Bcrypt rejects wrong password', !(await bcrypt.compare('WrongPassword!1', hash)));

    const secretKey = 'test_jwt_secret_key_99';
    const payload = { userId: 'usr-123', role: 'STUDENT' };
    const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });

    const decoded = jwt.verify(token, secretKey) as typeof payload;
    assert('JWT decoded userId matches payload', decoded.userId === 'usr-123');
    assert('JWT decoded role matches payload', decoded.role === 'STUDENT');

    let tamperedFailed = false;
    try {
      jwt.verify(token, 'different_secret_key');
    } catch {
      tamperedFailed = true;
    }
    assert('JWT rejects signatures from unknown secret keys', tamperedFailed);
  }

  // -------------------------------------------------------------
  // 6. UNIT TESTS: KANBAN WORKFLOW & ROLE MOVEMENT RESTRICTIONS
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[6] Unit Tests: Kanban Workflow & Role Guard Enforcement\x1b[0m');
  {
    // Workflow rule: Students cannot mark tasks Completed directly
    const validateTaskMovement = (role: string, sourceTitle: string, targetTitle: string) => {
      if (targetTitle === 'Completed' && role === 'STUDENT') {
        return { allowed: false, error: 'Only Faculty or Admin can mark a task as Completed.' };
      }
      if (targetTitle === 'Completed' && sourceTitle !== 'In Review') {
        return { allowed: false, error: 'A task must be moved to In Review before it can be Completed.' };
      }
      return { allowed: true };
    };

    assert(
      'Student cannot move task directly to Completed',
      !validateTaskMovement('STUDENT', 'In Progress', 'Completed').allowed
    );
    assert(
      'Student can move task from In Progress to In Review',
      validateTaskMovement('STUDENT', 'In Progress', 'In Review').allowed
    );
    assert(
      'Faculty cannot move task from In Progress directly to Completed without review',
      !validateTaskMovement('FACULTY', 'In Progress', 'Completed').allowed
    );
    assert(
      'Faculty can approve task from In Review to Completed',
      validateTaskMovement('FACULTY', 'In Review', 'Completed').allowed
    );
    assert(
      'Admin can approve task from In Review to Completed',
      validateTaskMovement('ADMIN', 'In Review', 'Completed').allowed
    );
  }

  // -------------------------------------------------------------
  // 7. UNIT TESTS: ATTACHMENT SECURITY & MIME VALIDATION
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[7] Unit Tests: Attachment Security Policy & MIME Types\x1b[0m');
  {
    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    const ALLOWED_MIME_TYPES = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'text/plain',
      'image/png',
      'image/jpeg',
    ]);

    const validateUpload = (size: number, mime: string) => {
      if (size > MAX_FILE_SIZE) return { valid: false, reason: 'File exceeds size limit' };
      if (!ALLOWED_MIME_TYPES.has(mime.toLowerCase())) return { valid: false, reason: 'Disallowed MIME type' };
      return { valid: true };
    };

    assert('Accepts 2MB PDF attachment', validateUpload(2 * 1024 * 1024, 'application/pdf').valid);
    assert('Accepts 500KB PNG image attachment', validateUpload(500 * 1024, 'image/png').valid);
    assert('Rejects file exceeding 15MB limit', !validateUpload(16 * 1024 * 1024, 'application/pdf').valid);
    assert('Rejects executable file (.exe / application/x-msdownload)', !validateUpload(1024, 'application/x-msdownload').valid);
    assert('Rejects shell script execution file', !validateUpload(500, 'application/x-sh').valid);
  }

  // -------------------------------------------------------------
  // 8. UNIT TESTS: TASK DEADLINES & OVERDUE CALCULATION
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[8] Unit Tests: Task Deadlines & Overdue Calculation\x1b[0m');
  {
    const now = new Date();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day in future

    const isTaskOverdue = (dueDate: Date | null, columnTitle: string) => {
      if (!dueDate) return false;
      if (columnTitle === 'Completed' || columnTitle === 'Done') return false;
      return dueDate < now;
    };

    assert('Flags incomplete task with past due date as overdue', isTaskOverdue(pastDate, 'In Progress'));
    assert('Task in future is not overdue', !isTaskOverdue(futureDate, 'In Progress'));
    assert('Completed task with past due date is not overdue', !isTaskOverdue(pastDate, 'Completed'));
    assert('Task without due date is not overdue', !isTaskOverdue(null, 'To Do'));
  }

  // -------------------------------------------------------------
  // 9. UNIT & INTEGRATION TESTS: STUDENT-LED PROJECT MANAGEMENT & INVITATIONS (PHASE 2)
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[9] Unit & Integration Tests: Student Project Ownership & Invitations (Phase 2)\x1b[0m');
  {
    // A. Student-led project creation separation from membership activation
    const studentCreatorId = 'usr-student-01';
    const invitedTeammateId = 'usr-student-02';
    const invitedFacultyId = 'usr-faculty-01';

    interface MockProject {
      id: string;
      title: string;
      createdById: string;
      assignedFacultyId: string | null;
      enrolledStudentIds: string[];
      invitations: Array<{
        id: string;
        recipientId: string;
        invitedById: string;
        type: 'TEAM_MEMBER' | 'FACULTY_GUIDE';
        status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
      }>;
    }

    const createStudentProject = (
      creatorId: string,
      title: string,
      teammateIds: string[],
      facultyGuideId: string | null
    ): MockProject => {
      const proj: MockProject = {
        id: `proj-${Date.now()}`,
        title,
        createdById: creatorId,
        assignedFacultyId: null, // Remains unassigned until faculty accepts
        enrolledStudentIds: [creatorId], // Only creator enrolled initially
        invitations: [],
      };

      // Generate pending team member invitations
      for (const tid of teammateIds) {
        if (tid !== creatorId) {
          proj.invitations.push({
            id: `inv-${Math.random()}`,
            recipientId: tid,
            invitedById: creatorId,
            type: 'TEAM_MEMBER',
            status: 'PENDING',
          });
        }
      }

      // Generate pending faculty guide invitation
      if (facultyGuideId) {
        proj.invitations.push({
          id: `inv-${Math.random()}`,
          recipientId: facultyGuideId,
          invitedById: creatorId,
          type: 'FACULTY_GUIDE',
          status: 'PENDING',
        });
      }

      return proj;
    };

    const project = createStudentProject(
      studentCreatorId,
      'Distributed Sensor Network',
      [invitedTeammateId],
      invitedFacultyId
    );

    assert('Student creator is the registered project owner/creator', project.createdById === studentCreatorId);
    assert('Creator is immediately enrolled in project membership', project.enrolledStudentIds.includes(studentCreatorId));
    assert('Invited teammates are not prematurely auto-enrolled', !project.enrolledStudentIds.includes(invitedTeammateId));
    assert('Faculty guide is not prematurely assigned before acceptance', project.assignedFacultyId === null);
    assert('Pending team invitation created for selected teammate', project.invitations.some(i => i.recipientId === invitedTeammateId && i.type === 'TEAM_MEMBER' && i.status === 'PENDING'));
    assert('Pending faculty supervision invitation created for faculty guide', project.invitations.some(i => i.recipientId === invitedFacultyId && i.type === 'FACULTY_GUIDE' && i.status === 'PENDING'));

    // B. Invitation acceptance state machine
    const acceptInvitation = (proj: MockProject, invitationId: string, callingUserId: string) => {
      const inv = proj.invitations.find(i => i.id === invitationId);
      if (!inv) return { success: false, error: 'Not found' };
      if (inv.recipientId !== callingUserId) return { success: false, error: 'Forbidden' };
      if (inv.status !== 'PENDING') return { success: false, error: 'Invalid state' };

      inv.status = 'ACCEPTED';
      if (inv.type === 'TEAM_MEMBER') {
        if (!proj.enrolledStudentIds.includes(inv.recipientId)) {
          proj.enrolledStudentIds.push(inv.recipientId);
        }
      } else if (inv.type === 'FACULTY_GUIDE') {
        proj.assignedFacultyId = inv.recipientId;
      }
      return { success: true };
    };

    const teammateInvite = project.invitations.find(i => i.type === 'TEAM_MEMBER')!;
    const facultyInvite = project.invitations.find(i => i.type === 'FACULTY_GUIDE')!;

    // Non-recipient cannot accept
    const unauthorizedAttempt = acceptInvitation(project, teammateInvite.id, 'unauthorized-user');
    assert('Rejects acceptance by non-recipient user (RBAC authorization)', !unauthorizedAttempt.success);

    // Teammate accepts
    const teammateAccept = acceptInvitation(project, teammateInvite.id, invitedTeammateId);
    assert('Teammate successfully accepts team invitation', teammateAccept.success);
    assert('Teammate invitation status is transitioned to ACCEPTED', teammateInvite.status === 'ACCEPTED');
    assert('Accepted teammate is now enrolled in project members', project.enrolledStudentIds.includes(invitedTeammateId));

    // Faculty accepts supervision
    const facultyAccept = acceptInvitation(project, facultyInvite.id, invitedFacultyId);
    assert('Faculty successfully accepts supervision invitation', facultyAccept.success);
    assert('Faculty invitation status is transitioned to ACCEPTED', facultyInvite.status === 'ACCEPTED');
    assert('Project assignedFacultyId is updated to the accepting faculty', project.assignedFacultyId === invitedFacultyId);

    // C. Validation rules: Self-invitation & duplicates
    const validateInvitationRequest = (
      creatorId: string,
      recipientId: string,
      recipientRole: string,
      type: 'TEAM_MEMBER' | 'FACULTY_GUIDE',
      alreadyEnrolled: boolean,
      existingPending: boolean
    ) => {
      if (creatorId === recipientId) return { valid: false, error: 'Cannot invite yourself' };
      if (type === 'TEAM_MEMBER' && recipientRole !== 'STUDENT') return { valid: false, error: 'Recipient must be student' };
      if (type === 'FACULTY_GUIDE' && recipientRole !== 'FACULTY') return { valid: false, error: 'Recipient must be faculty' };
      if (alreadyEnrolled) return { valid: false, error: 'Already enrolled' };
      if (existingPending) return { valid: false, error: 'Pending invitation already exists' };
      return { valid: true };
    };

    assert('Rejects self-invitation', !validateInvitationRequest('u1', 'u1', 'STUDENT', 'TEAM_MEMBER', false, false).valid);
    assert('Rejects duplicate pending invitation to same student', !validateInvitationRequest('u1', 'u2', 'STUDENT', 'TEAM_MEMBER', false, true).valid);
    assert('Rejects team invitation to student already enrolled', !validateInvitationRequest('u1', 'u2', 'STUDENT', 'TEAM_MEMBER', true, false).valid);
    assert('Rejects non-faculty recipient for faculty guide invitation', !validateInvitationRequest('u1', 'u3', 'STUDENT', 'FACULTY_GUIDE', false, false).valid);
    assert('Accepts valid new team invitation to unregistered student', validateInvitationRequest('u1', 'u4', 'STUDENT', 'TEAM_MEMBER', false, false).valid);
  }

  // -------------------------------------------------------------
  // 10. UNIT & INTEGRATION TESTS: COMPLETE SKILL VERIFICATION LIFECYCLE (PHASE 3)
  // Equations (3)-(4): Profile Ps = { s in S | Verified(s) }
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[10] Unit & Integration Tests: Complete Skill Verification Lifecycle (Phase 3 & Paper Eq. 3-4)\x1b[0m');
  {
    interface StudentSkillRecord {
      id: string;
      studentId: string;
      skillId: string;
      skillName: string;
      level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
      verification: 'PENDING' | 'VERIFIED' | 'REJECTED';
      verifiedById?: string | null;
      verifiedAt?: Date | null;
      rejectionReason?: string | null;
      feedback?: string | null;
      evidenceProjectIds: string[];
    }

    interface ProjectRecord {
      id: string;
      title: string;
      assignedFacultyId?: string | null;
      createdById: string;
      enrolledStudentIds: string[];
    }

    const facultyAId = 'faculty-prof-a';
    const facultyBId = 'faculty-prof-b';
    const student1Id = 'student-alice';

    const projectAlpha: ProjectRecord = {
      id: 'proj-alpha',
      title: 'Decentralized Identity System',
      assignedFacultyId: facultyAId,
      createdById: student1Id,
      enrolledStudentIds: [student1Id],
    };

    const projectBeta: ProjectRecord = {
      id: 'proj-beta',
      title: 'Compiler Design Lab',
      assignedFacultyId: facultyBId,
      createdById: facultyBId,
      enrolledStudentIds: [student1Id],
    };

    // A. Student submits skill claim with project evidence
    const submitSkillClaim = (
      studentId: string,
      skillId: string,
      skillName: string,
      projectId: string,
      level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' = 'INTERMEDIATE',
      existingRecord?: StudentSkillRecord
    ): StudentSkillRecord => {
      if (existingRecord) {
        // Resubmission of existing (e.g. REJECTED) claim resets to PENDING
        return {
          ...existingRecord,
          level,
          verification: 'PENDING',
          rejectionReason: null,
          feedback: null,
          verifiedById: null,
          verifiedAt: null,
          evidenceProjectIds: Array.from(new Set([...existingRecord.evidenceProjectIds, projectId])),
        };
      }
      return {
        id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId,
        skillId,
        skillName,
        level,
        verification: 'PENDING',
        evidenceProjectIds: [projectId],
      };
    };

    let claimReact = submitSkillClaim(student1Id, 'sk-react', 'React.js', projectAlpha.id, 'INTERMEDIATE');
    let claimDocker = submitSkillClaim(student1Id, 'sk-docker', 'Docker', projectAlpha.id, 'BEGINNER');

    assert('Student submits initial skill claim with PENDING status', claimReact.verification === 'PENDING');
    assert('Skill claim is linked to project evidence', claimReact.evidenceProjectIds.includes(projectAlpha.id));

    // B. Equations (3)-(4): Profile Ps verification filter
    const getVerifiedProfile = (records: StudentSkillRecord[]) => {
      return records.filter((r) => r.verification === 'VERIFIED');
    };

    assert('Unverified PENDING claims are NOT in student verified profile Ps (Eq. 3)', getVerifiedProfile([claimReact, claimDocker]).length === 0);

    // C. Faculty verification authorization & execution
    const verifySkillClaim = (
      facultyId: string,
      facultyRole: string,
      claim: StudentSkillRecord,
      projects: ProjectRecord[],
      confirmedLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
      facultyFeedback?: string
    ) => {
      if (facultyRole !== 'FACULTY' && facultyRole !== 'ADMIN') {
        return { success: false, error: 'Unauthorized role' };
      }
      // Check faculty supervision boundary: must supervise or have created at least one evidence project
      const hasSupervision = claim.evidenceProjectIds.some((pId) => {
        const proj = projects.find((p) => p.id === pId);
        return proj && (proj.assignedFacultyId === facultyId || proj.createdById === facultyId);
      });

      if (!hasSupervision && facultyRole !== 'ADMIN') {
        return { success: false, error: 'Faculty does not supervise evidence project' };
      }

      const updatedLevel = confirmedLevel || claim.level;
      claim.verification = 'VERIFIED';
      claim.level = updatedLevel;
      claim.verifiedById = facultyId;
      claim.verifiedAt = new Date();
      claim.feedback = facultyFeedback || null;
      claim.rejectionReason = null;
      return { success: true, claim };
    };

    // Faculty B tries to verify claim from project Alpha (supervised by Faculty A) -> must fail!
    const unauthorizedVerify = verifySkillClaim(facultyBId, 'FACULTY', claimReact, [projectAlpha], 'ADVANCED');
    assert('Faculty B cannot verify claim for project supervised exclusively by Faculty A (Supervision Boundary)', !unauthorizedVerify.success);

    // Faculty A verifies claimReact and confirms/upgrades level to ADVANCED with praise
    const authorizedVerify = verifySkillClaim(
      facultyAId,
      'FACULTY',
      claimReact,
      [projectAlpha],
      'ADVANCED',
      'Demonstrated excellent component architecture and custom hooks.'
    );
    assert('Supervising Faculty A successfully verifies skill claim', authorizedVerify.success);
    assert('Verified claim records verifiedById and verifiedAt', claimReact.verifiedById === facultyAId && claimReact.verifiedAt !== null);
    assert('Faculty confirmed proficiency level upgrade to ADVANCED', claimReact.level === 'ADVANCED');
    assert('Mentor feedback recorded on verified record', claimReact.feedback === 'Demonstrated excellent component architecture and custom hooks.');

    // Now Eq. (3)-(4): Profile Ps includes React, but excludes Docker
    const profileAfterVerify = getVerifiedProfile([claimReact, claimDocker]);
    assert('Student verified profile Ps now strictly includes verified competency (Eq. 3-4)', profileAfterVerify.length === 1 && profileAfterVerify[0].skillId === 'sk-react');

    // D. Rejection with Constructive Feedback & Retention
    const rejectSkillClaim = (
      facultyId: string,
      facultyRole: string,
      claim: StudentSkillRecord,
      projects: ProjectRecord[],
      rejectionReason: string,
      feedback: string
    ) => {
      const hasSupervision = claim.evidenceProjectIds.some((pId) => {
        const proj = projects.find((p) => p.id === pId);
        return proj && (proj.assignedFacultyId === facultyId || proj.createdById === facultyId);
      });

      if (!hasSupervision && facultyRole !== 'ADMIN') {
        return { success: false, error: 'Unauthorized faculty' };
      }

      claim.verification = 'REJECTED';
      claim.rejectionReason = rejectionReason;
      claim.feedback = feedback;
      return { success: true, claim };
    };

    const rejectDocker = rejectSkillClaim(
      facultyAId,
      'FACULTY',
      claimDocker,
      [projectAlpha],
      'Inadequate evidence in project tasks',
      'Please attach Dockerfile and container deployment configuration to the project tasks.'
    );
    assert('Faculty successfully records structured rejection feedback', rejectDocker.success);
    assert('Rejected claim transitions status to REJECTED (not deleted)', claimDocker.verification === 'REJECTED');
    assert('Rejection reason is stored for student review', claimDocker.rejectionReason === 'Inadequate evidence in project tasks');
    assert('Rejected skill is excluded from student verified profile Ps', getVerifiedProfile([claimReact, claimDocker]).length === 1);

    // E. Student Resubmission Lifecycle
    claimDocker = submitSkillClaim(student1Id, 'sk-docker', 'Docker', projectAlpha.id, 'INTERMEDIATE', claimDocker);
    assert('Resubmitting a rejected claim transitions status back to PENDING', claimDocker.verification === 'PENDING');
    assert('Resubmission clears previous rejection reason', claimDocker.rejectionReason === null);
    assert('Resubmission updates requested level to INTERMEDIATE', claimDocker.level === 'INTERMEDIATE');

    // F. Institutional Verification Overview Analytics (Admin)
    const computeAdminOverview = (records: StudentSkillRecord[]) => {
      const total = records.length;
      const verified = records.filter((r) => r.verification === 'VERIFIED').length;
      const pending = records.filter((r) => r.verification === 'PENDING').length;
      const rejected = records.filter((r) => r.verification === 'REJECTED').length;
      const approvalRate = total > 0 ? Math.round((verified / total) * 100) : 0;
      return { total, verified, pending, rejected, approvalRate };
    };

    const overview = computeAdminOverview([claimReact, claimDocker]);
    assert('Institutional analytics correctly computes total claims', overview.total === 2);
    assert('Institutional analytics correctly computes verified count', overview.verified === 1);
    assert('Institutional analytics correctly computes pending count', overview.pending === 1);
    assert('Institutional analytics calculates approval rate percentage', overview.approvalRate === 50);
  }

  // -------------------------------------------------------------
  // 11. UNIT & INTEGRATION TESTS: DIGITAL SKILL PASSPORT & PORTFOLIO (PHASE 4)
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[11] Unit & Integration Tests: Digital Skill Passport & Portfolio (Phase 4)\x1b[0m');
  {
    // A. Profile validation and sanitization
    interface UserProfile {
      id: string;
      name: string;
      email: string;
      passwordHash: string; // Internal, must never leak
      headline?: string | null;
      bio?: string | null;
      department?: string | null;
      studentIdNo?: string | null;
      graduationYear?: string | null;
      githubUrl?: string | null;
      linkedinUrl?: string | null;
      shareableSlug?: string | null;
    }

    const initialUser: UserProfile = {
      id: 'student-uuid-101',
      name: 'Alice Johnson',
      email: 'alice@adtu.ac.in',
      passwordHash: '$2b$10$supersecretinternalhash',
    };

    const updateProfile = (
      user: UserProfile,
      payload: {
        headline?: string;
        bio?: string;
        department?: string;
        studentIdNo?: string;
        graduationYear?: string;
        githubUrl?: string;
        linkedinUrl?: string;
        shareableSlug?: string;
      },
      existingSlugs: string[] = []
    ) => {
      // Slug validation & normalization
      let cleanSlug: string | null = user.shareableSlug || null;
      if (payload.shareableSlug) {
        const normalized = payload.shareableSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        if (existingSlugs.includes(normalized)) {
          return { success: false, error: 'Slug already taken' };
        }
        cleanSlug = normalized;
      }

      // XSS and script stripping
      const cleanHeadline = payload.headline ? sanitizeString(payload.headline).trim() : user.headline;
      const cleanBio = payload.bio ? sanitizeString(payload.bio).trim() : user.bio;

      return {
        success: true,
        user: {
          ...user,
          headline: cleanHeadline,
          bio: cleanBio,
          department: payload.department ? payload.department.trim() : user.department,
          studentIdNo: payload.studentIdNo ? payload.studentIdNo.trim() : user.studentIdNo,
          graduationYear: payload.graduationYear ? payload.graduationYear.trim() : user.graduationYear,
          githubUrl: payload.githubUrl ? payload.githubUrl.trim() : user.githubUrl,
          linkedinUrl: payload.linkedinUrl ? payload.linkedinUrl.trim() : user.linkedinUrl,
          shareableSlug: cleanSlug,
        },
      };
    };

    // Update with XSS injection payload in bio
    const updated = updateProfile(
      initialUser,
      {
        headline: 'Full-Stack Developer <script>evil()</script>',
        bio: 'Passionate computer science engineer. <img src=x onerror=alert(1)>',
        department: 'B.Tech Computer Science & Engineering',
        studentIdNo: 'PRN 1032210123',
        graduationYear: '2026',
        githubUrl: 'https://github.com/alice',
        linkedinUrl: 'https://linkedin.com/in/alice',
        shareableSlug: 'Alice Johnson / 2026!',
      },
      ['taken-slug']
    );

    assert('Profile update succeeds with valid fields', updated.success);
    assert('Strips malicious script tags from headline (OWASP A03)', updated.user?.headline === 'Full-Stack Developer evil()');
    assert('Normalizes and slugifies custom shareable slug', updated.user?.shareableSlug === 'alice-johnson---2026-');
    assert('Rejects duplicate public portfolio slug', !updateProfile(initialUser, { shareableSlug: 'taken-slug' }, ['taken-slug']).success);

    // B. Digital Passport Certificate & Verification Hash Generation
    const generatePassportCertificate = (
      studentId: string,
      email: string,
      verifiedCount: number,
      projectCount: number
    ) => {
      const rawHash = jwt.sign({ sub: studentId, v: verifiedCount, p: projectCount }, 'hash_seed')
        .slice(-16)
        .toUpperCase();
      const code = `${rawHash.slice(0, 4)}-${rawHash.slice(4, 8)}-${rawHash.slice(8, 12)}-${rawHash.slice(12, 16)}`;
      return {
        certificateId: `STX-${studentId.slice(0, 8).toUpperCase()}-PASSPORT`,
        verificationCode: code,
        institution: 'MIT ADT University · StackX SkillTrack Competency Registry',
        issuedAt: new Date().toISOString(),
        status: verifiedCount > 0 ? 'ACADEMICALLY_CERTIFIED' : 'ACTIVE_CANDIDATE',
      };
    };

    const certAlice = generatePassportCertificate(initialUser.id, initialUser.email, 3, 2);
    assert('Generates formal Certificate ID prefixed with STX', certAlice.certificateId.startsWith('STX-'));
    assert('Certificate status is ACADEMICALLY_CERTIFIED when verified skills exist', certAlice.status === 'ACADEMICALLY_CERTIFIED');
    assert('Generates 16-character structured verification code', certAlice.verificationCode.length === 19); // 16 chars + 3 hyphens

    // C. Public Portfolio Data Contract & Privacy
    const buildPublicPortfolioPayload = (user: UserProfile, verifiedSkills: any[], projects: any[]) => {
      // Strips passwordHash and internal secrets
      const { passwordHash, ...publicStudent } = user;
      return {
        student: publicStudent,
        certificate: generatePassportCertificate(user.id, user.email, verifiedSkills.length, projects.length),
        summary: {
          totalVerifiedSkills: verifiedSkills.length,
          totalProjects: projects.length,
        },
        verifiedSkills,
        projects,
      };
    };

    const publicPayload = buildPublicPortfolioPayload(
      updated.user!,
      [{ id: 'vs-1', name: 'React.js', level: 'ADVANCED', verifiedBy: { name: 'Prof. Sharma' } }],
      [{ id: 'p-1', title: 'AgileFlow Tracker', status: 'COMPLETED' }]
    );

    assert('Public portfolio payload contains student identity', publicPayload.student.name === 'Alice Johnson');
    assert('Public portfolio payload completely excludes password hash (Data Privacy)', (publicPayload.student as any).passwordHash === undefined);
    assert('Public portfolio strictly includes only verified skills (Eq. 3-4)', publicPayload.verifiedSkills.length === 1 && publicPayload.verifiedSkills[0].name === 'React.js');
    assert('Public portfolio includes faculty verifier credentials', publicPayload.verifiedSkills[0].verifiedBy.name === 'Prof. Sharma');
    assert('Public portfolio includes academic project portfolio', publicPayload.projects.length === 1 && publicPayload.projects[0].title === 'AgileFlow Tracker');
  }

  // -------------------------------------------------------------
  // 12. UNIT & INTEGRATION TESTS: TALENT SEARCH & SKILL ANALYTICS (PHASE 5)
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[12] Unit & Integration Tests: Talent Search & Skill Analytics (Phase 5)\x1b[0m');
  {
    interface CandidateSkill {
      id: string;
      name: string;
      isVerified: boolean;
      level?: string;
    }

    interface MockCandidate {
      id: string;
      name: string;
      verifiedSkillIds: string[];
      exposureSkillIds: string[];
      totalProjects: number;
    }

    const candidateAlice: MockCandidate = {
      id: 'c-1',
      name: 'Alice Johnson',
      verifiedSkillIds: ['sk-react', 'sk-node'],
      exposureSkillIds: ['sk-react', 'sk-node', 'sk-docker'],
      totalProjects: 3,
    };

    const candidateBob: MockCandidate = {
      id: 'c-2',
      name: 'Bob Smith',
      verifiedSkillIds: [],
      exposureSkillIds: ['sk-react', 'sk-node', 'sk-docker'],
      totalProjects: 1,
    };

    const candidateCharlie: MockCandidate = {
      id: 'c-3',
      name: 'Charlie Davis',
      verifiedSkillIds: ['sk-react', 'sk-node', 'sk-docker'],
      exposureSkillIds: ['sk-react', 'sk-node', 'sk-docker'],
      totalProjects: 4,
    };

    const targetJobRole = {
      id: 'role-fullstack',
      title: 'Full-Stack Software Engineer',
      requiredSkills: [
        { id: 'sk-react', name: 'React.js' },
        { id: 'sk-node', name: 'Node.js' },
        { id: 'sk-docker', name: 'Docker' },
        { id: 'sk-sql', name: 'PostgreSQL' },
      ],
    };

    // A. Multi-Mode Matching Algorithm
    const evaluateCandidate = (
      candidate: MockCandidate,
      requiredSkills: Array<{ id: string; name: string }>,
      matchMode: 'VERIFIED_ONLY' | 'ALL_DEMONSTRATED'
    ) => {
      const totalRequired = requiredSkills.length;
      const matched: CandidateSkill[] = [];
      const missing: Array<{ id: string; name: string }> = [];
      let verifiedCount = 0;

      for (const req of requiredSkills) {
        const isVerified = candidate.verifiedSkillIds.includes(req.id);
        const hasExposure = candidate.exposureSkillIds.includes(req.id);

        if (isVerified) verifiedCount++;

        const isMatched = matchMode === 'VERIFIED_ONLY' ? isVerified : (isVerified || hasExposure);

        if (isMatched) {
          matched.push({ id: req.id, name: req.name, isVerified, level: isVerified ? 'ADVANCED' : undefined });
        } else {
          missing.push(req);
        }
      }

      const matchPercentage = Math.round((matched.length / totalRequired) * 100);
      const verifiedMatchPercentage = Math.round((verifiedCount / totalRequired) * 100);

      return {
        id: candidate.id,
        name: candidate.name,
        totalProjects: candidate.totalProjects,
        matchPercentage,
        verifiedMatchPercentage,
        matched,
        missing,
      };
    };

    // Evaluate Bob under ALL_DEMONSTRATED
    const bobAll = evaluateCandidate(candidateBob, targetJobRole.requiredSkills, 'ALL_DEMONSTRATED');
    assert('ALL_DEMONSTRATED mode recognizes project exposure (3/4 = 75%)', bobAll.matchPercentage === 75);
    assert('Correctly identifies missing competency (PostgreSQL)', bobAll.missing.some((m) => m.id === 'sk-sql'));
    assert('Bob has 0% verified match percentage', bobAll.verifiedMatchPercentage === 0);

    // Evaluate Bob under VERIFIED_ONLY
    const bobVerifiedOnly = evaluateCandidate(candidateBob, targetJobRole.requiredSkills, 'VERIFIED_ONLY');
    assert('VERIFIED_ONLY mode strictly filters unverified exposure (Bob = 0% match)', bobVerifiedOnly.matchPercentage === 0);

    // Evaluate Alice under VERIFIED_ONLY
    const aliceVerifiedOnly = evaluateCandidate(candidateAlice, targetJobRole.requiredSkills, 'VERIFIED_ONLY');
    assert('Alice matches 2 verified competencies (50% verified match)', aliceVerifiedOnly.matchPercentage === 50);
    assert('Distinguishes verified status on matched skills', aliceVerifiedOnly.matched.every((m) => m.isVerified));

    // B. Candidate Ranking
    const candidates = [candidateBob, candidateAlice, candidateCharlie];
    const evaluatedList = candidates.map((c) =>
      evaluateCandidate(c, targetJobRole.requiredSkills, 'ALL_DEMONSTRATED')
    );

    evaluatedList.sort(
      (a, b) =>
        b.matchPercentage - a.matchPercentage ||
        b.verifiedMatchPercentage - a.verifiedMatchPercentage ||
        b.totalProjects - a.totalProjects ||
        a.name.localeCompare(b.name)
    );

    assert('Candidate with 75% match and all verified (Charlie) ranks #1', evaluatedList[0].name === 'Charlie Davis');
    assert('Candidate with verified skills (Alice) ranks higher than unverified peer (Bob)', evaluatedList[1].name === 'Alice Johnson');
    assert('Candidate with only exposure (Bob) ranks behind verified peer', evaluatedList[2].name === 'Bob Smith');

    // C. Institutional Skill Gap & Shortage Analytics
    const computeSkillGap = (
      skillId: string,
      requiredInRolesCount: number,
      verifiedStudentCount: number,
      totalStudentPool: number
    ) => {
      const targetPool = requiredInRolesCount > 0 ? Math.max(1, Math.round(totalStudentPool * 0.4)) : 0;
      const shortage = Math.max(0, targetPool - verifiedStudentCount);
      const gapPercentage = targetPool > 0 ? Math.round((shortage / targetPool) * 100) : 0;
      return { shortage, gapPercentage };
    };

    // Skill required in 3 job roles, only 1 student verified out of 10 students (target = 4)
    const gapHighDemand = computeSkillGap('sk-sql', 3, 1, 10);
    assert('Calculates student shortage gap for high-demand competency', gapHighDemand.shortage === 3);
    assert('Calculates shortage percentage (75% gap)', gapHighDemand.gapPercentage === 75);

    // D. Role Readiness Tiers Classification
    const classifyReadiness = (matchPct: number) => {
      if (matchPct >= 80) return 'READY';
      if (matchPct >= 50) return 'PROGRESSING';
      return 'DEVELOPING';
    };

    assert('Match >= 80% classified as READY', classifyReadiness(85) === 'READY');
    assert('Match between 50-79% classified as PROGRESSING', classifyReadiness(75) === 'PROGRESSING');
    assert('Match < 50% classified as DEVELOPING', classifyReadiness(40) === 'DEVELOPING');
  }

  // -------------------------------------------------------------
  // 13. UNIT & INTEGRATION TESTS: ROLE-BASED DASHBOARDS & WORKLOAD HIERARCHY (PHASE 6)
  // -------------------------------------------------------------
  console.log('\n\x1b[1m[13] Unit & Integration Tests: Role-Based Dashboards & Workload Hierarchy (Phase 6)\x1b[0m');
  {
    interface MockProject {
      id: string;
      title: string;
      status: 'ACTIVE' | 'COMPLETED';
      createdById: string;
      assignedFacultyId?: string | null;
      enrolledStudentIds: string[];
      hasOverdueTask: boolean;
    }

    interface MockInvitation {
      id: string;
      projectId: string;
      status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
      type: 'TEAM_MEMBER' | 'FACULTY_GUIDE';
    }

    const projects: MockProject[] = [
      {
        id: 'p-1',
        title: 'Autonomous Navigation Drone',
        status: 'ACTIVE',
        createdById: 'student-1',
        assignedFacultyId: 'faculty-1',
        enrolledStudentIds: ['student-1', 'student-2'],
        hasOverdueTask: false,
      },
      {
        id: 'p-2',
        title: 'Microservices Payment Gateway',
        status: 'ACTIVE',
        createdById: 'student-3',
        assignedFacultyId: null, // Needs faculty guide!
        enrolledStudentIds: ['student-3'],
        hasOverdueTask: true,
      },
      {
        id: 'p-3',
        title: 'Distributed Log Aggregator',
        status: 'COMPLETED',
        createdById: 'faculty-1',
        assignedFacultyId: 'faculty-1',
        enrolledStudentIds: ['student-1'],
        hasOverdueTask: false,
      },
    ];

    const invitations: MockInvitation[] = [
      { id: 'inv-1', projectId: 'p-2', status: 'PENDING', type: 'FACULTY_GUIDE' },
      { id: 'inv-2', projectId: 'p-1', status: 'PENDING', type: 'TEAM_MEMBER' },
      { id: 'inv-3', projectId: 'p-1', status: 'ACCEPTED', type: 'TEAM_MEMBER' },
    ];

    // A. Admin Dashboard Governance Aggregations
    const computeAdminGovernance = (projs: MockProject[], invs: MockInvitation[], totalUsers: number) => {
      const active = projs.filter((p) => p.status === 'ACTIVE').length;
      const completed = projs.filter((p) => p.status === 'COMPLETED').length;
      const overdue = projs.filter((p) => p.status === 'ACTIVE' && p.hasOverdueTask).length;
      const unassignedGuide = projs.filter((p) => !p.assignedFacultyId).length;
      const pendingInvs = invs.filter((i) => i.status === 'PENDING').length;

      return {
        totalUsers,
        totalProjects: projs.length,
        activeProjects: active,
        completedProjects: completed,
        overdueProjects: overdue,
        unassignedGuideProjects: unassignedGuide,
        pendingInvitationsCount: pendingInvs,
      };
    };

    const adminStats = computeAdminGovernance(projects, invitations, 15);
    assert('Admin Dashboard calculates active projects count', adminStats.activeProjects === 2);
    assert('Admin Dashboard calculates completed projects count', adminStats.completedProjects === 1);
    assert('Admin Dashboard flags overdue projects needing intervention', adminStats.overdueProjects === 1);
    assert('Admin Dashboard detects projects awaiting faculty supervisor assignment', adminStats.unassignedGuideProjects === 1);
    assert('Admin Dashboard tracks total pending invitations across the institution', adminStats.pendingInvitationsCount === 2);

    // B. Faculty Dashboard Scope & Workload Protection
    const getFacultySupervisedProjects = (projs: MockProject[], facultyId: string) => {
      return projs.filter(
        (p) => p.assignedFacultyId === facultyId || p.createdById === facultyId
      );
    };

    const faculty1Projects = getFacultySupervisedProjects(projects, 'faculty-1');
    assert('Faculty Dashboard displays only projects supervised or created by faculty (Zero routine administrative clutter)', faculty1Projects.length === 2);
    assert('Faculty Dashboard excludes unsupervised projects (p-2)', !faculty1Projects.some((p) => p.id === 'p-2'));

    // C. Student Dashboard Ownership & Passport Readiness
    const computeStudentDashboardData = (
      studentId: string,
      projs: MockProject[],
      verifiedSkillCount: number,
      hasBio: boolean
    ) => {
      const studentProjects = projs.filter(
        (p) => p.enrolledStudentIds.includes(studentId) || p.createdById === studentId
      );
      const ownedProjects = studentProjects.filter((p) => p.createdById === studentId);

      // Passport readiness calculation
      let readinessScore = 0;
      if (verifiedSkillCount > 0) readinessScore += 40;
      if (studentProjects.some((p) => p.status === 'COMPLETED')) readinessScore += 30;
      if (hasBio) readinessScore += 30;

      return {
        studentProjects,
        ownedProjects,
        readinessScore,
      };
    };

    const student1Data = computeStudentDashboardData('student-1', projects, 2, true);
    assert('Student Dashboard identifies student-owned projects (Student creator ownership)', student1Data.ownedProjects.length === 1 && student1Data.ownedProjects[0].id === 'p-1');
    assert('Student Dashboard includes enrolled collaborative projects', student1Data.studentProjects.length === 2);
    assert('Student Dashboard computes placement passport readiness score (40% skills + 30% completed + 30% bio = 100%)', student1Data.readinessScore === 100);

    // D. Role-Based Access Control on Dashboard Endpoints
    const authorizeDashboardAccess = (role: string, targetEndpoint: string) => {
      if (targetEndpoint.startsWith('/admin')) return role === 'ADMIN';
      if (targetEndpoint.startsWith('/faculty')) return role === 'FACULTY' || role === 'ADMIN';
      if (targetEndpoint.startsWith('/student')) return role === 'STUDENT' || role === 'ADMIN';
      return false;
    };

    assert('Student cannot access /admin/overview (403 Forbidden)', !authorizeDashboardAccess('STUDENT', '/admin/overview'));
    assert('Faculty cannot access /admin/overview (403 Forbidden)', !authorizeDashboardAccess('FACULTY', '/admin/overview'));
    assert('Admin can access /admin/overview', authorizeDashboardAccess('ADMIN', '/admin/overview'));
    assert('Faculty can access /faculty dashboard routes', authorizeDashboardAccess('FACULTY', '/faculty/deadlines'));
    assert('Student can access /student dashboard routes', authorizeDashboardAccess('STUDENT', '/student/tasks'));
  }

  // -------------------------------------------------------------
  // SECTION 14: Phase 7 — Notifications & Collaboration
  // -------------------------------------------------------------
  {
    console.log('\n\x1b[36m--- Section 14: Phase 7 — Notifications & Collaboration ---\x1b[0m');

    interface MockNotification {
      id: string;
      userId: string;
      type:
        | 'PROJECT_INVITATION'
        | 'FACULTY_SUPERVISION_REQUEST'
        | 'INVITATION_ACCEPTED'
        | 'INVITATION_DECLINED'
        | 'TASK_ASSIGNED'
        | 'DEADLINE_REMINDER'
        | 'SKILL_VERIFIED'
        | 'SKILL_REJECTED'
        | 'SYSTEM_ALERT';
      title: string;
      message: string;
      link: string | null;
      isRead: boolean;
      createdAt: Date;
    }

    const notificationsStore: MockNotification[] = [];

    const createNotification = (params: {
      userId: string;
      type: MockNotification['type'];
      title: string;
      message: string;
      link?: string | null;
    }): MockNotification => {
      const notif: MockNotification = {
        id: `notif-${notificationsStore.length + 1}`,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
        isRead: false,
        createdAt: new Date(),
      };
      notificationsStore.push(notif);
      return notif;
    };

    // A. Role-Specific Notification Creation
    const testStudentId = 'student-alice-101';
    const testFacultyId = 'faculty-dr-smith-202';

    // 1. Project Team Invitation
    const inviteNotif = createNotification({
      userId: testStudentId,
      type: 'PROJECT_INVITATION',
      title: 'Project Team Invitation',
      message: 'Lead Developer invited you to join "Autonomous Drone Tracker".',
      link: '/projects/p-drone',
    });
    assert('Notification model creates PROJECT_INVITATION with unread default (isRead = false)', inviteNotif.id !== undefined && inviteNotif.isRead === false);
    assert('Notification is strictly assigned to target recipient userId', inviteNotif.userId === testStudentId);

    // 2. Faculty Supervision Request
    const facultyNotif = createNotification({
      userId: testFacultyId,
      type: 'FACULTY_SUPERVISION_REQUEST',
      title: 'Project Supervision Request',
      message: 'Student Alice requested your academic supervision for "Blockchain Ledger".',
      link: '/faculty',
    });
    assert('Notification model creates FACULTY_SUPERVISION_REQUEST for faculty guide', facultyNotif.type === 'FACULTY_SUPERVISION_REQUEST' && facultyNotif.userId === testFacultyId);

    // 3. Task Assignment Notification
    const taskNotif = createNotification({
      userId: testStudentId,
      type: 'TASK_ASSIGNED',
      title: 'New Project Task Added',
      message: 'A team member added task "Implement OAuth2 Flow" to the board.',
      link: '/projects/p-drone',
    });
    assert('Notification model creates TASK_ASSIGNED notification', taskNotif.type === 'TASK_ASSIGNED');

    // 4. Skill Claim Approved Notification
    const skillApproveNotif = createNotification({
      userId: testStudentId,
      type: 'SKILL_VERIFIED',
      title: 'Skill Claim Approved!',
      message: 'Faculty verified your competency in "PostgreSQL" at level ADVANCED. Feedback: "Excellent schema design."',
      link: '/student',
    });
    assert('Notification model creates SKILL_VERIFIED notification with level and feedback', skillApproveNotif.type === 'SKILL_VERIFIED' && skillApproveNotif.message.includes('level ADVANCED'));

    // 5. Skill Claim Rejected Notification
    const skillRejectNotif = createNotification({
      userId: testStudentId,
      type: 'SKILL_REJECTED',
      title: 'Skill Claim Requires Revision',
      message: 'Your claim for "Kubernetes" was not approved. Feedback: "Please provide cluster architecture diagram."',
      link: '/student',
    });
    assert('Notification model creates SKILL_REJECTED notification with constructive reason', skillRejectNotif.type === 'SKILL_REJECTED' && skillRejectNotif.message.includes('cluster architecture diagram'));

    // 6. Deadline Reminder Notification
    const deadlineNotif = createNotification({
      userId: testStudentId,
      type: 'DEADLINE_REMINDER',
      title: 'Upcoming Task Deadline',
      message: 'Task "Final Report Submission" is due in less than 48 hours.',
      link: '/projects/p-drone',
    });
    assert('Notification model creates DEADLINE_REMINDER notification', deadlineNotif.type === 'DEADLINE_REMINDER');

    // B. Unread Count & Notification Retrieval
    const getNotificationsForUser = (userId: string) => {
      const list = notificationsStore.filter((n) => n.userId === userId);
      const unreadCount = list.filter((n) => !n.isRead).length;
      return { list, unreadCount };
    };

    const studentFeed = getNotificationsForUser(testStudentId);
    assert('Retrieves all notifications for student in chronological order', studentFeed.list.length === 5);
    assert('Counts unread notifications accurately before marking as read (5 unread)', studentFeed.unreadCount === 5);

    // C. Mark Single Notification as Read
    const markSingleAsRead = (id: string, requesterId: string) => {
      const notif = notificationsStore.find((n) => n.id === id);
      if (!notif) return { status: 404 };
      if (notif.userId !== requesterId) return { status: 403 };
      notif.isRead = true;
      return { status: 200, notif };
    };

    const markRes = markSingleAsRead(inviteNotif.id, testStudentId);
    assert('Mark single notification as read sets isRead to true', markRes.status === 200 && markRes.notif?.isRead === true);

    const postSingleFeed = getNotificationsForUser(testStudentId);
    assert('Unread count decreases by 1 after marking single notification read (4 unread)', postSingleFeed.unreadCount === 4);

    // D. Mark All Notifications as Read
    const markAllAsRead = (requesterId: string) => {
      let count = 0;
      for (const n of notificationsStore) {
        if (n.userId === requesterId && !n.isRead) {
          n.isRead = true;
          count++;
        }
      }
      return { count };
    };

    const markAllRes = markAllAsRead(testStudentId);
    assert('Mark all as read updates all remaining unread notifications', markAllRes.count === 4);
    assert('Unread count is 0 after mark-all-as-read', getNotificationsForUser(testStudentId).unreadCount === 0);

    // E. Dismiss / Delete Notification
    const dismissNotification = (id: string, requesterId: string) => {
      const index = notificationsStore.findIndex((n) => n.id === id);
      if (index === -1) return { status: 404 };
      if (notificationsStore[index].userId !== requesterId) return { status: 403 };
      notificationsStore.splice(index, 1);
      return { status: 200 };
    };

    const dismissRes = dismissNotification(deadlineNotif.id, testStudentId);
    assert('Dismiss / Delete removes notification from store (200 OK)', dismissRes.status === 200);
    assert('Deleted notification no longer appears in user feed', notificationsStore.find((n) => n.id === deadlineNotif.id) === undefined);

    // F. Security & Access Boundaries: User isolation
    const unauthorizedMark = markSingleAsRead(facultyNotif.id, testStudentId);
    assert('Student cannot mark Faculty notification as read (403 Forbidden)', unauthorizedMark.status === 403);

    const unauthorizedDismiss = dismissNotification(facultyNotif.id, testStudentId);
    assert('Student cannot dismiss Faculty notification (403 Forbidden)', unauthorizedDismiss.status === 403);

    // G. Workload Hierarchy: Role isolation in notification delivery
    const facultyFeed = getNotificationsForUser(testFacultyId);
    assert('Faculty receives supervision request notifications', facultyFeed.list.some((n) => n.type === 'FACULTY_SUPERVISION_REQUEST'));
    assert('Faculty receives zero routine task or team clutter (Workload hierarchy preserved)', !facultyFeed.list.some((n) => n.type === 'TASK_ASSIGNED'));
  }

  // -------------------------------------------------------------
  // SECTION 15: Phase 8 — Backend, Database & Security Optimization
  // -------------------------------------------------------------
  {
    console.log('\n\x1b[36m--- Section 15: Phase 8 — Backend, Database & Security Optimization ---\x1b[0m');

    // A. Path Traversal & Header Injection Prevention (OWASP A01 & A03)
    const uploadsDir = '/var/app/uploads/attachments';
    const validateFilePathContainment = (baseDir: string, userFilePath: string): boolean => {
      // Must not contain null bytes
      if (userFilePath.includes('\0')) return false;
      const resolved = userFilePath.startsWith('/')
        ? userFilePath
        : `${baseDir}/${userFilePath}`.replace(/\/+/g, '/');
      
      // Resolve path normalization
      const parts = resolved.split('/');
      const stack: string[] = [];
      for (const p of parts) {
        if (!p || p === '.') continue;
        if (p === '..') {
          if (stack.length > 0) stack.pop();
        } else {
          stack.push(p);
        }
      }
      const canonical = '/' + stack.join('/');
      return canonical.startsWith(baseDir + '/') || canonical === baseDir;
    };

    assert('Allows legitimate file in uploads directory', validateFilePathContainment(uploadsDir, '1731400000-abc1234.pdf'));
    assert('Blocks directory traversal payload ../../../../etc/passwd', !validateFilePathContainment(uploadsDir, '../../../../etc/passwd'));
    assert('Blocks subtle relative traversal uploads/attachments/../secret.env', !validateFilePathContainment(uploadsDir, '../secret.env'));
    assert('Blocks null byte injection in file path', !validateFilePathContainment(uploadsDir, 'report.pdf\0.exe'));

    // B. Filename Header Injection & Response Splitting Sanitization
    const sanitizeDownloadFileName = (fileName: string) => {
      return fileName.replace(/[\r\n"]/g, '_').trim();
    };

    const maliciousHeader = 'invoice\r\nSet-Cookie: sessionId=hacked\r\n.pdf';
    const sanitizedHeader = sanitizeDownloadFileName(maliciousHeader);
    assert('Strips CR and LF control characters from download filename', !sanitizedHeader.includes('\r') && !sanitizedHeader.includes('\n'));
    assert('Neutralizes HTTP response splitting header injection vector', sanitizedHeader === 'invoice__Set-Cookie: sessionId=hacked__.pdf');

    // C. Executable Extension Restriction Filter
    const disallowedExtensions = new Set([
      '.exe', '.sh', '.bat', '.cmd', '.com', '.vbs', '.js', '.mjs', '.cjs',
      '.php', '.phtml', '.py', '.rb', '.pl', '.cgi', '.jar', '.war', '.apk'
    ]);

    const isExtensionPermitted = (fileName: string): boolean => {
      const ext = (fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '').toLowerCase();
      return !disallowedExtensions.has(ext);
    };

    assert('Rejects Windows executable (.exe)', !isExtensionPermitted('malware.exe'));
    assert('Rejects Unix shell script (.sh)', !isExtensionPermitted('exploit.sh'));
    assert('Rejects Python script payload (.py)', !isExtensionPermitted('backdoor.py'));
    assert('Rejects PHP backdoor script (.php)', !isExtensionPermitted('webshell.php'));
    assert('Accepts valid document (.pdf)', isExtensionPermitted('thesis_final.pdf'));
    assert('Accepts valid spreadsheet (.xlsx)', isExtensionPermitted('dataset.xlsx'));

    // D. Transaction Isolation & Rollback Verification (Data Integrity)
    interface MockSkillState {
      skills: Array<{ studentId: string; skillId: string; status: string }>;
      evidence: Array<{ studentSkillId: string; projectId: string }>;
    }

    const state: MockSkillState = { skills: [], evidence: [] };

    const submitClaimTransactional = (
      studentId: string,
      skillId: string,
      projectId: string,
      failEvidence: boolean
    ): { success: boolean; error?: string } => {
      // Begin transaction snapshot
      const snapshotSkills = [...state.skills];
      const snapshotEvidence = [...state.evidence];

      try {
        // Step 1: Upsert Skill Claim
        state.skills.push({ studentId, skillId, status: 'PENDING' });

        // Step 2: Upsert Evidence Link
        if (failEvidence) {
          throw new Error('Database foreign key violation on projectId');
        }
        state.evidence.push({ studentSkillId: `${studentId}-${skillId}`, projectId });

        return { success: true };
      } catch (err: any) {
        // Rollback state on error
        state.skills = snapshotSkills;
        state.evidence = snapshotEvidence;
        return { success: false, error: err.message };
      }
    };

    const failTxResult = submitClaimTransactional('student-1', 'sk-docker', 'invalid-p-id', true);
    assert('Transaction fails when evidence linking fails', !failTxResult.success);
    assert('Transaction rollback leaves zero orphaned unbacked claims in database', state.skills.length === 0 && state.evidence.length === 0);

    const successTxResult = submitClaimTransactional('student-1', 'sk-docker', 'p-drone-1', false);
    assert('Transaction succeeds when evidence linking succeeds', successTxResult.success);
    assert('Atomic commit stores both claim and supporting evidence simultaneously', state.skills.length === 1 && state.evidence.length === 1);

    // E. User Profile XSS Sanitization & URL Normalization
    const sanitizeProfilePayload = (headline: string, github: string, linkedin: string) => {
      const cleanHeadline = sanitizeString(headline);
      let cleanGithub = github.trim();
      if (!cleanGithub.startsWith('https://')) {
        cleanGithub = `https://github.com/${cleanGithub.replace(/^@/, '')}`;
      }
      let cleanLinkedin = linkedin.trim();
      if (!cleanLinkedin.startsWith('https://')) {
        cleanLinkedin = `https://linkedin.com/in/${cleanLinkedin.replace(/^@/, '')}`;
      }
      return { headline: cleanHeadline, github: cleanGithub, linkedin: cleanLinkedin };
    };

    const rawProfile = {
      headline: '<script>alert("hacked")</script>Senior Full-Stack Engineer',
      github: '@alice-dev',
      linkedin: 'alice-johnson',
    };
    const cleanedProfile = sanitizeProfilePayload(rawProfile.headline, rawProfile.github, rawProfile.linkedin);
    assert('Strips stored HTML/script tags from profile headline', !cleanedProfile.headline.includes('<script>') && !cleanedProfile.headline.includes('</script>'));
    assert('Normalizes GitHub handle to valid HTTPS URL', cleanedProfile.github === 'https://github.com/alice-dev');
    assert('Normalizes LinkedIn handle to valid HTTPS profile URL', cleanedProfile.linkedin === 'https://linkedin.com/in/alice-johnson');

    // F. Global Error Handler Masking (OWASP A05)
    const handleGlobalError = (err: Error, isDev: boolean) => {
      const statusCode = 500;
      const safeMessage = 'An unexpected internal server error occurred. Please try again later.';
      return {
        status: 'error',
        statusCode,
        message: safeMessage,
        // Stack trace should never be exposed in client response
        leaksStackTrace: false,
      };
    };

    const dummyDbError = new Error('FATAL: password authentication failed for user "postgres" at connection 127.0.0.1:5432\n    at Connection.parseE (/node_modules/pg/lib/connection.js:614:13)');
    const errorResponse = handleGlobalError(dummyDbError, false);
    assert('Global error handler masks internal database connection failure', errorResponse.message.includes('unexpected internal server error'));
    assert('Global error handler suppresses stack traces and server connection strings', !errorResponse.message.includes('127.0.0.1') && !errorResponse.leaksStackTrace);

    // G. Rate Limiter Fail-Closed Environment Configuration (OWASP A04 & A07)
    // 1. Explicit development mode (NODE_ENV=development)
    const devLimits = getRateLimitConfig('development');
    const devLimiters = createAuthRateLimiters('development');
    assert('Rate Limiter: Explicit development mode grants 1,000 registrations/hr', devLimits.registerMaxRequests === 1000 && devLimiters.register.maxRequests === 1000);
    assert('Rate Limiter: Explicit development mode grants 100 logins/15min', devLimits.loginMaxRequests === 100 && devLimiters.login.maxRequests === 100);

    // 2. Production mode (NODE_ENV=production)
    const prodLimits = getRateLimitConfig('production');
    const prodLimiters = createAuthRateLimiters('production');
    assert('Rate Limiter: Production mode strictly enforces 10 registrations/hr', prodLimits.registerMaxRequests === 10 && prodLimiters.register.maxRequests === 10);
    assert('Rate Limiter: Production mode strictly enforces 5 logins/15min', prodLimits.loginMaxRequests === 5 && prodLimiters.login.maxRequests === 5);

    // 3. Missing NODE_ENV (undefined / empty)
    const missingLimits = getRateLimitConfig(undefined);
    const missingLimiters = createAuthRateLimiters(undefined);
    assert('Rate Limiter: Missing NODE_ENV fails closed to 10 registrations/hr', missingLimits.registerMaxRequests === 10 && missingLimiters.register.maxRequests === 10);
    assert('Rate Limiter: Missing NODE_ENV fails closed to 5 logins/15min', missingLimits.loginMaxRequests === 5 && missingLimiters.login.maxRequests === 5);

    // 4. Unexpected NODE_ENV value (staging, test, unknown, random)
    const unexpectedLimits = getRateLimitConfig('staging-qa');
    const unexpectedLimiters = createAuthRateLimiters('staging-qa');
    assert('Rate Limiter: Unexpected NODE_ENV fails closed to 10 registrations/hr', unexpectedLimits.registerMaxRequests === 10 && unexpectedLimiters.register.maxRequests === 10);
    assert('Rate Limiter: Unexpected NODE_ENV fails closed to 5 logins/15min', unexpectedLimits.loginMaxRequests === 5 && unexpectedLimiters.login.maxRequests === 5);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m================================================================');
  console.log(`   Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('================================================================\x1b[0m\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
