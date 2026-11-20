import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

export interface JobRoleSeedData {
  title: string;
  description: string;
  skillNames: string[];
}

export const INITIAL_JOB_ROLES: JobRoleSeedData[] = [
  {
    title: 'Full Stack Engineer',
    description:
      'Engineers modern responsive web applications across reactive frontend frameworks, scalable RESTful backend services, and relational/document databases.',
    skillNames: [
      'React',
      'TypeScript',
      'Node.js',
      'PostgreSQL',
      'REST API Design',
      'Docker',
      'Tailwind CSS',
      'Git',
    ],
  },
  {
    title: 'Frontend Engineer',
    description:
      'Specializes in building intuitive user interfaces, state management architectures, responsive web design systems, and client-side performance optimization.',
    skillNames: [
      'React',
      'TypeScript',
      'Next.js',
      'Tailwind CSS',
      'HTML5',
      'CSS3',
      'Redux',
      'UI/UX Design',
      'Git',
    ],
  },
  {
    title: 'Backend / API Engineer',
    description:
      'Designs, tests, and maintains scalable server-side microservices, database schemas, asynchronous workers, caching layers, and high-performance API endpoints.',
    skillNames: [
      'Node.js',
      'Express.js',
      'PostgreSQL',
      'Redis',
      'REST API Design',
      'Prisma ORM',
      'Docker',
      'Microservices',
      'Git',
    ],
  },
  {
    title: 'Python Backend Developer',
    description:
      'Develops clean, asynchronous backend services, RESTful APIs, and data processing automation pipelines using modern Python frameworks.',
    skillNames: [
      'Python',
      'FastAPI',
      'Django',
      'PostgreSQL',
      'Redis',
      'REST API Design',
      'Docker',
      'Automated Testing',
      'Git',
    ],
  },
  {
    title: 'Java / Enterprise Software Engineer',
    description:
      'Architects enterprise-grade distributed systems, robust Spring microservices, and transaction-safe relational database services.',
    skillNames: [
      'Java',
      'Spring Boot',
      'PostgreSQL',
      'MySQL',
      'REST API Design',
      'Microservices',
      'Docker',
      'Automated Testing',
      'Git',
    ],
  },
  {
    title: 'DevOps & Cloud Infrastructure Engineer',
    description:
      'Automates continuous integration and continuous delivery (CI/CD) pipelines, manages container orchestration, and enforces cloud infrastructure reliability.',
    skillNames: [
      'Docker',
      'Kubernetes',
      'AWS',
      'Linux',
      'CI/CD',
      'Git',
      'GitHub',
      'PostgreSQL',
    ],
  },
  {
    title: 'Machine Learning & AI Engineer',
    description:
      'Designs, trains, and operationalizes machine learning, deep learning, and natural language processing models for predictive software systems.',
    skillNames: [
      'Python',
      'Machine Learning',
      'Deep Learning',
      'PyTorch',
      'TensorFlow',
      'Scikit-Learn',
      'Pandas',
      'NumPy',
      'Git',
    ],
  },
  {
    title: 'Data Scientist & Analytics Engineer',
    description:
      'Explores structured and unstructured data, applies statistical modeling, executes feature engineering, and constructs production analytics pipelines.',
    skillNames: [
      'Python',
      'Pandas',
      'NumPy',
      'SQL',
      'PostgreSQL',
      'Machine Learning',
      'Scikit-Learn',
      'Git',
    ],
  },
  {
    title: 'Mobile App Developer',
    description:
      'Builds, tests, and ships native and cross-platform mobile applications with high performance, smooth animations, and offline-first capabilities.',
    skillNames: [
      'React Native',
      'Flutter',
      'TypeScript',
      'JavaScript',
      'REST API Design',
      'Android Development',
      'iOS Development',
      'Git',
    ],
  },
  {
    title: 'Application Security Engineer',
    description:
      'Secures software architectures, implements OWASP Top 10 mitigation strategies, conducts security reviews, and ensures robust API authentication.',
    skillNames: [
      'Cybersecurity',
      'Web Security (OWASP)',
      'Linux',
      'REST API Design',
      'Automated Testing',
      'Git',
      'Node.js',
    ],
  },
  {
    title: 'QA & Test Automation Engineer',
    description:
      'Develops automated testing frameworks, end-to-end regression suites, and integrates automated quality gates into CI/CD pipelines.',
    skillNames: [
      'Automated Testing',
      'TypeScript',
      'JavaScript',
      'Python',
      'CI/CD',
      'Git',
      'Agile Kanban',
    ],
  },
  {
    title: 'Cloud Solutions Architect',
    description:
      'Evaluates business requirements to architect resilient, scalable cloud systems, serverless architectures, and distributed microservices.',
    skillNames: [
      'AWS',
      'Google Cloud',
      'Docker',
      'Kubernetes',
      'Microservices',
      'Linux',
      'PostgreSQL',
      'CI/CD',
    ],
  },
];

export async function seedJobRoles() {
  console.log(`🌱 Seeding ${INITIAL_JOB_ROLES.length} industry job roles into the database...`);

  // Fetch all existing skills from DB to map by name (case-insensitive)
  const allSkills = await prisma.skill.findMany();
  const skillMap = new Map<string, string>();
  for (const s of allSkills) {
    skillMap.set(s.name.toLowerCase().trim(), s.id);
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const roleData of INITIAL_JOB_ROLES) {
    // Resolve matching skill IDs
    const matchedSkillIds: string[] = [];
    for (const skillName of roleData.skillNames) {
      const skillId = skillMap.get(skillName.toLowerCase().trim());
      if (skillId) {
        matchedSkillIds.push(skillId);
      } else {
        console.warn(`  ⚠️ Skill "${skillName}" not found in database for role "${roleData.title}". Skipping skill.`);
      }
    }

    // Check if role exists
    const existing = await prisma.jobRole.findUnique({
      where: { title: roleData.title },
    });

    if (existing) {
      // Update description and re-link skills
      await prisma.jobRole.update({
        where: { id: existing.id },
        data: {
          description: roleData.description,
          isActive: true,
        },
      });

      // Clear existing skill links and recreate with current set
      await prisma.jobRoleSkill.deleteMany({
        where: { jobRoleId: existing.id },
      });

      if (matchedSkillIds.length > 0) {
        await prisma.jobRoleSkill.createMany({
          data: matchedSkillIds.map((sId) => ({
            jobRoleId: existing.id,
            skillId: sId,
          })),
        });
      }

      updatedCount++;
      console.log(`  🔄 Updated: "${roleData.title}" (${matchedSkillIds.length} skills linked)`);
    } else {
      // Create new job role with skills
      await prisma.jobRole.create({
        data: {
          title: roleData.title,
          description: roleData.description,
          isActive: true,
          requiredSkills: {
            create: matchedSkillIds.map((sId) => ({
              skill: { connect: { id: sId } },
            })),
          },
        },
      });

      createdCount++;
      console.log(`  ✨ Created: "${roleData.title}" (${matchedSkillIds.length} skills linked)`);
    }
  }

  console.log(`\n✅ Finished seeding job roles: ${createdCount} created, ${updatedCount} updated.`);
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seedJobRoles.ts') || process.argv[1]?.endsWith('seedJobRoles.js')) {
  seedJobRoles()
    .catch((err) => {
      console.error('❌ Error seeding job roles:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
