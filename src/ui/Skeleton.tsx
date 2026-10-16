/** Grey blocks in the shape of the final layout, with no animation. */
export function Skeleton({ blocks }: { blocks: number[] }) {
  return (
    <div aria-hidden="true" className="mt-6 grid gap-4">
      {blocks.map((h, i) => (
        <div key={i} className="tc-skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}
