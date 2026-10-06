import React from 'react';
import ProjectListItem from './ProjectListItem'; // Import the new component

interface Project {
  id: string;
  title: string;
  description: string;
  tasks: number;
  members: number;
}

interface ProjectListProps {
  projects: Project[];
}

const ProjectList: React.FC<ProjectListProps> = ({ projects }) => {
  return (
    <div className="main-content-card">
      <h2 className="text-xl font-bold mb-6">Your Projects</h2>
      {projects.length === 0 ? (
        <p className="text-gray-500">No projects yet. Create your first project!</p>
      ) : (
        <div className="space-y-4"> {/* Tailwind for vertical spacing */}
          {projects.map(project => (
            <ProjectListItem key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectList;