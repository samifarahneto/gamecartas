import { useState } from "react";
import { Home } from "./pages/Home";
import { Table } from "./pages/Table";

export default function App() {
  const [route, setRoute] = useState<"home" | "table">("home");
  const [params, setParams] = useState<{
    game: string;
    table: string;
    nick: string;
  } | null>(null);

  return route === "home" ? (
    <Home
      onStart={(p) => {
        setParams(p);
        setRoute("table");
      }}
    />
  ) : (
    <Table params={params!} onLeave={() => setRoute("home")} />
  );
}
