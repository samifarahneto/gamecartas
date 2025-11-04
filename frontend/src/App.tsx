import { useState } from "react";
import { Home } from "./pages/Home";
import { Table } from "./pages/Table";
import { Lobby } from "./pages/Lobby";

export default function App() {
  const [route, setRoute] = useState<"home" | "lobby" | "table">("home");
  const [params, setParams] = useState<{
    game: string;
    table: string;
    nick: string;
    slot?: number;
  } | null>(null);
  const [nick, setNick] = useState<string>("guest");

  return route === "home" ? (
    <Home
      onStart={(p) => {
        setParams(p);
        setRoute("table");
      }}
      onLobby={(nick) => {
        setNick(nick);
        setRoute("lobby");
      }}
    />
  ) : route === "lobby" ? (
    <Lobby
      nick={nick}
      onJoinTable={(p) => {
        setParams(p);
        setRoute("table");
      }}
      onBack={() => setRoute("home")}
    />
  ) : (
    <Table params={params!} onLeave={() => setRoute("home")} />
  );
}
