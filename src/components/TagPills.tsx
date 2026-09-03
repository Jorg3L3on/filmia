type TagPillsProps = {
  tags: Array<{ id: string; name: string }>;
};

export const TagPills = ({ tags }: TagPillsProps) => {
  if (tags.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li
          key={tag.id}
          className="rounded-full bg-chrome px-2 py-0.5 text-xs text-fog"
        >
          {tag.name}
        </li>
      ))}
    </ul>
  );
};
