"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { ChatMsg, GameState } from "@/lib/useGame";

interface ChatPanelProps {
  state: GameState;
  messages: ChatMsg[];
  isDrawer: boolean;
  iGuessed: boolean;
  onSend: (text: string) => void;
}

export default function ChatPanel({ state, messages, isDrawer, iGuessed, onSend }: ChatPanelProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const playing = state.status === "playing";
  const blocked = playing && isDrawer;
  const placeholder = blocked
    ? "You're drawing. Let them guess!"
    : playing && iGuessed
      ? "Chat with other guessers"
      : playing
        ? "Type your guess"
        : "Say something";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || blocked) return;
    onSend(t);
    setText("");
  };

  return (
    <section className="sticker flex h-full min-h-0 flex-col p-3" aria-label="Chat and guesses">
      <h2 className="mb-2 px-1 font-display text-base font-extrabold">Guesses</h2>

      <div ref={listRef} className="scroll-thin min-h-[180px] max-h-72 flex-1 space-y-1.5 overflow-y-auto pr-1 lg:max-h-none scroll-thin" aria-live="polite">
        {messages.length === 0 && (
          <p className="px-1 pt-2 text-sm text-ink-soft">Guesses and chat show up here. Type the word to score.</p>
        )}
        {messages.map((m) => {
          if (m.kind === "system")
            return <p key={m.id} className="px-1 text-center text-xs font-semibold text-ink-soft">{m.text}</p>;
          if (m.kind === "correct")
            return (
              <p key={m.id} className="animate-pop rounded-lg border-2 border-ink bg-mint px-2.5 py-1.5 text-center text-sm font-extrabold">
                {m.text}
              </p>
            );
          if (m.kind === "close")
            return (
              <p key={m.id} className="rounded-lg border-2 border-ink bg-sun px-2.5 py-1.5 text-center text-sm font-bold">
                {m.text}
              </p>
            );
          return (
            <p
              key={m.id}
              className={`rounded-lg px-2.5 py-1.5 text-sm ${m.kind === "private" ? "bg-mint/25 italic" : "bg-ink/[0.05]"}`}
            >
              <span className="mr-1.5 font-extrabold">{m.username}</span>
              {m.text}
            </p>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={blocked}
          maxLength={100}
          autoComplete="off"
          placeholder={placeholder}
          aria-label="Your guess"
          className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-3 py-2.5 text-sm font-semibold placeholder:font-medium placeholder:text-ink/40 disabled:bg-ink/5"
        />
        <button type="submit" disabled={blocked || !text.trim()} className="btn btn-primary px-3" aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
