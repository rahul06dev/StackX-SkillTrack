/**
 * Rule-Based Mapping Engine (R ⊆ T × S)
 * 
 * Maps student/faculty submitted technologies (T) and project context
 * to competency skills (S) in the managed skill catalogue.
 */

export interface MappingResult {
  skillId: string;
  skillName: string;
  category?: string | null;
  ruleMatched?: string;
  matchType: 'direct_tech' | 'rule_mapping' | 'keyword_match';
}

/**
 * Technology-to-Skill Knowledge Base (R ⊆ T × S)
 * Normalized technology keys map to competency skill names or concepts.
 */
export const TECHNOLOGY_TO_SKILL_RULES: Record<string, string[]> = {
  // Frontend Web Technologies
  react: ['React', 'React.js', 'Frontend Development', 'Web Development', 'JavaScript'],
  'react.js': ['React', 'React.js', 'Frontend Development', 'Web Development', 'JavaScript'],
  'react native': ['React Native', 'Mobile App Development', 'Cross-Platform Development'],
  vue: ['Vue', 'Vue.js', 'Frontend Development', 'Web Development', 'JavaScript'],
  'vue.js': ['Vue', 'Vue.js', 'Frontend Development', 'Web Development'],
  angular: ['Angular', 'Frontend Development', 'TypeScript', 'Web Development'],
  nextjs: ['Next.js', 'React', 'Frontend Development', 'Full Stack Development', 'Web Development'],
  'next.js': ['Next.js', 'React', 'Frontend Development', 'Full Stack Development', 'Web Development'],
  svelte: ['Svelte', 'Frontend Development', 'Web Development'],
  html: ['HTML', 'HTML5', 'Web Development', 'Frontend Development'],
  html5: ['HTML', 'HTML5', 'Web Development', 'Frontend Development'],
  css: ['CSS', 'CSS3', 'Web Development', 'Frontend Development'],
  css3: ['CSS', 'CSS3', 'Web Development', 'Frontend Development'],
  tailwind: ['Tailwind CSS', 'CSS', 'Frontend Development', 'UI/UX Design'],
  'tailwind css': ['Tailwind CSS', 'CSS', 'Frontend Development'],
  bootstrap: ['Bootstrap', 'CSS', 'Frontend Development', 'Responsive Design'],
  redux: ['Redux', 'State Management', 'React', 'Frontend Development'],

  // Programming Languages
  typescript: ['TypeScript', 'JavaScript', 'Frontend Development', 'Backend Development'],
  javascript: ['JavaScript', 'Web Development', 'Frontend Development'],
  python: ['Python', 'Backend Development', 'Data Analysis', 'Scripting'],
  java: ['Java', 'Object-Oriented Programming', 'Backend Development'],
  'c++': ['C++', 'Object-Oriented Programming', 'Systems Programming'],
  cpp: ['C++', 'Object-Oriented Programming', 'Systems Programming'],
  csharp: ['C#', '.NET', 'Backend Development'],
  'c#': ['C#', '.NET', 'Backend Development'],
  golang: ['Go', 'Golang', 'Backend Development', 'Distributed Systems'],
  go: ['Go', 'Golang', 'Backend Development'],
  rust: ['Rust', 'Systems Programming', 'Memory Safety'],
  php: ['PHP', 'Backend Development', 'Web Development'],
  ruby: ['Ruby', 'Ruby on Rails', 'Backend Development'],

  // Backend Frameworks & Runtimes
  nodejs: ['Node.js', 'Backend Development', 'JavaScript', 'REST API Design'],
  'node.js': ['Node.js', 'Backend Development', 'JavaScript', 'REST API Design'],
  express: ['Express.js', 'Node.js', 'Backend Development', 'REST API Design'],
  'express.js': ['Express.js', 'Node.js', 'Backend Development', 'REST API Design'],
  django: ['Django', 'Python', 'Backend Development', 'Web Development'],
  flask: ['Flask', 'Python', 'Backend Development', 'REST API Design'],
  fastapi: ['FastAPI', 'Python', 'REST API Design', 'Backend Development'],
  'spring boot': ['Spring Boot', 'Java', 'Backend Development', 'Microservices'],
  spring: ['Spring Boot', 'Java', 'Backend Development'],
  nestjs: ['NestJS', 'TypeScript', 'Node.js', 'Backend Development'],
  rails: ['Ruby on Rails', 'Backend Development'],

  // Databases & ORMs
  postgresql: ['PostgreSQL', 'SQL', 'Database Management', 'Relational Databases'],
  postgres: ['PostgreSQL', 'SQL', 'Database Management', 'Relational Databases'],
  mysql: ['MySQL', 'SQL', 'Database Management', 'Relational Databases'],
  mongodb: ['MongoDB', 'NoSQL', 'Database Management'],
  mongo: ['MongoDB', 'NoSQL', 'Database Management'],
  sqlite: ['SQLite', 'SQL', 'Database Management'],
  redis: ['Redis', 'Caching', 'Database Management', 'NoSQL'],
  prisma: ['Prisma', 'ORM', 'Database Management', 'TypeScript'],
  sequelize: ['Sequelize', 'ORM', 'Database Management'],
  firebase: ['Firebase', 'Cloud Computing', 'NoSQL', 'Backend as a Service'],
  supabase: ['Supabase', 'PostgreSQL', 'Backend as a Service', 'Database Management'],

  // DevOps, Cloud & Tools
  docker: ['Docker', 'DevOps', 'Containerization', 'Microservices'],
  kubernetes: ['Kubernetes', 'DevOps', 'Container Orchestration', 'Cloud Computing'],
  k8s: ['Kubernetes', 'DevOps', 'Container Orchestration'],
  aws: ['AWS', 'Cloud Computing', 'DevOps', 'Serverless'],
  azure: ['Azure', 'Cloud Computing', 'DevOps'],
  gcp: ['Google Cloud', 'Cloud Computing', 'DevOps'],
  git: ['Git', 'Version Control', 'Agile Collaboration'],
  github: ['Git', 'GitHub', 'Version Control', 'CI/CD'],
  cicd: ['CI/CD', 'DevOps', 'Continuous Integration', 'Automated Testing'],
  'ci/cd': ['CI/CD', 'DevOps', 'Continuous Integration'],
  linux: ['Linux', 'System Administration', 'Shell Scripting'],

  // AI, Machine Learning & Data Science
  tensorflow: ['TensorFlow', 'Machine Learning', 'Deep Learning', 'Artificial Intelligence'],
  pytorch: ['PyTorch', 'Machine Learning', 'Deep Learning', 'Artificial Intelligence'],
  keras: ['Keras', 'Deep Learning', 'Machine Learning'],
  'scikit-learn': ['Scikit-Learn', 'Machine Learning', 'Data Science'],
  pandas: ['Pandas', 'Data Analysis', 'Python', 'Data Science'],
  numpy: ['NumPy', 'Data Analysis', 'Python', 'Numerical Computing'],
  opencv: ['OpenCV', 'Computer Vision', 'Artificial Intelligence'],
  nlp: ['Natural Language Processing', 'Machine Learning', 'Artificial Intelligence'],

  // Testing & Quality Assurance
  jest: ['Jest', 'Software Testing', 'Unit Testing', 'Quality Assurance'],
  cypress: ['Cypress', 'End-to-End Testing', 'Software Testing', 'Quality Assurance'],
  junit: ['JUnit', 'Java', 'Unit Testing', 'Software Testing'],
  mocha: ['Mocha', 'Software Testing', 'JavaScript'],
  selenium: ['Selenium', 'Test Automation', 'Software Testing'],

  // Mobile
  flutter: ['Flutter', 'Dart', 'Mobile App Development', 'Cross-Platform Development'],
  dart: ['Dart', 'Flutter', 'Mobile App Development'],
  swift: ['Swift', 'iOS Development', 'Mobile App Development'],
  kotlin: ['Kotlin', 'Android Development', 'Mobile App Development'],

  // Security & Architecture
  jwt: ['JWT', 'Web Security', 'Authentication', 'API Security'],
  oauth: ['OAuth', 'Authentication', 'Web Security'],
  graphql: ['GraphQL', 'API Design', 'Backend Development'],
  rest: ['REST API Design', 'Backend Development', 'Web Services'],
  microservices: ['Microservices', 'System Architecture', 'Backend Development'],
};

