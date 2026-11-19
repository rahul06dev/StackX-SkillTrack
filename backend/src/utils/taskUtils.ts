export const stripAssigneeTag = (rawDescription: string | null | undefined): string => {
  if (!rawDescription) return '';
  return rawDescription.replace(/^<!--assignee:[\s\S]*?-->/, '');
};

export const parseTaskDescription = (
  rawDescription: string | null | undefined,
  defaultAssignee?: string
): { description: string; assignee: string } => {
  if (!rawDescription) {
    return { description: '', assignee: defaultAssignee || '' };
  }
  const match = rawDescription.match(/^<!--assignee:([\s\S]*?)-->([\s\S]*)$/);
  if (match) {
    return {
      assignee: match[1].trim(),
      description: match[2],
    };
  }
  return {
    description: rawDescription,
    assignee: defaultAssignee || '',
  };
};

export const formatTaskDescription = (
  description: string | null | undefined,
  assignee: string | null | undefined
): string => {
  const cleanDesc = stripAssigneeTag(description);
  if (
    assignee &&
    assignee.trim() &&
    assignee.trim() !== 'Unassigned' &&
    assignee.trim() !== 'Select assignee' &&
    assignee.trim() !== '?'
  ) {
    return `<!--assignee:${assignee.trim()}-->${cleanDesc}`;
  }
  return cleanDesc;
};
