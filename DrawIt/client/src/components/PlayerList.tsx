import { Check, Crown, Pencil } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { GameState } from "@/lib/useGame";

export default function PlayerList({ state, myId }: { state: GameState; myId: string }) {
  const ranked = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <aside className="sticker flex h-full min-h-0 flex-col p-3" aria-label="Players">
      <h2 className="mb-2 px-1 font-display text-base font-extrabold">Players · {state.players.length}</h2>
      <ul className="scroll-thin flex-1 space-y-1.5 overflow-y-auto">
        {ranked.map((p, i) => {
          const drawing = p.id === state.drawerId && (state.status === "choosing" || state.status === "playing");
          return (
            <li
              key={p.id}
              className={`flex items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 ${
                p.guessed ? "border-ink bg-mint/30" : drawing ? "border-ink bg-sun/50" : "border-transparent"
              }`}
            >
              <span className="w-4 text-center text-xs font-extrabold text-ink-soft">{i + 1}</span>
              <Avatar name={p.username} index={p.avatar} size={34} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex min-w-0 items-center gap-1 text-sm font-bold">
                  <span className="min-w-0 truncate">{p.username}</span>
                  {p.id === myId && <span className="shrink-0 text-xs font-semibold text-ink-soft">(you)</span>}
                  {p.id === state.hostId && <Crown className="h-3.5 w-3.5 shrink-0 fill-sun text-ink" aria-label="Host" />}
                </div>
                <div className="text-xs font-semibold text-ink-soft">{p.score} pts</div>
              </div>
              {drawing && <Pencil className="h-4 w-4 shrink-0 animate-wobble" aria-label="Drawing" />}
              {p.guessed && <Check className="h-5 w-5 shrink-0 text-mint" strokeWidth={3} aria-label="Guessed" />}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
