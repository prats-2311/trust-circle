// Plain grey blocks in the shape of the final layout. No animation, so reduced-motion is respected.
export function Skeleton({ blocks }: { blocks: number[] }) {
  return (
    <div aria-hidden="true" style={{ display: "grid", gap: 16, marginTop: 24 }}>
      {blocks.map((h, i) => (
        <div key={i} className="tc-skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}
