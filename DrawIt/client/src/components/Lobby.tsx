"use client";

import { useEffect, useState } from "react";
import { Dices, Play, AlertCircle } from "lucide-react";

interface LobbyProps {
  onJoin: (roomId: string, username: string) => void;
  joining: boolean;
  error: string;
}

const ADJ = ["quick", "sleepy", "wobbly", "sunny", "tiny", "loud", "brave", "fuzzy"];
const NOUN = ["otter", "pickle", "comet", "waffle", "badger", "kettle", "llama", "noodle"];

function randomRoom() {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJ)}-${pick(NOUN)}-${Math.floor(Math.random() * 90 + 10)}`;
}

const SAMPLE_WORD = "KANGAROO";

export default function Lobby({ onJoin, joining, error }: LobbyProps) {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [fromLink, setFromLink] = useState(false);

  useEffect(() => {
    // Invite links look like /?room=quick-otter-42
    const fromUrl = new URLSearchParams(window.location.search).get("room");
    let saved = "";
    try { saved = localStorage.getItem("drawit:name") ?? ""; } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(saved);
    setRoomId(fromUrl || randomRoom());
    setFromLink(!!fromUrl);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    const room = roomId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name || !room || joining) return;
    try { localStorage.setItem("drawit:name", name); } catch { /* storage blocked */ }
    onJoin(room, name);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 py-10">
      {/* The memorable moment: the logo is the hint row from the game itself. */}
      <div className="text-center">
        <div className="flex justify-center gap-1.5" aria-label="DrawIt">
          {"DRAWIT".split("").map((ch, i) => (
            <span
              key={i}
              className="animate-tile flex h-14 w-12 items-center justify-center rounded-lg border-2 border-ink bg-paper font-display text-3xl font-extrabold shadow-pop sm:h-16 sm:w-14 sm:text-4xl"
              style={{
                animationDelay: `${i * 70}ms`,
                background: ["#fff", "#ffc93c", "#fff", "#27c39b", "#fff", "#ff5a4f"][i],
                color: i === 5 ? "#fff" : "var(--ink)",
              }}
            >
              {ch}
            </span>
          ))}
        </div>
        <p className="mt-5 text-lg font-semibold text-ink-soft">Draw it. Guess it. Heckle your friends.</p>
      </div>

      <form onSubmit={submit} className="sticker w-full max-w-md space-y-5 p-6 sm:p-7">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-bold">Your name</label>
          <input
            id="name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={15}
            required
            autoFocus
            autoComplete="nickname"
            placeholder="Picasso"
            className="w-full rounded-xl border-2 border-ink bg-white px-4 py-3 font-semibold placeholder:text-ink/30"
          />
        </div>

        <div>
          <label htmlFor="room" className="mb-1.5 block text-sm font-bold">
            {fromLink ? "You were invited to room" : "Room code"}
          </label>
          <div className="flex gap-2">
            <input
              id="room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              maxLength={24}
              required
              className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-4 py-3 font-semibold"
            />
            <button
              type="button"
              className="btn px-3"
              onClick={() => { setRoomId(randomRoom()); setFromLink(false); }}
              aria-label="Make a new random room code"
              title="New random room"
            >
              <Dices className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            Share the code or the invite link with friends. Anyone with it joins the same room.
          </p>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border-2 border-ink bg-sun/40 p-3 text-sm font-semibold">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button type="submit" disabled={joining} className="btn btn-primary w-full py-3.5 text-lg">
          <Play className="h-5 w-5 fill-current" />
          {joining ? "Joining..." : fromLink ? "Join room" : "Create or join room"}
        </button>
      </form>

      <p className="max-w-sm text-center text-sm text-ink-soft">
        2 to 12 players. One draws <span className="font-bold text-ink">{SAMPLE_WORD.toLowerCase()}</span>, everyone else
        types guesses. Faster guesses score more.
      </p>
    </div>
  );
}
