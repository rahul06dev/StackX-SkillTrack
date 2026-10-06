// frontend/components/ProjectListItem.tsx

import React from 'react';
import { Link } from 'react-router-dom'; // ⚠️ Import Link
// Import the custom CSS for these elements

interface Project {
  id: string; // Must have ID for the link
  title: string;
  description: string;
  tasks: number;
  members: number;
}

interface ProjectListItemProps {
  project: Project;
  // NEW PROP: to differentiate between dashboard list and projects grid
  isGridItem?: boolean;
}

const ProjectListItem: React.FC<ProjectListItemProps> = ({ project, isGridItem = false }) => {

  // Conditionally apply different classes for the grid view
  const cardClasses = isGridItem
    ? "project-grid-card project-card-layout"
    : "project-list-card project-card-layout items-start";

  return (
    // The main container for the list item/grid card
    // Note: p-4 and gap-4 are still good Tailwind utilities here
    <Link to={`/projects/${project.id}`}>
      <div className={`${cardClasses} p-4 rounded-xl transition hover:shadow-lg cursor-pointer`}>

        {/* Icon Section (Only present in the Dashboard LIST view, not the Project GRID view) */}
        {/* We are removing the icon from the grid item to match the second image */}

        {/* Text Content */}
        <div className="flex-1">
          <h3 className={`text-lg font-medium text-gray-800 ${isGridItem ? 'mb-2' : ''}`}>{project.title}</h3>
          <p className={`text-sm text-gray-500 ${isGridItem ? 'line-clamp-3 mb-4' : 'line-clamp-2'}`}>{project.description}</p>
        </div>

        {/* Stats (Tasks & Members) */}
        <div className={`flex text-sm text-gray-400 font-medium ${isGridItem ? 'justify-start gap-6 pt-4 border-t border-gray-100' : 'flex-col items-end'}`}>
          <p className="flex items-center gap-1">
            <i className="fa fa-tasks"></i> <span className="text-red-500">{project.tasks}</span> tasks
          </p>
          <p className="flex items-center gap-1">
            <i className="fa fa-user-friends"></i> <span className="text-gray-700">{project.members}</span> members
          </p>
        </div>
      </div>
    </Link>
  );
};

export default ProjectListItem;