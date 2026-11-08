export function Empty({
  text,
  action,
  onClick,
}: {
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <p>{text}</p>
      <button className="text-button" onClick={onClick}>
        {action} →
      </button>
    </div>
  );
}
