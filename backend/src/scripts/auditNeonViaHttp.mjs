const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}
const host = conn.split('@')[1]?.split('/')[0]?.split('?')[0];
const endpoint = `https://${host}/sql`;

async function query(sql, params = []) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Neon-Connection-String': conn,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql, params }),
  });
  const data = await res.json();
  if (data.message) {
    throw new Error(data.message);
  }
  return data;
}

async function audit() {
  console.log('=== NEON HTTP AUDIT ===');
  
  const counts = await query(`
    SELECT 
      (SELECT count(*) FROM "User") as user_count,
      (SELECT count(*) FROM "Project") as project_count,
      (SELECT count(*) FROM "Task") as task_count,
      (SELECT count(*) FROM "Skill") as skill_count,
      (SELECT count(*) FROM "ProjectSkill") as project_skill_count,
      (SELECT count(*) FROM "StudentSkill") as student_skill_count,
      (SELECT count(*) FROM "JobRole") as job_role_count;
  `);
  console.table(counts.rows[0]);

  const users = await query(`
    SELECT id, name, email, role, department, "graduationYear"
    FROM "User"
    ORDER BY "createdAt" ASC;
  `);
  console.log('\n=== USERS IN NEON (' + users.rowCount + ') ===');
  console.table(users.rows);

  const projects = await query(`
    SELECT p.id, p.title, p.status, u.name as owner_name, u.email as owner_email,
           (SELECT count(*) FROM "Task" t WHERE t."projectId" = p.id) as task_count,
           (SELECT count(*) FROM "ProjectSkill" ps WHERE ps."projectId" = p.id) as skill_count,
           (SELECT count(*) FROM "ProjectSkill" ps WHERE ps."projectId" = p.id AND ps.verified = true) as verified_skills
    FROM "Project" p
    LEFT JOIN "User" u ON p."ownerId" = u.id
    ORDER BY p."createdAt" ASC;
  `);
  console.log('\n=== PROJECTS IN NEON (' + projects.rowCount + ') ===');
  console.table(projects.rows);

  const studentSkills = await query(`
    SELECT ss.id, u.name as student_name, s.name as skill_name, ss.level, ss.verification, ss.endorsements
    FROM "StudentSkill" ss
    JOIN "User" u ON ss."studentId" = u.id
    JOIN "Skill" s ON ss."skillId" = s.id
    ORDER BY u.name ASC;
  `);
  console.log('\n=== STUDENT SKILLS / CLAIMS IN NEON (' + studentSkills.rowCount + ') ===');
  console.table(studentSkills.rows);

  const jobRoles = await query(`
    SELECT jr.title, jr."isActive",
           (SELECT count(*) FROM "JobRoleSkill" jrs WHERE jrs."jobRoleId" = jr.id) as skill_count
    FROM "JobRole" jr
    ORDER BY jr.title ASC;
  `);
  console.log('\n=== JOB ROLES IN NEON (' + jobRoles.rowCount + ') ===');
  console.table(jobRoles.rows);
}

audit().catch(console.error);
