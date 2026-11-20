import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

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
    throw new Error(`${data.message} (SQL: ${sql})`);
  }
  return data;
}

async function run() {
  console.log('🚀 Starting Clean & Seed Showcase on Neon Database...\n');

  // 1. Clean up junk projects
  console.log('🧹 1. Cleaning up test projects...');
  const junkTitles = ['kmnjbhg', 'sghyuj', 'xyz', 'c cdxz', 'yy'];
  for (const title of junkTitles) {
    const pRes = await query('SELECT id FROM "Project" WHERE title = $1', [title]);
    for (const row of pRes.rows) {
      const pId = row.id;
      // Cascade-delete related records
      await query('DELETE FROM "StudentSkillEvidence" WHERE "projectId" = $1', [pId]);
      await query('DELETE FROM "ProjectSkill" WHERE "projectId" = $1', [pId]);
      await query('DELETE FROM "ProjectStudent" WHERE "projectId" = $1', [pId]);
      await query('DELETE FROM "ProjectFaculty" WHERE "projectId" = $1', [pId]);
      await query('DELETE FROM "ProjectAdmin" WHERE "projectId" = $1', [pId]);
      await query('DELETE FROM "Activity" WHERE "projectId" = $1', [pId]);
      await query('DELETE FROM "ProjectInvitation" WHERE "projectId" = $1', [pId]);
      
      const colRes = await query('SELECT id FROM "Column" WHERE "projectId" = $1', [pId]);
      for (const c of colRes.rows) {
        const taskRes = await query('SELECT id FROM "Task" WHERE "columnId" = $1', [c.id]);
        for (const t of taskRes.rows) {
          await query('DELETE FROM "Comment" WHERE "taskId" = $1', [t.id]);
          await query('DELETE FROM "Attachment" WHERE "taskId" = $1', [t.id]);
        }
        await query('DELETE FROM "Task" WHERE "columnId" = $1', [c.id]);
      }
      await query('DELETE FROM "Column" WHERE "projectId" = $1', [pId]);
      await query('DELETE FROM "Project" WHERE id = $1', [pId]);
      console.log(`  🗑️ Deleted junk project: "${title}" (${pId})`);
    }
  }

  // 2. Clean up throwaway test users
  console.log('\n🧹 2. Cleaning up throwaway test users...');
  const junkEmails = [
    'sectest-lhtne0@example.com',
    'ma-18616@example.com',
    'testing@gmail.com',
    'facultytesting@gmail.com',
  ];
  for (const email of junkEmails) {
    const uRes = await query('SELECT id FROM "User" WHERE email = $1', [email]);
    if (uRes.rowCount > 0) {
      const uId = uRes.rows[0].id;
      await query('DELETE FROM "StudentSkill" WHERE "studentId" = $1', [uId]);
      await query('DELETE FROM "Notification" WHERE "userId" = $1', [uId]);
      await query('DELETE FROM "User" WHERE id = $1', [uId]);
      console.log(`  🗑️ Deleted test user: ${email}`);
    }
  }

  // 3. Upsert Showcase Users
  console.log('\n👥 3. Upserting Showcase Presentation Users...');
  const studentPwHash = await bcrypt.hash('student123', 10);
  const facultyPwHash = await bcrypt.hash('faculty123', 10);
  const adminPwHash = await bcrypt.hash('admin123', 10);

  const showcaseUsers = [
    {
      name: 'Alex Rivera',
      email: 'alex.rivera@university.edu',
      password: studentPwHash,
      role: 'STUDENT',
      department: 'Computer Science and Engineering',
      graduationYear: '2026',
      bio: 'Final-year CS student specializing in distributed systems, full stack engineering, and cloud platforms.',
    },
    {
      name: 'Dr. Robert Vance',
      email: 'dr.vance@university.edu',
      password: facultyPwHash,
      role: 'FACULTY',
      department: 'Computer Science and Engineering',
      graduationYear: null,
      bio: 'Professor of Software Systems & Capstone Project Director.',
    },
    {
      name: 'Academic Placement Cell',
      email: 'admin@university.edu',
      password: adminPwHash,
      role: 'ADMIN',
      department: 'Institutional Academic Cell',
      graduationYear: null,
      bio: 'Institutional Placement & Curriculum Oversight Administrator.',
    },
    {
      name: 'Maya Patel',
      email: 'maya.patel@university.edu',
      password: studentPwHash,
      role: 'STUDENT',
      department: 'Data Science & Artificial Intelligence',
      graduationYear: '2026',
      bio: 'Machine Learning researcher with focus on predictive modeling and deep learning architectures.',
    },
    {
      name: 'Rohan Sharma',
      email: 'rohan.sharma@university.edu',
      password: studentPwHash,
      role: 'STUDENT',
      department: 'Information Technology',
      graduationYear: '2026',
      bio: 'DevOps & Cloud Engineer proficient in Kubernetes orchestration and automated CI/CD pipelines.',
    },
    {
      name: 'Sneha Kulkarni',
      email: 'sneha.kulkarni@university.edu',
      password: studentPwHash,
      role: 'STUDENT',
      department: 'Computer Science and Engineering',
      graduationYear: '2026',
      bio: 'Frontend Specialist focused on React, accessible design systems, and responsive web performance.',
    },
    {
      name: 'David Chen',
      email: 'david.chen@university.edu',
      password: studentPwHash,
      role: 'STUDENT',
      department: 'Computer Science and Engineering',
      graduationYear: '2026',
      bio: 'Enterprise Backend Engineer specialized in Java Spring Boot microservices and transactional databases.',
    },
  ];

  const userMap = new Map(); // email -> id

  for (const u of showcaseUsers) {
    const existing = await query('SELECT id FROM "User" WHERE email = $1', [u.email]);
    let userId;
    if (existing.rowCount > 0) {
      userId = existing.rows[0].id;
      await query(
        `UPDATE "User" SET name = $1, password = $2, role = $3, department = $4, "graduationYear" = $5, bio = $6 WHERE id = $7`,
        [u.name, u.password, u.role, u.department, u.graduationYear, u.bio, userId]
      );
      console.log(`  🔄 Updated User: ${u.name} (${u.email}) [Role: ${u.role}]`);
    } else {
      userId = randomUUID();
      await query(
        `INSERT INTO "User" (id, name, email, password, role, department, "graduationYear", bio, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [userId, u.name, u.email, u.password, u.role, u.department, u.graduationYear, u.bio]
      );
      console.log(`  ✨ Created User: ${u.name} (${u.email}) [Role: ${u.role}]`);
    }
    userMap.set(u.email, userId);
  }

  // Also map existing real users if any
  const allUsersRes = await query('SELECT id, email FROM "User"');
  for (const r of allUsersRes.rows) {
    userMap.set(r.email, r.id);
  }

  // 4. Fetch Master Skills Map
  const skillsRes = await query('SELECT id, name FROM "Skill"');
  const skillMap = new Map(); // name.toLowerCase() -> id
  for (const s of skillsRes.rows) {
    skillMap.set(s.name.toLowerCase().trim(), s.id);
  }

  const alexId = userMap.get('alex.rivera@university.edu');
  const vanceId = userMap.get('dr.vance@university.edu');

  // Helper to ensure a project with columns, tasks, and project skills
  async function createShowcaseProject({ title, description, status, skills, columnsData }) {
    // Check if project already exists for Alex
    const existing = await query('SELECT id FROM "Project" WHERE title = $1 AND "createdById" = $2', [title, alexId]);
    let pId;
    if (existing.rowCount > 0) {
      pId = existing.rows[0].id;
      console.log(`  🔄 Project already exists: "${title}" (${pId})`);
    } else {
      pId = randomUUID();
      await query(
        `INSERT INTO "Project" (id, title, description, status, "createdById", "assignedFacultyId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [pId, title, description, status, alexId, vanceId]
      );
      console.log(`  ✨ Created Project: "${title}" (${pId})`);

      // Add to ProjectStudent & ProjectFaculty
      await query(
        `INSERT INTO "ProjectStudent" (id, "projectId", "studentId", "createdAt") VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
        [randomUUID(), pId, alexId]
      );
      await query(
        `INSERT INTO "ProjectFaculty" (id, "projectId", "facultyId", "createdAt") VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
        [randomUUID(), pId, vanceId]
      );

      // Create Kanban Columns and Tasks
      let totalTasks = 0;
      for (let cIdx = 0; cIdx < columnsData.length; cIdx++) {
        const col = columnsData[cIdx];
        const colId = randomUUID();
        await query(
          `INSERT INTO "Column" (id, "projectId", title, "colorClass", "order", "createdAt")
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [colId, pId, col.title, col.colorClass, cIdx]
        );

        for (let tIdx = 0; tIdx < col.tasks.length; tIdx++) {
          const t = col.tasks[tIdx];
          const taskId = randomUUID();
          await query(
            `INSERT INTO "Task" (id, "columnId", title, description, priority, "order", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [taskId, colId, t.title, t.description || null, t.priority || 'MEDIUM', tIdx]
          );
          totalTasks++;
        }
      }
      await query(`UPDATE "Project" SET "tasksCount" = $1, "membersCount" = 2 WHERE id = $2`, [totalTasks, pId]);
    }

    // Attach Project Skills
    for (const skillName of skills) {
      const sId = skillMap.get(skillName.toLowerCase().trim());
      if (sId) {
        await query(
          `INSERT INTO "ProjectSkill" (id, "projectId", "skillId", "createdAt")
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT ("projectId", "skillId") DO NOTHING`,
          [randomUUID(), pId, sId]
        );
      }
    }

    return pId;
  }

  // 5. Create Alex's 3 Showcase Projects
  console.log('\n📁 4. Creating Alex Rivera\'s Showcase Projects...');

  // Project 1
  const proj1Id = await createShowcaseProject({
    title: 'Distributed Cloud Task Scheduler',
    description: 'High-throughput fault-tolerant task queue and distributed execution engine with real-time telemetry, Redis locking, and worker auto-scaling.',
    status: 'COMPLETED',
    skills: ['Docker', 'PostgreSQL', 'React', 'TypeScript', 'Node.js'],
    columnsData: [
      {
        title: 'To Do',
        colorClass: 'todo',
        tasks: [
          { title: 'Evaluate Raft Consensus for Multi-Cluster State', priority: 'LOW' },
        ],
      },
      {
        title: 'In Progress',
        colorClass: 'in-progress',
        tasks: [
          { title: 'Fine-tune Worker Heartbeat Timeout Calibration', priority: 'MEDIUM' },
        ],
      },
      {
        title: 'In Review',
        colorClass: 'in-review',
        tasks: [
          { title: 'Stress Test PostgreSQL Transaction Retries under High Concurrency', priority: 'HIGH' },
        ],
      },
      {
        title: 'Completed',
        colorClass: 'completed',
        tasks: [
          { title: 'Implement Redis Distributed Lock for Task Workers', priority: 'HIGH' },
          { title: 'Design Scalable PostgreSQL Partitioning for Audit Logs', priority: 'MEDIUM' },
          { title: 'Dockerize Microservices Architecture with Multi-Stage Builds', priority: 'HIGH' },
          { title: 'Configure Prometheus Metrics & Grafana Health Dashboard', priority: 'MEDIUM' },
          { title: 'Setup GitHub Actions CI/CD Pipeline for Automated Testing', priority: 'HIGH' },
        ],
      },
    ],
  });

  // Project 2
  const proj2Id = await createShowcaseProject({
    title: 'AI-Powered Placement Analytics Platform',
    description: 'Institutional predictive model analyzing student skill graphs and course performance to forecast job placement readiness and identify curriculum skill shortages.',
    status: 'COMPLETED',
    skills: ['Python', 'FastAPI', 'React', 'REST API Design'],
    columnsData: [
      {
        title: 'To Do',
        colorClass: 'todo',
        tasks: [
          { title: 'Explore Graph Neural Networks for Skill Trajectory', priority: 'LOW' },
        ],
      },
      {
        title: 'In Progress',
        colorClass: 'in-progress',
        tasks: [
          { title: 'Export Automated Placement Intelligence PDF Dossiers', priority: 'MEDIUM' },
        ],
      },
      {
        title: 'In Review',
        colorClass: 'in-review',
        tasks: [
          { title: 'Verify CORS & Rate Limiting on Prediction Ingestion API', priority: 'HIGH' },
        ],
      },
      {
        title: 'Completed',
        colorClass: 'completed',
        tasks: [
          { title: 'Train Scikit-Learn Model for Student Job Fit Scoring', priority: 'HIGH' },
          { title: 'Develop FastAPI Endpoints for Prediction Inference', priority: 'HIGH' },
          { title: 'Build Responsive React Dashboard with Chart Visualizations', priority: 'MEDIUM' },
          { title: 'Enforce JWT Role-Based Authorization Guards', priority: 'HIGH' },
        ],
      },
    ],
  });

  // Project 3 (Active / In Progress for Live Demo)
  const proj3Id = await createShowcaseProject({
    title: 'IoT Smart Campus Telemetry Hub',
    description: 'Campus-wide sensor ingestion network monitoring lab energy utilization, temperature thresholds, and server room airflow with real-time anomaly alerts.',
    status: 'ACTIVE',
    skills: ['Tailwind CSS', 'Linux'],
    columnsData: [
      {
        title: 'To Do',
        colorClass: 'todo',
        tasks: [
          { title: 'Setup Edge Gateway Data Buffering for Offline Resilience', priority: 'MEDIUM' },
          { title: 'Calibrate Acoustic Sensor Thresholds', priority: 'LOW' },
        ],
      },
      {
        title: 'In Progress',
        colorClass: 'in-progress',
        tasks: [
          { title: 'Construct Tailwind UI for Environmental Sensor Stream', priority: 'MEDIUM' },
          { title: 'Integrate MQTT Ingestion Bridge with Node Gateway', priority: 'HIGH' },
        ],
      },
      {
        title: 'In Review',
        colorClass: 'in-review',
        tasks: [
          { title: 'Review Embedded Linux Daemon Service Daemonization', priority: 'HIGH' },
        ],
      },
      {
        title: 'Completed',
        colorClass: 'completed',
        tasks: [
          { title: 'Configure Microcontroller Hardware Interface', priority: 'LOW' },
        ],
      },
    ],
  });

  // 6. Seed Student Skills & Evidence
  console.log('\n🌟 5. Seeding Student Verified Skills & Claims...');

  async function addStudentSkill({ studentEmail, skillName, level, verification, verifiedByEmail, feedback, projectId }) {
    const sId = userMap.get(studentEmail);
    const skId = skillMap.get(skillName.toLowerCase().trim());
    if (!sId || !skId) {
      console.warn(`  ⚠️ Missing student (${studentEmail}) or skill (${skillName})`);
      return;
    }
    const verifierId = verifiedByEmail ? userMap.get(verifiedByEmail) : null;
    const verifiedAt = verification === 'VERIFIED' ? 'NOW()' : null;

    // Check existing
    const existing = await query(
      'SELECT id FROM "StudentSkill" WHERE "studentId" = $1 AND "skillId" = $2',
      [sId, skId]
    );

    let ssId;
    if (existing.rowCount > 0) {
      ssId = existing.rows[0].id;
      await query(
        `UPDATE "StudentSkill"
         SET level = $1, verification = $2, "verifiedById" = $3, "verifiedAt" = ${verifiedAt ? 'NOW()' : 'NULL'}, feedback = $4
         WHERE id = $5`,
        [level, verification, verifierId, feedback || null, ssId]
      );
    } else {
      ssId = randomUUID();
      await query(
        `INSERT INTO "StudentSkill" (id, "studentId", "skillId", level, verification, "verifiedById", "verifiedAt", feedback, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, ${verifiedAt ? 'NOW()' : 'NULL'}, $7, NOW(), NOW())`,
        [ssId, sId, skId, level, verification, verifierId, feedback || null]
      );
    }

    if (projectId) {
      await query(
        `INSERT INTO "StudentSkillEvidence" (id, "studentSkillId", "projectId", "createdAt")
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT ("studentSkillId", "projectId") DO NOTHING`,
        [randomUUID(), ssId, projectId]
      );
    }
  }

  // Alex Rivera's Skills (Verified from Proj 1 & 2, Pending from Proj 3)
  const alexSkills = [
    { skill: 'Docker', level: 'ADVANCED', status: 'VERIFIED', feedback: 'Exceptional multi-stage Docker build and container orchestration.', proj: proj1Id },
    { skill: 'PostgreSQL', level: 'ADVANCED', status: 'VERIFIED', feedback: 'Demonstrated solid schema normalization and indexing strategies.', proj: proj1Id },
    { skill: 'React', level: 'ADVANCED', status: 'VERIFIED', feedback: 'Clean component architecture and state management hooks.', proj: proj1Id },
    { skill: 'TypeScript', level: 'INTERMEDIATE', status: 'VERIFIED', feedback: 'Strict typing and clean interface segregation across the board.', proj: proj1Id },
    { skill: 'Node.js', level: 'ADVANCED', status: 'VERIFIED', feedback: 'High-throughput asynchronous event handling verified during testing.', proj: proj1Id },
    { skill: 'Python', level: 'ADVANCED', status: 'VERIFIED', feedback: 'Excellent code modularity and predictive pipeline design.', proj: proj2Id },
    { skill: 'FastAPI', level: 'INTERMEDIATE', status: 'VERIFIED', feedback: 'Clean asynchronous endpoint handling and OpenAPI documentation.', proj: proj2Id },
    { skill: 'REST API Design', level: 'ADVANCED', status: 'VERIFIED', feedback: 'Standardized HTTP status codes, robust DTO validations.', proj: proj2Id },
    // PENDING claims for live demo!
    { skill: 'Tailwind CSS', level: 'INTERMEDIATE', status: 'PENDING', feedback: null, proj: proj3Id },
    { skill: 'Linux', level: 'INTERMEDIATE', status: 'PENDING', feedback: null, proj: proj3Id },
  ];

  for (const s of alexSkills) {
    await addStudentSkill({
      studentEmail: 'alex.rivera@university.edu',
      skillName: s.skill,
      level: s.level,
      verification: s.status,
      verifiedByEmail: s.status === 'VERIFIED' ? 'dr.vance@university.edu' : null,
      feedback: s.feedback,
      projectId: s.proj,
    });
  }
  console.log(`  ✅ Added ${alexSkills.length} skills for Alex Rivera (8 Verified, 2 Pending for Live Demo)`);

  // Peer 1: Maya Patel (AI & ML Specialist)
  const mayaSkills = [
    'Python', 'PyTorch', 'Pandas', 'Scikit-Learn', 'SQL', 'Machine Learning', 'Deep Learning', 'NumPy'
  ];
  for (const sk of mayaSkills) {
    await addStudentSkill({
      studentEmail: 'maya.patel@university.edu',
      skillName: sk,
      level: 'ADVANCED',
      verification: 'VERIFIED',
      verifiedByEmail: 'dr.vance@university.edu',
      feedback: 'Verified through AI Capstone research on deep learning architectures.',
    });
  }
  console.log(`  ✅ Added ${mayaSkills.length} AI/ML skills for Maya Patel`);

  // Peer 2: Rohan Sharma (Cloud & DevOps Specialist)
  const rohanSkills = [
    'Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux', 'Git', 'GitHub', 'PostgreSQL'
  ];
  for (const sk of rohanSkills) {
    await addStudentSkill({
      studentEmail: 'rohan.sharma@university.edu',
      skillName: sk,
      level: 'ADVANCED',
      verification: 'VERIFIED',
      verifiedByEmail: 'dr.vance@university.edu',
      feedback: 'Automated cluster deployments and CI/CD pipelines verified in cloud lab.',
    });
  }
  console.log(`  ✅ Added ${rohanSkills.length} Cloud/DevOps skills for Rohan Sharma`);

  // Peer 3: Sneha Kulkarni (Frontend & UI Specialist)
  const snehaSkills = [
    'React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'HTML5', 'CSS3', 'UI/UX Design', 'Redux'
  ];
  for (const sk of snehaSkills) {
    await addStudentSkill({
      studentEmail: 'sneha.kulkarni@university.edu',
      skillName: sk,
      level: 'ADVANCED',
      verification: 'VERIFIED',
      verifiedByEmail: 'dr.vance@university.edu',
      feedback: 'Designed accessible responsive frontends with near-perfect lighthouse scores.',
    });
  }
  console.log(`  ✅ Added ${snehaSkills.length} Frontend skills for Sneha Kulkarni`);

  // Peer 4: David Chen (Enterprise Backend)
  const davidSkills = [
    'Java', 'Spring Boot', 'PostgreSQL', 'Microservices', 'Docker', 'REST API Design', 'Automated Testing'
  ];
  for (const sk of davidSkills) {
    await addStudentSkill({
      studentEmail: 'david.chen@university.edu',
      skillName: sk,
      level: 'ADVANCED',
      verification: 'VERIFIED',
      verifiedByEmail: 'dr.vance@university.edu',
      feedback: 'High-availability Spring Boot microservice architecture verified.',
    });
  }
  console.log(`  ✅ Added ${davidSkills.length} Enterprise Backend skills for David Chen`);

  console.log('\n🎉 CLEAN & SEED SHOWCASE COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('❌ Error during clean and seed:', err);
  process.exit(1);
});