/**
 * Execute the rule engine to map technologies and project text
 * to active catalogue skills.
 */
export function executeRuleEngine(
  technologies: string[],
  projectText: string,
  catalogSkills: Array<{ id: string; name: string; category?: string | null }>
): MappingResult[] {
  const matchedSkillMap = new Map<string, MappingResult>();

  // 1. Normalize submitted technologies
  const cleanTechs = technologies
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  // Helper to test if a skill matches by name (case-insensitive)
  const findSkillByName = (targetName: string) => {
    const cleanTarget = targetName.trim().toLowerCase();
    return catalogSkills.find(
      (s) => s.name.trim().toLowerCase() === cleanTarget
    );
  };

  // 2. Rule-Based Mapping (R ⊆ T × S)
  for (const tech of cleanTechs) {
    // Check if tech directly matches a catalogue skill
    const directMatch = findSkillByName(tech);
    if (directMatch && !matchedSkillMap.has(directMatch.id)) {
      matchedSkillMap.set(directMatch.id, {
        skillId: directMatch.id,
        skillName: directMatch.name,
        category: directMatch.category,
        ruleMatched: `Direct: ${tech}`,
        matchType: 'direct_tech',
      });
    }

    // Check knowledge-base rule mapping
    const mappedSkills = TECHNOLOGY_TO_SKILL_RULES[tech];
    if (mappedSkills && Array.isArray(mappedSkills)) {
      for (const targetSkillName of mappedSkills) {
        const found = findSkillByName(targetSkillName);
        if (found && !matchedSkillMap.has(found.id)) {
          matchedSkillMap.set(found.id, {
            skillId: found.id,
            skillName: found.name,
            category: found.category,
            ruleMatched: `${tech} → ${targetSkillName}`,
            matchType: 'rule_mapping',
          });
        }
      }
    }
  }

  // 3. Keyword-Based Text Extraction from Project Title & Description
  const combinedText = `${projectText} ${technologies.join(' ')}`;
  for (const skill of catalogSkills) {
    if (matchedSkillMap.has(skill.id)) continue;

    const escapedName = skill.name
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');

    if (!escapedName) continue;

    const regex = new RegExp(`(^|[^a-zA-Z0-9])${escapedName}($|[^a-zA-Z0-9])`, 'i');
    if (regex.test(combinedText)) {
      matchedSkillMap.set(skill.id, {
        skillId: skill.id,
        skillName: skill.name,
        category: skill.category,
        ruleMatched: `Context Regex: "${skill.name}"`,
        matchType: 'keyword_match',
      });
    }
  }

  return Array.from(matchedSkillMap.values());
}

