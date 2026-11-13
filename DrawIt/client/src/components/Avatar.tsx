const AVATAR_COLORS = [
  "#ff5a4f", "#ffc93c", "#27c39b", "#3a7bff", "#8b5cf6", "#ff8fb8",
  "#ff9f43", "#2bc0e4", "#a3d94f", "#e056fd", "#16a085", "#f368e0",
];

export function avatarColor(i: number) {
  return AVATAR_COLORS[((i % 12) + 12) % 12];
}

export default function Avatar({ name, index, size = 36 }: { name: string; index: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-display font-extrabold text-ink"
      style={{ width: size, height: size, backgroundColor: avatarColor(index), fontSize: size * 0.45 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
