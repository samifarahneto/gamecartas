import { useState } from "react";

type Props = {
  onStart: (p: { game: string; table: string; nick: string }) => void;
  onLobby: (nick: string) => void;
};

export function Home({ onStart, onLobby }: Props) {
  const [game, setGame] = useState<"sueca" | "holdem">("holdem");
  const [table, setTable] = useState<string>("new");
  const [nick, setNick] = useState<string>("guest");

  return (
    <div className="min-h-screen flex flex-col gap-6 p-6 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold">Jogos de Cartas</h1>
      <label className="flex flex-col gap-2">
        <span>Apelido</span>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          className="border rounded p-2"
          placeholder="Digite seu apelido"
        />
      </label>
      <div className="flex flex-col gap-3">
        <button
          className="bg-blue-600 text-white rounded p-3 font-semibold hover:bg-blue-700"
          onClick={() => onLobby(nick)}
        >
          Entrar no Lobby
        </button>
        <div className="text-center text-gray-500 text-sm">ou</div>
        <div className="border-t pt-4">
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
          <label className="flex flex-col gap-2 mt-3">
            <span>Mesa</span>
            <input
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="border rounded p-2"
              placeholder="new ou ID"
            />
          </label>
          <button
            className="bg-black text-white rounded p-3 mt-3 w-full hover:bg-gray-800"
            onClick={() => onStart({ game, table, nick })}
          >
            Entrar Direto
          </button>
        </div>
      </div>
    </div>
  );
}
