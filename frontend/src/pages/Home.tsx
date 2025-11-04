import { useState } from "react";

type Props = {
  onStart: (p: { game: string; table: string; nick: string }) => void;
};

export function Home({ onStart }: Props) {
  const [game, setGame] = useState<"sueca" | "holdem">("holdem");
  const [table, setTable] = useState<string>("new");
  const [nick, setNick] = useState<string>("guest");

  return (
    <div className="min-h-screen flex flex-col gap-6 p-6 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold">Jogos de Cartas</h1>
      <label className="flex flex-col gap-2">
        <span>Jogo</span>
        <select
          value={game}
          onChange={(e) => setGame(e.target.value as any)}
          className="border rounded p-2"
        >
          <option value="holdem">Texas Hold'em</option>
          <option value="sueca">Sueca</option>
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <span>Mesa</span>
        <input
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="border rounded p-2"
          placeholder="new ou ID"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span>Apelido</span>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          className="border rounded p-2"
        />
      </label>
      <button
        className="bg-black text-white rounded p-3"
        onClick={() => onStart({ game, table, nick })}
      >
        Entrar
      </button>
    </div>
  );
}
