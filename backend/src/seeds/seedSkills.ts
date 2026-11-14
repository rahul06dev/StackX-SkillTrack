import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

export interface SkillSeedData {
  name: string;
  category: string;
  description: string;
}

export const INITIAL_SKILLS: SkillSeedData[] = [
  // ─── Frontend Development ─────────────────────────────────────────
  { name: 'React', category: 'Frontend Development', description: 'Component-based UI library for modern web applications.' },
  { name: 'Vue.js', category: 'Frontend Development', description: 'Progressive JavaScript framework for building user interfaces.' },
  { name: 'Angular', category: 'Frontend Development', description: 'Platform and framework for building single-page client applications.' },
  { name: 'Next.js', category: 'Frontend Development', description: 'React framework for server-rendered and static web applications.' },
  { name: 'Svelte', category: 'Frontend Development', description: 'Compiler-based modern reactive web framework.' },
  { name: 'TypeScript', category: 'Frontend Development', description: 'Typed superset of JavaScript that compiles to plain JavaScript.' },
  { name: 'JavaScript', category: 'Frontend Development', description: 'Core scripting language of the modern web platform.' },
  { name: 'HTML5', category: 'Frontend Development', description: 'Semantic markup standard for web structuring and accessibility.' },
  { name: 'CSS3', category: 'Frontend Development', description: 'Modern stylesheets including Flexbox, CSS Grid, and animations.' },
  { name: 'Tailwind CSS', category: 'Frontend Development', description: 'Utility-first CSS framework for rapid responsive UI development.' },
  { name: 'Redux', category: 'Frontend Development', description: 'Predictable state container for JavaScript and React applications.' },
  { name: 'UI/UX Design', category: 'Frontend Development', description: 'User interface design, wireframing, and user experience workflows.' },

  // ─── Backend Development ──────────────────────────────────────────
  { name: 'Node.js', category: 'Backend Development', description: 'Asynchronous event-driven JavaScript runtime for scalable backend services.' },
  { name: 'Express.js', category: 'Backend Development', description: 'Fast, unopinionated, minimalist web framework for Node.js.' },
  { name: 'NestJS', category: 'Backend Development', description: 'Progressive Node.js framework for scalable enterprise architectures.' },
  { name: 'Python', category: 'Backend Development', description: 'High-level general-purpose programming language for backend and automation.' },
  { name: 'Django', category: 'Backend Development', description: 'High-level Python web framework encouraging clean, rapid development.' },
  { name: 'FastAPI', category: 'Backend Development', description: 'Modern, fast web framework for building APIs with Python 3.8+.' },
  { name: 'Flask', category: 'Backend Development', description: 'Lightweight WSGI Python micro-web framework.' },
  { name: 'Java', category: 'Backend Development', description: 'Object-oriented programming language for enterprise software and distributed systems.' },
  { name: 'Spring Boot', category: 'Backend Development', description: 'Framework for creating stand-alone, production-grade Spring applications.' },
  { name: 'C++', category: 'Backend Development', description: 'High-performance systems programming language with OOP and low-level control.' },
  { name: 'C#', category: 'Backend Development', description: 'Modern object-oriented language developed by Microsoft for the .NET platform.' },
  { name: 'Go', category: 'Backend Development', description: 'Statically typed, compiled language engineered by Google for scalable concurrency.' },
  { name: 'Rust', category: 'Backend Development', description: 'Systems programming language focusing on memory safety without garbage collection.' },
  { name: 'REST API Design', category: 'Backend Development', description: 'Architectural style for designing networked web services and endpoints.' },
  { name: 'GraphQL', category: 'Backend Development', description: 'Query language for APIs and runtime for fulfilling queries with existing data.' },
  { name: 'Microservices', category: 'Backend Development', description: 'Architectural pattern arranging applications as collections of loosely coupled services.' },

  // ─── Databases & Storage ──────────────────────────────────────────
  { name: 'PostgreSQL', category: 'Database Management', description: 'Advanced open-source relational database supporting ACID and JSON.' },
  { name: 'MySQL', category: 'Database Management', description: 'Widely deployed open-source relational database management system.' },
  { name: 'MongoDB', category: 'Database Management', description: 'Document-oriented NoSQL database for flexible JSON-like document storage.' },
  { name: 'Redis', category: 'Database Management', description: 'In-memory data structure store used as a cache, broker, and fast database.' },
  { name: 'SQLite', category: 'Database Management', description: 'Lightweight self-contained, serverless, zero-configuration SQL database engine.' },
  { name: 'Prisma ORM', category: 'Database Management', description: 'Next-generation TypeScript and Node.js Object-Relational Mapping toolkit.' },
  { name: 'SQL', category: 'Database Management', description: 'Standard language for storing, manipulating, and retrieving relational data.' },
  { name: 'NoSQL', category: 'Database Management', description: 'Non-relational database design concepts for document, key-value, and graph stores.' },
  { name: 'Supabase', category: 'Database Management', description: 'Open source Firebase alternative providing Postgres, Auth, and Realtime APIs.' },
  { name: 'Firebase', category: 'Database Management', description: 'Cloud-hosted backend platform providing NoSQL Firestore and realtime services.' },

  // ─── Cloud & DevOps ───────────────────────────────────────────────
  { name: 'Docker', category: 'Cloud & DevOps', description: 'Platform for developing, shipping, and running containerized applications.' },
  { name: 'Kubernetes', category: 'Cloud & DevOps', description: 'Automated container orchestration, scaling, and operational management.' },
  { name: 'AWS', category: 'Cloud & DevOps', description: 'Amazon Web Services cloud computing infrastructure and serverless services.' },
  { name: 'Google Cloud', category: 'Cloud & DevOps', description: 'Google Cloud Platform suite of cloud computing, storage, and AI services.' },
  { name: 'Azure', category: 'Cloud & DevOps', description: 'Microsoft cloud computing platform for building and managing applications.' },
  { name: 'CI/CD', category: 'Cloud & DevOps', description: 'Continuous integration and continuous deployment automation pipelines.' },
  { name: 'Git', category: 'Cloud & DevOps', description: 'Distributed version control system for tracking changes in source code.' },
  { name: 'GitHub', category: 'Cloud & DevOps', description: 'Developer platform for version control, collaboration, code review, and Actions.' },
  { name: 'Linux', category: 'Cloud & DevOps', description: 'Unix-like operating system environment, terminal commands, and system administration.' },

  // ─── Artificial Intelligence & Machine Learning ───────────────────
  { name: 'Machine Learning', category: 'AI & Data Science', description: 'Algorithms and statistical models that learn from data to make predictions.' },
  { name: 'Deep Learning', category: 'AI & Data Science', description: 'Multi-layer neural network architectures for complex pattern recognition.' },
  { name: 'TensorFlow', category: 'AI & Data Science', description: 'End-to-end open source platform for machine learning and neural networks.' },
  { name: 'PyTorch', category: 'AI & Data Science', description: 'Dynamic deep learning framework widely used in research and production AI.' },
  { name: 'Scikit-Learn', category: 'AI & Data Science', description: 'Python module for classical machine learning and data mining.' },
  { name: 'Pandas', category: 'AI & Data Science', description: 'Fast, powerful, flexible open source data analysis and manipulation library.' },
  { name: 'NumPy', category: 'AI & Data Science', description: 'Fundamental package for scientific computing with multi-dimensional arrays in Python.' },
  { name: 'Natural Language Processing', category: 'AI & Data Science', description: 'Computational techniques for analyzing, understanding, and generating human language.' },
  { name: 'Computer Vision', category: 'AI & Data Science', description: 'Algorithms and techniques for extracting meaningful information from images and video.' },

  // ─── Mobile App Development ───────────────────────────────────────
  { name: 'React Native', category: 'Mobile Development', description: 'Cross-platform mobile framework using React and native platform UI elements.' },
  { name: 'Flutter', category: 'Mobile Development', description: 'Google open-source framework for multi-platform applications from a single codebase.' },
  { name: 'Android Development', category: 'Mobile Development', description: 'Native mobile engineering targeting the Android operating system with Kotlin/Java.' },
  { name: 'iOS Development', category: 'Mobile Development', description: 'Native mobile engineering targeting Apple iOS platforms using Swift.' },

  // ─── Software Engineering & Security ──────────────────────────────
  { name: 'Agile Kanban', category: 'Software Engineering', description: 'Iterative project management workflow for visualizing work and maximizing flow.' },
  { name: 'Automated Testing', category: 'Software Engineering', description: 'Unit testing, integration testing, and automated test runners (Jest, Vitest).' },
  { name: 'Cybersecurity', category: 'Cybersecurity', description: 'Principles and practices for protecting systems, networks, and data from attacks.' },
  { name: 'Web Security (OWASP)', category: 'Cybersecurity', description: 'Mitigation of OWASP Top 10 web vulnerabilities including XSS, CSRF, and Injection.' },
];

export async function seedSkills() {
  console.log(`🌱 Seeding ${INITIAL_SKILLS.length} standardized skills into database...`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const s of INITIAL_SKILLS) {
    try {
      const existing = await prisma.skill.findUnique({
        where: { name: s.name },
      });

      if (!existing) {
        await prisma.skill.create({
          data: {
            name: s.name,
            category: s.category,
            description: s.description,
            isActive: true,
          },
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    } catch (err) {
      console.error(`❌ Failed to seed skill "${s.name}":`, err);
    }
  }

  console.log(`✅ Seeding complete! Created: ${createdCount}, Already existed: ${skippedCount}, Total in catalogue: ${createdCount + skippedCount}`);
  await prisma.$disconnect();
}

// Run when executed directly
if (process.argv[1]?.endsWith('seedSkills.ts') || process.argv[1]?.endsWith('seedSkills.js')) {
  seedSkills().catch((err) => {
    console.error('Fatal seeding error:', err);
    process.exit(1);
  });
}
