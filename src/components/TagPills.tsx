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
          className="rounded-full bg-[#2c3440] px-2 py-0.5 text-xs text-[#c8d6e5]"
        >
          {tag.name}
        </li>
      ))}
    </ul>
  );
};
