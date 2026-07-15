export function OrganizationConnections({ childCount }: { childCount: number }) {
  if (childCount === 0) return null;

  return (
    <div className="relative mx-auto h-8 w-full min-w-full">
      <div className="absolute left-1/2 top-0 h-4 border-l border-[#042558]/25" />
      {childCount > 1 && (
        <div className="absolute left-[calc(50%_-_50%/2)] right-[calc(50%_-_50%/2)] top-4 border-t border-[#042558]/25" />
      )}
      <div className="absolute left-1/2 top-4 h-4 border-l border-[#042558]/25" />
    </div>
  );
}
