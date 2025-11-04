import { useEffect, useState } from "react";

type TableInfo = {
  id: string;
  game: string;
  name?: string;
  players: string[];
  player_count: number;
  max_players: number;
  started: boolean;
  street?: string;
  pot?: number;
  dealer?: string;
  sb?: string;
  bb?: string;
  occupied_slots?: number[];
  available_slots?: number[];
};

type Props = {
  onJoinTable: (params: {
    game: string;
    table: string;
    nick: string;
    slot?: number;
  }) => void;
  onBack: () => void;
  nick: string;
};

export function Lobby({ onJoinTable, onBack, nick }: Props) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableGame, setNewTableGame] = useState<"holdem" | "sueca">(
    "holdem"
  );

  // Garante que a URL use http:// ou https:// para requisições REST
  const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    // Se a URL começar com ws:// ou wss://, substitui por http:// ou https://
    if (envUrl.startsWith("ws://")) {
      return envUrl.replace("ws://", "http://");
    }
    if (envUrl.startsWith("wss://")) {
      return envUrl.replace("wss://", "https://");
    }
    return envUrl;
  };
  const apiUrl = getApiUrl();

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/tables`);
      if (!response.ok) throw new Error("Erro ao buscar salas");
      const data = await response.json();
      setTables(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    // Atualiza a lista de salas a cada 3 segundos
    const interval = setInterval(fetchTables, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTable = async (tableId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/tables/${tableId}`);
      if (!response.ok) throw new Error("Erro ao buscar informações da sala");
      const data = await response.json();
      setSelectedTable(data);
      setSelectedSlot(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiUrl}/api/tables`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game: newTableGame,
          name: newTableName || undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar mesa");
      }
      const data = await response.json();
      setShowCreateTable(false);
      setNewTableName("");
      // Atualiza a lista de salas e seleciona a nova mesa
      await fetchTables();
      await handleSelectTable(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar mesa");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTable = () => {
    if (!selectedTable) return;
    if (selectedTable.started && !selectedTable.players.includes(nick)) {
      setError("Não é possível entrar em uma partida já iniciada");
      return;
    }
    if (selectedTable.player_count >= selectedTable.max_players) {
      setError("Mesa cheia");
      return;
    }

    const game = selectedTable.game || "holdem";
    onJoinTable({
      game,
      table: selectedTable.id,
      nick,
      slot: selectedSlot || undefined,
    });
  };

  const getGameName = (game: string) => {
    switch (game) {
      case "holdem":
        return "Texas Hold'em";
      case "sueca":
        return "Sueca";
      default:
        return game;
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Lobby de Salas</h1>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">Jogador: {nick}</span>
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={onBack}
            >
              Voltar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista de Salas */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Salas Disponíveis</h2>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  onClick={() => setShowCreateTable(!showCreateTable)}
                >
                  {showCreateTable ? "Cancelar" : "Nova Mesa"}
                </button>
                <button
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  onClick={fetchTables}
                  disabled={loading}
                >
                  Atualizar
                </button>
              </div>
            </div>

            {showCreateTable && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded">
                <h3 className="font-semibold mb-3">Criar Nova Mesa</h3>
                <div className="space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                      Nome da Mesa (opcional)
                    </span>
                    <input
                      type="text"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                      placeholder="Ex: Mesa VIP"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Jogo</span>
                    <select
                      value={newTableGame}
                      onChange={(e) =>
                        setNewTableGame(e.target.value as "holdem" | "sueca")
                      }
                      className="border rounded px-3 py-2 text-sm"
                    >
                      <option value="holdem">Texas Hold'em</option>
                      <option value="sueca">Sueca</option>
                    </select>
                  </label>
                  <button
                    className="w-full px-4 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    onClick={handleCreateTable}
                    disabled={loading}
                  >
                    Criar Mesa
                  </button>
                </div>
              </div>
            )}

            {loading && tables.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Carregando salas...
              </div>
            ) : tables.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma sala disponível. Crie uma nova sala!
              </div>
            ) : (
              <div className="space-y-3">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className={`p-4 border rounded cursor-pointer transition-colors ${
                      selectedTable?.id === table.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => handleSelectTable(table.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">
                          {table.name || table.id}
                        </div>
                        <div className="text-xs text-gray-500">{table.id}</div>
                        <div className="text-sm text-gray-600">
                          {getGameName(table.game)}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {table.player_count}/{table.max_players} jogadores
                        </div>
                        {table.started && (
                          <span className="inline-block mt-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                            Em andamento
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        {table.players.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {table.players.slice(0, 3).join(", ")}
                            {table.players.length > 3 && "..."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detalhes da Sala Selecionada */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Detalhes da Sala</h2>

            {!selectedTable ? (
              <div className="text-center py-8 text-gray-500">
                Selecione uma sala para ver os detalhes
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="font-semibold text-lg">
                    {selectedTable.id}
                  </div>
                  <div className="text-sm text-gray-600">
                    {getGameName(selectedTable.game)}
                  </div>
                </div>

                <div>
                  <div className="font-medium mb-2">
                    Jogadores ({selectedTable.player_count}/
                    {selectedTable.max_players})
                  </div>
                  <div className="space-y-1">
                    {selectedTable.players.length > 0 ? (
                      selectedTable.players.map((player, idx) => (
                        <div key={player} className="text-sm">
                          <span className="font-medium">Slot {idx + 1}:</span>{" "}
                          {player}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">
                        Nenhum jogador na sala
                      </div>
                    )}
                  </div>
                </div>

                {selectedTable.started && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-sm font-medium text-yellow-800">
                      Partida em andamento
                    </div>
                    {selectedTable.street && (
                      <div className="text-xs text-yellow-700 mt-1">
                        Rodada: {selectedTable.street}
                      </div>
                    )}
                    {selectedTable.pot !== undefined && (
                      <div className="text-xs text-yellow-700 mt-1">
                        Pote: ${selectedTable.pot}
                      </div>
                    )}
                  </div>
                )}

                {!selectedTable.started && (
                  <div>
                    <div className="font-medium mb-2">
                      Escolha seu lugar na mesa
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from(
                        { length: selectedTable.max_players },
                        (_, i) => {
                          const slotNum = i + 1;
                          const isOccupied =
                            selectedTable.occupied_slots?.includes(slotNum);
                          const isSelected = selectedSlot === slotNum;
                          const isAvailable =
                            selectedTable.available_slots?.includes(slotNum);

                          return (
                            <button
                              key={slotNum}
                              disabled={isOccupied}
                              className={`p-3 border rounded text-sm font-medium transition-colors ${
                                isOccupied
                                  ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                                  : isSelected
                                  ? "bg-blue-600 border-blue-700 text-white"
                                  : isAvailable
                                  ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                                  : "bg-gray-50 border-gray-200 text-gray-600"
                              }`}
                              onClick={() =>
                                !isOccupied && setSelectedSlot(slotNum)
                              }
                            >
                              Slot {slotNum}
                              {isOccupied && " (ocupado)"}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <button
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    onClick={handleJoinTable}
                    disabled={
                      loading ||
                      selectedTable.started ||
                      selectedTable.player_count >= selectedTable.max_players ||
                      (!selectedSlot &&
                        selectedTable.available_slots &&
                        selectedTable.available_slots.length > 0)
                    }
                  >
                    {selectedTable.started
                      ? "Partida em andamento"
                      : selectedTable.player_count >= selectedTable.max_players
                      ? "Mesa cheia"
                      : !selectedSlot &&
                        selectedTable.available_slots &&
                        selectedTable.available_slots.length > 0
                      ? "Escolha um slot"
                      : "Entrar na Sala"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
