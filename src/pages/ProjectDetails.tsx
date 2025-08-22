import React from 'react';
import { useParams } from 'react-router-dom';

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Project Details</h1>
      <p>Project ID: {id}</p>
      <p>This page is under development.</p>
    </div>
  );
};

export default ProjectDetails;