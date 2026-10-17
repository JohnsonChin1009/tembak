import clsx from "clsx";
import { LogoMark } from "@/components/logo";

const HUES = ["#7cc4ff", "#f5b84a", "#ff8fab", "#9b8cff", "#5fe0b7", "#ff9f6b"];

function hueFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({
  name,
  seed,
  photoUrl,
  agent,
  className,
}: {
  name?: string;
  seed?: string;
  photoUrl?: string;
  agent?: boolean;
  className?: string;
}) {
  if (agent) return <LogoMark className={clsx("size-8 rounded-lg", className)} />;
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={clsx("size-8 shrink-0 rounded-lg object-cover", className)} />;
  }
  const color = hueFor(seed ?? name ?? "?");
  return (
    <span
      aria-hidden
      className={clsx("grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold", className)}
      style={{ background: `${color}26`, color }}
    >
      {(name ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
