"use client";

import { useGame } from "@/lib/useGame";
import Lobby from "@/components/Lobby";
import GameHeader from "@/components/GameHeader";
import PlayerList from "@/components/PlayerList";
import CanvasBoard from "@/components/CanvasBoard";
import ChatPanel from "@/components/ChatPanel";
import StageOverlay from "@/components/StageOverlay";

export default function Home() {
  const g = useGame();
  const { state } = g;

  if (!state) {
    return <Lobby onJoin={g.join} joining={g.joining} error={g.error} />;
  }

  const drawerName = state.players.find((p) => p.id === state.drawerId)?.username ?? "Someone";
  const hostName = state.players.find((p) => p.id === state.hostId)?.username ?? "The host";
  const canDraw = g.isDrawer && state.status === "playing";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-3 p-3 sm:p-4">
      <GameHeader
        state={state}
        turn={g.turn}
        isDrawer={g.isDrawer}
        drawerName={drawerName}
        muted={g.muted}
        onToggleMute={() => g.setMuted(!g.muted)}
        onLeave={g.leave}
      />

      <div className="grid gap-3 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
        <div className="order-3 min-h-[140px] lg:relative lg:order-1">
          <div className="h-full lg:absolute lg:inset-0">
            <PlayerList state={state} myId={g.myId} />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <CanvasBoard canDraw={canDraw} overlayActive={state.status !== "playing"}>
            <StageOverlay
              state={state}
              isDrawer={g.isDrawer}
              isHost={g.isHost}
              drawerName={drawerName}
              hostName={hostName}
              choices={g.choices}
              roundOver={g.roundOver}
              onPick={g.pickWord}
              onStart={g.startGame}
              onSettings={g.updateSettings}
            />
          </CanvasBoard>
        </div>

        <div className="order-2 lg:relative lg:order-3">
          <div className="h-full lg:absolute lg:inset-0">
            <ChatPanel
              state={state}
              messages={g.messages}
              isDrawer={g.isDrawer}
              iGuessed={!!g.me?.guessed}
              onSend={g.sendGuess}
            />
          </div>
        </div>
      </div>
    </main>
  );
}