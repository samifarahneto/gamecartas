import { useEffect, useMemo, useRef, useState } from "react";
import { createWs } from "../ws/client";
import { ProfessionalCard } from "../components/ProfessionalCard";

type Props = {
  params: { game: string; table: string; nick: string };
  onLeave: () => void;
};

export function Table({ params, onLeave }: Props) {
  const [players, setPlayers] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [community, setCommunity] = useState<string[]>([]);
  const [hole, setHole] = useState<string[]>([]);
  const [status, setStatus] = useState<
    "open" | "close" | "error" | "connecting"
  >("connecting");
  const [pot, setPot] = useState(0);
  const [street, setStreet] = useState<string | null>(null);
  const [toAct, setToAct] = useState<string | null>(null);
  const [winners, setWinners] = useState<string[] | null>(null);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [callAmount, setCallAmount] = useState<number | null>(null);
  const [stacks, setStacks] = useState<Record<string, number>>({});
  const [dealer, setDealer] = useState<string | null>(null);
  const [sb, setSb] = useState<string | null>(null);
  const [bb, setBb] = useState<string | null>(null);
  const [minRaise, setMinRaise] = useState<number | null>(null);
  const [allHoles, setAllHoles] = useState<Record<string, string[]>>({});
  const [acting, setActing] = useState<boolean>(false);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [showPositionAdjuster, setShowPositionAdjuster] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customPositions, setCustomPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [draggingPlayer, setDraggingPlayer] = useState<string | null>(null);
  const [useCustomPositions, setUseCustomPositions] = useState(false);
  const [clickToPositionMode, setClickToPositionMode] = useState(false);
  const [selectedPlayerForPositioning, setSelectedPlayerForPositioning] =
    useState<string | null>(null);
  const [autoDetectMode, setAutoDetectMode] = useState(false);
  const [detectedPositions, setDetectedPositions] = useState<
    Array<{ x: number; y: number; assigned: string | null }>
  >([]);
  const MAX_PLAYERS = 9; // Máximo de jogadores na mesa

  // Posições das cartas (comunitárias e dos jogadores)
  // Carrega posições salvas ou usa valores padrão
  const loadCardPositions = () => {
    try {
      const saved = localStorage.getItem("poker_card_positions");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          communityCardOffsetY: parsed.communityCardOffsetY ?? 15,
          playerCardOffsetTop: parsed.playerCardOffsetTop ?? 30,
          playerCardOffsetBottom: parsed.playerCardOffsetBottom ?? -90,
        };
      }
    } catch (e) {
      console.error("Erro ao carregar posições das cartas:", e);
    }
    return {
      communityCardOffsetY: 15,
      playerCardOffsetTop: 30,
      playerCardOffsetBottom: -90,
    };
  };

  const savedCardPositions = loadCardPositions();
  const [communityCardOffsetY, setCommunityCardOffsetY] = useState<number>(
    savedCardPositions.communityCardOffsetY
  );
  const [playerCardOffsetTop, setPlayerCardOffsetTop] = useState<number>(
    savedCardPositions.playerCardOffsetTop
  );
  const [playerCardOffsetBottom, setPlayerCardOffsetBottom] = useState<number>(
    savedCardPositions.playerCardOffsetBottom
  );

  // Posições customizadas geradas a partir das posições marcadas
  // Substitua os valores no objeto DEFAULT_POSITIONS no início do componente
  const DEFAULT_POSITIONS = {
    radiusX: 0.550261,
    radiusY: 0.345168,
    angleOffset: 0.007737504430679,
    stretchFactor: 1.03,
  };

  // Posições exatas (para uso direto se preferir)
  const CUSTOM_POSITIONS = {
    Croupier: {
      x: 50.162263286499694,
      y: 11.856823266219239,
    },
    guest: {
      x: 78.92544243589428,
      y: 25.4865778201927,
    },
    "Slot 1": {
      x: 69.51345755693582,
      y: 14.642857142857144,
    },
    "Slot 2": {
      x: 80.69358178053831,
      y: 29.82142857142857,
    },
    "Slot 3": {
      x: 80.69358178053831,
      y: 66.60714285714285,
    },
    "Slot 4": {
      x: 69.40993788819875,
      y: 83.39285714285715,
    },
    "Slot 5": {
      x: 49.94824016563147,
      y: 84.28571428571429,
    },
    "Slot 6": {
      x: 30.693581780538302,
      y: 83.03571428571429,
    },
    "Slot 7": {
      x: 18.99585921325052,
      y: 66.78571428571428,
    },
    "Slot 8": {
      x: 19.306418219461698,
      y: 30.357142857142854,
    },
    "Slot 9": {
      x: 30.07246376811594,
      y: 14.464285714285715,
    },
  };

  // Carrega posições salvas do localStorage ou usa valores padrão
  const loadSavedPositions = () => {
    try {
      const saved = localStorage.getItem("poker_table_positions");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          radiusX: parsed.radiusX ?? DEFAULT_POSITIONS.radiusX,
          radiusY: parsed.radiusY ?? DEFAULT_POSITIONS.radiusY,
          angleOffset: parsed.angleOffset ?? DEFAULT_POSITIONS.angleOffset,
          stretchFactor:
            parsed.stretchFactor ?? DEFAULT_POSITIONS.stretchFactor,
        };
      }
    } catch (e) {
      console.error("Erro ao carregar posições salvas:", e);
    }
    return DEFAULT_POSITIONS;
  };

  // Carrega posições customizadas salvas
  const loadCustomPositions = () => {
    try {
      const saved = localStorage.getItem("poker_custom_positions");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Se houver posições salvas, retorna elas
        if (Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
      // Se não houver posições salvas, retorna CUSTOM_POSITIONS do código
      if (Object.keys(CUSTOM_POSITIONS).length > 0) {
        return CUSTOM_POSITIONS;
      }
    } catch (e) {
      console.error("Erro ao carregar posições customizadas:", e);
      // Em caso de erro, retorna CUSTOM_POSITIONS do código
      if (Object.keys(CUSTOM_POSITIONS).length > 0) {
        return CUSTOM_POSITIONS;
      }
    }
    return {};
  };

  const savedPositions = loadSavedPositions();
  const [radiusX, setRadiusX] = useState<number>(savedPositions.radiusX); // porcentagem da largura
  const [radiusY, setRadiusY] = useState<number>(savedPositions.radiusY); // porcentagem da altura
  const [angleOffset, setAngleOffset] = useState<number>(
    savedPositions.angleOffset
  ); // offset inicial
  const [stretchFactor, setStretchFactor] = useState<number>(
    savedPositions.stretchFactor
  ); // Fator de esticamento

  // Carrega posições customizadas ao montar
  useEffect(() => {
    const saved = loadCustomPositions();
    // Se não houver posições salvas no localStorage, usa CUSTOM_POSITIONS do código
    if (
      Object.keys(saved).length === 0 &&
      Object.keys(CUSTOM_POSITIONS).length > 0
    ) {
      setCustomPositions(CUSTOM_POSITIONS);
      setUseCustomPositions(true);
      // Salva no localStorage para persistência
      localStorage.setItem(
        "poker_custom_positions",
        JSON.stringify(CUSTOM_POSITIONS)
      );
    } else if (Object.keys(saved).length > 0) {
      setCustomPositions(saved);
      setUseCustomPositions(true);
    }
  }, []);

  // Event listeners globais para arrastar jogadores
  useEffect(() => {
    if (!draggingPlayer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrapper = canvas.parentElement as HTMLDivElement | null;
    if (!wrapper) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingPlayer) {
        const rect = wrapper!.getBoundingClientRect();
        const newX = ((e.clientX - rect.left) / rect.width) * 100;
        const newY = ((e.clientY - rect.top) / rect.height) * 100;

        // Limita aos bounds da mesa
        const clampedX = Math.max(5, Math.min(95, newX));
        const clampedY = Math.max(5, Math.min(95, newY));

        setCustomPositions((prev) => ({
          ...prev,
          [draggingPlayer!]: { x: clampedX, y: clampedY },
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setDraggingPlayer(null);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [draggingPlayer]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsUrl = useMemo(() => {
    const api = import.meta.env.VITE_API_URL || "ws://localhost:8000";
    const u = new URL("/ws", api);
    u.searchParams.set("game", params.game);
    u.searchParams.set("table", params.table);
    u.searchParams.set("nick", params.nick);
    return u.toString();
  }, [params]);

  useEffect(() => {
    const ws = createWs(
      wsUrl,
      (msg) => {
        if (msg.type === "state") {
          setPlayers(msg.players || []);
          setStarted(Boolean(msg.started));
          setCommunity(msg.community || []);
          setHole(msg.hole || []);
          setPot(msg.pot || 0);
          setStreet(msg.street || null);
          setToAct(msg.toAct || null);
          setWinners(msg.winners || null);
          setRecentActions(msg.recentActions || []);
          setCallAmount(msg.callAmount ?? null);
          setStacks(msg.stacks || {});
          setDealer(msg.dealer || null);
          setSb(msg.sb || null);
          setBb(msg.bb || null);
          setMinRaise(msg.minRaise ?? null);
          setAllHoles(msg.allHoles || {});
          // Ao receber qualquer atualização de estado, liberamos a UI para o próximo clique
          // Isso evita que os botões "congelem" após a primeira ação
          setActing(false);
          // Resetar betAmount quando não é a vez do jogador ou quando muda o estado
          if (msg.toAct !== params.nick) {
            setBetAmount(0);
          } else if (msg.toAct === params.nick && msg.callAmount !== null) {
            // Se é a vez do jogador, inicializar com call amount
            setBetAmount(msg.callAmount || 0);
          }
        } else if (msg.type === "error") {
          // Exibe mensagem de erro (ex: mesa cheia)
          setErrorMessage(msg.text || msg.error || "Erro desconhecido");
          // Auto-remove mensagem após 5 segundos
          setTimeout(() => setErrorMessage(null), 5000);
        }
      },
      (s) => {
        setStatus(s);
        // Não mostrar mensagem de erro genérica ao fechar conexão
        // Apenas mostrar quando receber mensagem de erro explícita do backend
      }
    );
    wsRef.current = ws;
    return () => ws.close();
  }, [wsUrl]);

  // Ajusta tamanho do canvas ao container e desenha a mesa
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrapper = canvas.parentElement as HTMLDivElement | null;
    if (!wrapper) return;

    // Define tamanho responsivo baseado no container e DPR
    const dpr = window.devicePixelRatio || 1;
    // Usa as dimensões reais do wrapper para garantir consistência com as posições salvas
    const wrapperWidth = wrapper.clientWidth;
    const wrapperHeight = wrapper.clientHeight;
    // Usa exatamente as dimensões do wrapper (sem Math.max) para garantir que as posições % sejam exatas
    canvas.style.width = `${wrapperWidth}px`;
    canvas.style.height = `${wrapperHeight}px`;
    canvas.width = Math.floor(wrapperWidth * dpr);
    canvas.height = Math.floor(wrapperHeight * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // escala para alta densidade

    // Usa as dimensões reais do wrapper para garantir consistência
    const width = wrapperWidth;
    const height = wrapperHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // Função para converter código de carta (ex: "7H") para formato com ícone (ex: "7♥")
    const formatCard = (
      cardCode: string
    ): { rank: string; suit: string; color: string } => {
      const suitMap: Record<string, { icon: string; color: string }> = {
        H: { icon: "♥", color: "#dc2626" }, // Hearts (vermelho)
        D: { icon: "♦", color: "#dc2626" }, // Diamonds (vermelho)
        S: { icon: "♠", color: "#000000" }, // Spades (preto)
        C: { icon: "♣", color: "#000000" }, // Clubs (preto)
      };

      const rank = cardCode.slice(0, -1); // Remove o último caractere (naipe)
      const suit = cardCode.slice(-1); // Último caractere é o naipe
      const suitInfo = suitMap[suit] || { icon: suit, color: "#000000" };

      return {
        rank,
        suit: suitInfo.icon,
        color: suitInfo.color,
      };
    };

    const drawCard = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      card: string,
      isHighlighted: boolean = false
    ) => {
      const cardInfo = formatCard(card);
      const cornerRadius = 8;

      // Sombra da carta
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(x + 2, y + 2, width, height);

      // Fundo branco da carta
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, width, height);

      // Borda da carta
      ctx.strokeStyle = isHighlighted ? "#10b981" : "#333333";
      ctx.lineWidth = isHighlighted ? 3 : 2;
      ctx.strokeRect(x, y, width, height);

      // Rank no canto superior esquerdo
      ctx.fillStyle = "#000000";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(cardInfo.rank, x + 8, y + 8);

      // Suit no canto superior esquerdo (pequeno)
      ctx.fillStyle = cardInfo.color;
      ctx.font = "20px Arial";
      ctx.fillText(cardInfo.suit, x + 8, y + 26);

      // Suit grande no centro
      ctx.fillStyle = cardInfo.color;
      const centerSize = Math.floor(height * 0.35);
      ctx.font = `bold ${centerSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cardInfo.suit, x + width / 2, y + height / 2);

      // Rank invertido no canto inferior direito
      ctx.save();
      ctx.translate(x + width - 8, y + height - 8);
      ctx.rotate(Math.PI);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(cardInfo.rank, 0, 0);
      ctx.fillStyle = cardInfo.color;
      ctx.font = "20px Arial";
      ctx.fillText(cardInfo.suit, 0, 18);
      ctx.restore();
    };

    // Limpa canvas - agora é transparente sobre a imagem de fundo
    ctx.clearRect(0, 0, width, height);

    // Canvas transparente - a mesa real aparece através dele
    // Apenas desenha elementos da UI (jogadores, pote, etc)

    // Desenha jogadores ao redor da mesa
    const numPlayers = players.length;

    // Função auxiliar para calcular posição na elipse com ajuste de esticamento
    const calculatePosition = (angle: number) => {
      // Ajusta o raio baseado no ângulo para criar uma forma mais oval
      // Usa uma função de esticamento para ajustar áreas específicas
      const adjustedRadiusX = width * radiusX * stretchFactor;
      const adjustedRadiusY = height * radiusY * stretchFactor;

      // Aplica correção baseada no ângulo para áreas problemáticas
      // Se stretchFactor for 1.0, mantém a elipse normal
      // Se for diferente, ajusta dinamicamente
      let radiusMultiplier = 1.0;

      // Ajusta áreas inferiores e esquerdas (ângulos entre 90° e 270°)
      const normalizedAngle =
        ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (
        normalizedAngle >= Math.PI / 2 &&
        normalizedAngle <= (3 * Math.PI) / 2
      ) {
        // Parte inferior e esquerda - aplica correção
        radiusMultiplier = stretchFactor;
      }

      const x = centerX + Math.cos(angle) * adjustedRadiusX * radiusMultiplier;
      const y = centerY + Math.sin(angle) * adjustedRadiusY * radiusMultiplier;
      return { x, y };
    };

    // Desenha linha guia da elipse se estiver ajustando posições
    if (showPositionAdjuster && numPlayers > 0) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * 2 * Math.PI + angleOffset;
        const { x, y } = calculatePosition(angle);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Desenha o croupier - agora pode ter posição customizada
    let croupierX: number, croupierY: number;
    if (useCustomPositions && customPositions["Croupier"]) {
      const croupierPos = customPositions["Croupier"];
      // Usa as mesmas dimensões do wrapper para calcular a posição (já são as mesmas de width/height)
      // Converte porcentagem diretamente para pixels do canvas
      croupierX = (croupierPos.x / 100) * width;
      croupierY = (croupierPos.y / 100) * height;
    } else {
      const croupierAngle = angleOffset; // Topo da mesa
      const pos = calculatePosition(croupierAngle);
      croupierX = pos.x;
      croupierY = pos.y;

      // Se estiver usando posições customizadas mas croupier não tem posição salva,
      // inicializa com a posição automática atual
      if (useCustomPositions && !customPositions["Croupier"]) {
        setCustomPositions((prev) => ({
          ...prev,
          Croupier: {
            x: (croupierX / width) * 100,
            y: (croupierY / height) * 100,
          },
        }));
      }
    }

    // Croupier - avatar (desenha apenas se não estiver usando posições customizadas no modo de ajuste)
    if (!(useCustomPositions && showPositionAdjuster)) {
      const croupierGradient = ctx.createRadialGradient(
        croupierX,
        croupierY,
        0,
        croupierX,
        croupierY,
        35
      );
      croupierGradient.addColorStop(0, "#1f2937");
      croupierGradient.addColorStop(0.7, "#1f2937");
      croupierGradient.addColorStop(1, "#111827");
      ctx.fillStyle = croupierGradient;
      ctx.beginPath();
      ctx.arc(croupierX, croupierY, 35, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label "Croupier" (mais próximo do avatar)
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Croupier", croupierX, croupierY - 45);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Desenha os jogadores (começando da posição 1, já que 0 é o croupier)
    // No modo de ajuste, mostra todos os slots disponíveis (até MAX_PLAYERS)
    const playersToShow = showPositionAdjuster
      ? Array.from({ length: MAX_PLAYERS }, (_, i) => `Slot ${i + 1}`)
      : players;

    if (playersToShow.length > 0) {
      // Total de posições = 1 croupier + todos os slots
      const totalPositions = playersToShow.length + 1;

      playersToShow.forEach((player: string, idx: number) => {
        let x: number, y: number;
        const isRealPlayer = players.includes(player);
        const displayName = isRealPlayer ? player : `Slot ${idx + 1}`;

        // Slot correspondente baseado na ordem de entrada (idx 0 = Slot 1, idx 1 = Slot 2, etc.)
        const slotNumber = idx + 1;
        const slotName = `Slot ${slotNumber}`;

        // Se estiver usando posições customizadas, sempre usa a posição do slot correspondente
        if (useCustomPositions) {
          // Sempre tenta usar a posição do slot correspondente primeiro
          let customPos = customPositions[slotName];

          // Se não encontrar e for um jogador real, tenta usar posição do jogador (compatibilidade)
          if (!customPos && isRealPlayer) {
            customPos = customPositions[player];
            // Se encontrou pelo nome do jogador, salva no slot correspondente
            if (customPos) {
              setCustomPositions((prev) => ({
                ...prev,
                [slotName]: customPos,
              }));
            }
          }

          // Se encontrou posição customizada, usa ela
          if (customPos) {
            // Converte de porcentagem para pixels
            x = (customPos.x / 100) * width;
            y = (customPos.y / 100) * height;
          } else {
            // Se não encontrou, usa posição automática
            const playerPosition = slotNumber;
            const angle =
              (playerPosition / totalPositions) * 2 * Math.PI + angleOffset;
            const pos = calculatePosition(angle);
            x = pos.x;
            y = pos.y;

            // Inicializa com a posição automática atual no slot correspondente
            setCustomPositions((prev) => ({
              ...prev,
              [slotName]: { x: (x / width) * 100, y: (y / height) * 100 },
            }));
          }
        } else {
          // Usa posição automática baseada na elipse
          const playerPosition = slotNumber;
          const angle =
            (playerPosition / totalPositions) * 2 * Math.PI + angleOffset;
          const pos = calculatePosition(angle);
          x = pos.x;
          y = pos.y;
        }

        // Cor baseado em posição
        let bgColor = isRealPlayer ? "#4a5568" : "#6b7280"; // Mais claro para slots vazios
        let borderColor = isRealPlayer ? "#2d3748" : "#4b5563";
        let label = "";

        // Labels só aparecem para jogadores reais
        if (isRealPlayer) {
          if (dealer === player) {
            bgColor = "#f59e0b";
            borderColor = "#d97706";
            label = "D";
          }
          if (sb === player) {
            bgColor = "#3b82f6";
            borderColor = "#2563eb";
            label = label ? label + "/SB" : "SB";
          }
          if (bb === player) {
            bgColor = "#8b5cf6";
            borderColor = "#7c3aed";
            label = label ? label + "/BB" : "BB";
          }
          if (toAct === player && started) {
            borderColor = "#10b981";
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(x, y, 42, 0, 2 * Math.PI);
            ctx.stroke();
          }
        } else {
          // Slots vazios têm borda tracejada no modo de ajuste
          if (showPositionAdjuster) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = "#9ca3af";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 37, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // No modo de ajuste com posições customizadas, os jogadores são renderizados como elementos React
        // para permitir arrastar. Aqui apenas desenhamos se não estiver usando posições customizadas
        if (!(useCustomPositions && showPositionAdjuster)) {
          // Círculo do jogador (menor e mais discreto) com gradiente
          const playerRadius = 35; // Menor para caber melhor na mesa
          const playerGradient = ctx.createRadialGradient(
            x,
            y,
            0,
            x,
            y,
            playerRadius
          );
          playerGradient.addColorStop(0, bgColor);
          playerGradient.addColorStop(0.7, bgColor);
          playerGradient.addColorStop(1, borderColor);
          ctx.fillStyle = playerGradient;
          ctx.beginPath();
          ctx.arc(x, y, playerRadius, 0, 2 * Math.PI);
          ctx.fill();

          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 3;
          ctx.stroke();

          // Borda interna clara (mais sutil)
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Nome do jogador (mais próximo do avatar) - posiciona baseado na posição
        const nameOffset = y < centerY ? -45 : -50; // Mais próximo do círculo
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          player.length > 12 ? player.substring(0, 12) + "..." : player,
          x,
          y + nameOffset
        );
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Stack (mais próximo do avatar) - posiciona baseado na posição
        const stackOffset = y < centerY ? 50 : 55; // Mais próximo do círculo
        const stack = stacks[player] ?? 0;
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(`$${stack}`, x, y + stackOffset);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Label (D/SB/BB) - menor e mais discreto
        if (label) {
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = "#fff";
          ctx.font = "bold 11px sans-serif";
          ctx.fillText(label, x, y);
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        // Cartas do jogador (hole cards) - menores e mais próximas
        const playerHole =
          params.nick === player
            ? hole
            : street === "showdown"
            ? allHoles[player]
            : [];
        if (playerHole && playerHole.length > 0) {
          // Cartas não são mais desenhadas nos avatares
        }
      });
    }

    // Pote no centro (muito maior e mais profissional) com fundo escuro para contraste
    if (pot > 0) {
      // Fundo escuro para contraste
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.beginPath();
      ctx.arc(centerX, centerY - 40, 60, 0, 2 * Math.PI);
      ctx.fill();

      // Gradiente do pote
      const potGradient = ctx.createRadialGradient(
        centerX,
        centerY - 40,
        0,
        centerX,
        centerY - 40,
        50
      );
      potGradient.addColorStop(0, "#fbbf24");
      potGradient.addColorStop(0.7, "#f59e0b");
      potGradient.addColorStop(1, "#d97706");
      ctx.fillStyle = potGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 40, 50, 0, 2 * Math.PI);
      ctx.fill();

      // Borda do pote
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Borda interna brilhante
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Texto do pote com sombra
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = "#000";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Pote", centerX, centerY - 60);
      ctx.font = "bold 36px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`$${pot}`, centerX, centerY - 20);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Cartas comunitárias agora são renderizadas como componentes React acima do canvas

    // Listener para redimensionamento
    const handleResize = () => {
      // Força reexecução do effect ao redimensionar
      const wrapper = canvas.parentElement as HTMLDivElement | null;
      if (wrapper) {
        // Triggers re-render by forcing a state update
        // The effect will run again with new dimensions
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [
    players,
    dealer,
    sb,
    bb,
    toAct,
    pot,
    community,
    stacks,
    started,
    street,
    allHoles,
    hole,
    params.nick,
    showPositionAdjuster,
    radiusX,
    radiusY,
    angleOffset,
    stretchFactor,
    useCustomPositions,
    customPositions,
    draggingPlayer,
    clickToPositionMode,
    selectedPlayerForPositioning,
    autoDetectMode,
    detectedPositions,
  ]);

  return (
    <div className="min-h-screen p-4 flex flex-col gap-4 w-[90%] mx-auto">
      {errorMessage && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">Erro: </strong>
          <span className="block sm:inline">{errorMessage}</span>
          <span
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setErrorMessage(null)}
          >
            <svg
              className="fill-current h-6 w-6 text-red-500"
              role="button"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <title>Fechar</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
            </svg>
          </span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Mesa: {params.table}</h2>
        <div className="flex gap-2">
          <button
            className="text-sm px-2 py-1 border rounded"
            onClick={() => setShowPositionAdjuster(!showPositionAdjuster)}
          >
            {showPositionAdjuster ? "Ocultar" : "Ajustar"} Posições
          </button>
          <button className="text-sm underline" onClick={onLeave}>
            Sair
          </button>
        </div>
      </div>
      {showPositionAdjuster && (
        <div className="border rounded p-4 bg-white shadow-lg">
          <div className="font-semibold mb-3">
            Ajuste de Posicionamento dos Jogadores
          </div>
          <div className="text-xs text-gray-600 mb-4">
            Modo:{" "}
            {useCustomPositions
              ? autoDetectMode
                ? "Detectar da Imagem (Automático)"
                : clickToPositionMode
                ? "Clique na Mesa para Posicionar"
                : "Posições Customizadas (Arrastar)"
              : "Posições Automáticas (Elipse)"}
            <br />
            {useCustomPositions
              ? autoDetectMode
                ? `Clique nos pontos marcados na imagem na ordem: 1º Croupier (círculo aberto), depois os jogadores (pontos sólidos).`
                : clickToPositionMode
                ? `Clique na mesa para posicionar: ${
                    selectedPlayerForPositioning || "Selecione um jogador"
                  }.`
                : "Clique e arraste os jogadores diretamente na mesa para posicioná-los, ou use 'Detectar da Imagem' para posicionar automaticamente."
              : "Use os controles abaixo para ajustar a elipse automática, ou ative posições customizadas para arrastar manualmente."}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              className={`px-3 py-1 rounded text-sm ${
                useCustomPositions ? "bg-green-600 text-white" : "bg-gray-200"
              }`}
              onClick={() => {
                const newValue = !useCustomPositions;
                setUseCustomPositions(newValue);

                if (newValue && players.length > 0) {
                  // Ao ativar posições customizadas, inicializa TODOS os jogadores com posições atuais
                  const canvas = canvasRef.current;
                  if (canvas) {
                    const wrapper =
                      canvas.parentElement as HTMLDivElement | null;
                    if (wrapper) {
                      const w = wrapper.clientWidth;
                      const h = wrapper.clientHeight;
                      const centerX = w / 2;
                      const centerY = h / 2;
                      const totalPositions = players.length + 1;
                      const newPositions: Record<
                        string,
                        { x: number; y: number }
                      > = { ...customPositions }; // Mantém posições existentes

                      const calculatePos = (angle: number) => {
                        const adjustedRadiusX = w * radiusX * stretchFactor;
                        const adjustedRadiusY = h * radiusY * stretchFactor;
                        let radiusMultiplier = 1.0;
                        const normalizedAngle =
                          ((angle % (2 * Math.PI)) + 2 * Math.PI) %
                          (2 * Math.PI);
                        if (
                          normalizedAngle >= Math.PI / 2 &&
                          normalizedAngle <= (3 * Math.PI) / 2
                        ) {
                          radiusMultiplier = stretchFactor;
                        }
                        const x =
                          centerX +
                          Math.cos(angle) * adjustedRadiusX * radiusMultiplier;
                        const y =
                          centerY +
                          Math.sin(angle) * adjustedRadiusY * radiusMultiplier;
                        return { x, y };
                      };

                      // Inicializa posição do croupier se não tiver
                      if (!newPositions["Croupier"]) {
                        const croupierAngle = angleOffset;
                        const pos = calculatePos(croupierAngle);
                        newPositions["Croupier"] = {
                          x: (pos.x / w) * 100,
                          y: (pos.y / h) * 100,
                        };
                      }

                      // Inicializa posições para jogadores que ainda não têm
                      players.forEach((player, idx) => {
                        if (!newPositions[player]) {
                          const playerPosition = idx + 1;
                          const angle =
                            (playerPosition / totalPositions) * 2 * Math.PI +
                            angleOffset;
                          const pos = calculatePos(angle);
                          newPositions[player] = {
                            x: (pos.x / w) * 100,
                            y: (pos.y / h) * 100,
                          };
                        }
                      });
                      setCustomPositions(newPositions);
                    }
                  }
                }
              }}
            >
              {useCustomPositions
                ? "✓ Posições Customizadas"
                : "Usar Posições Customizadas"}
            </button>
            {useCustomPositions && (
              <>
                <button
                  className={`px-3 py-1 rounded text-sm ${
                    clickToPositionMode
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-200"
                  }`}
                  onClick={() => {
                    const newMode = !clickToPositionMode;
                    setClickToPositionMode(newMode);
                    if (!newMode) {
                      setSelectedPlayerForPositioning(null);
                    }
                  }}
                >
                  {clickToPositionMode
                    ? "✓ Modo Clique na Mesa"
                    : "Modo Clique na Mesa"}
                </button>
                {clickToPositionMode && !autoDetectMode && (
                  <div className="w-full mt-2">
                    <label className="block text-xs font-medium mb-1">
                      Selecione o jogador ou croupier para posicionar:
                    </label>
                    <select
                      className="border rounded px-2 py-1 text-sm w-full"
                      value={selectedPlayerForPositioning || ""}
                      onChange={(e) =>
                        setSelectedPlayerForPositioning(e.target.value || null)
                      }
                    >
                      <option value="">-- Selecione uma posição --</option>
                      <option value="Croupier">Posição 1 (Croupier)</option>
                      {Array.from({ length: MAX_PLAYERS }, (_, i) => {
                        const slotName = `Slot ${i + 1}`;
                        const positionNumber = i + 2; // Posição 2 a 10
                        return (
                          <option key={slotName} value={slotName}>
                            Posição {positionNumber} ({slotName})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                {useCustomPositions && (
                  <button
                    className={`px-3 py-1 rounded text-sm ${
                      autoDetectMode
                        ? "bg-purple-600 text-white"
                        : "bg-gray-200"
                    }`}
                    onClick={() => {
                      const newMode = !autoDetectMode;
                      setAutoDetectMode(newMode);
                      if (newMode) {
                        setClickToPositionMode(false);
                        setSelectedPlayerForPositioning(null);
                        setDetectedPositions([]);
                      } else {
                        setDetectedPositions([]);
                      }
                    }}
                  >
                    {autoDetectMode
                      ? "✓ Detectar da Imagem"
                      : "Detectar da Imagem"}
                  </button>
                )}
                {autoDetectMode && (
                  <div className="w-full mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-xs font-medium mb-1 text-yellow-800">
                      Modo Detecção Ativo
                    </div>
                    <div className="text-xs text-yellow-700 mb-2">
                      Clique nos pontos marcados na imagem da mesa na seguinte
                      ordem:
                      <br />
                      1. Primeiro clique no{" "}
                      <strong>círculo aberto no topo</strong> (Croupier)
                      <br />
                      2. Depois clique nos <strong>pontos sólidos</strong>{" "}
                      (Jogadores) na ordem desejada
                      <br />
                      <br />
                      Posições detectadas: {detectedPositions.length} /{" "}
                      {MAX_PLAYERS + 1}
                    </div>
                    {detectedPositions.length > 0 && (
                      <div className="text-xs text-yellow-600">
                        <strong>Ordem:</strong>{" "}
                        {detectedPositions.map((pos, idx) => (
                          <span key={idx}>
                            {pos.assigned || `Ponto ${idx + 1}`}
                            {idx < detectedPositions.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                  onClick={() => {
                    localStorage.setItem(
                      "poker_custom_positions",
                      JSON.stringify(customPositions)
                    );
                    alert("Posições customizadas salvas!");
                  }}
                >
                  Salvar Posições
                </button>
                {useCustomPositions &&
                  Object.keys(customPositions).length > 0 && (
                    <button
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold"
                      onClick={() => {
                        // Calcula os valores de elipse que melhor se encaixam nas posições customizadas
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const wrapper = canvas.parentElement;
                        if (!wrapper) return;

                        const width = wrapper.clientWidth;
                        const height = wrapper.clientHeight;
                        const centerX = width / 2;
                        const centerY = height / 2;

                        // Pega posições do croupier e dos slots
                        const croupierPos = customPositions["Croupier"];
                        const slotPositions = Array.from(
                          { length: MAX_PLAYERS },
                          (_, i) => {
                            const slotName = `Slot ${i + 1}`;
                            return customPositions[slotName];
                          }
                        ).filter(Boolean);

                        if (!croupierPos || slotPositions.length === 0) {
                          alert(
                            "Configure pelo menos o Croupier e alguns slots antes de gerar o código."
                          );
                          return;
                        }

                        // Calcula angleOffset baseado na posição do croupier (topo)
                        const croupierX = (croupierPos.x / 100) * width;
                        const croupierY = (croupierPos.y / 100) * height;
                        const croupierAngle = Math.atan2(
                          croupierY - centerY,
                          croupierX - centerX
                        );
                        const calculatedAngleOffset =
                          croupierAngle - -Math.PI / 2; // Ajuste para topo

                        // Calcula radiusX e radiusY médios baseado nas posições dos slots
                        let sumRadiusX = 0;
                        let sumRadiusY = 0;
                        let count = 0;

                        slotPositions.forEach((pos, idx) => {
                          if (pos) {
                            const x = (pos.x / 100) * width;
                            const y = (pos.y / 100) * height;
                            const relX = x - centerX;
                            const relY = y - centerY;
                            const slotAngle =
                              ((idx + 1) / (MAX_PLAYERS + 1)) * 2 * Math.PI +
                              calculatedAngleOffset;
                            const expectedRadiusX = Math.abs(
                              relX / Math.cos(slotAngle)
                            );
                            const expectedRadiusY = Math.abs(
                              relY / Math.sin(slotAngle)
                            );
                            if (
                              !isNaN(expectedRadiusX) &&
                              isFinite(expectedRadiusX) &&
                              Math.abs(Math.cos(slotAngle)) > 0.1
                            ) {
                              sumRadiusX += expectedRadiusX / width;
                              count++;
                            }
                            if (
                              !isNaN(expectedRadiusY) &&
                              isFinite(expectedRadiusY) &&
                              Math.abs(Math.sin(slotAngle)) > 0.1
                            ) {
                              sumRadiusY += expectedRadiusY / height;
                            }
                          }
                        });

                        const avgRadiusX = count > 0 ? sumRadiusX / count : 0.4;
                        const avgRadiusY =
                          count > 0 ? sumRadiusY / count : 0.43;

                        // Calcula stretchFactor aproximado (usa 1.0 como padrão se não conseguir calcular)
                        let calculatedStretchFactor = 1.03;

                        // Gera código com as posições customizadas
                        const code = `// Posições customizadas geradas a partir das posições marcadas
// Substitua os valores no objeto DEFAULT_POSITIONS no início do componente
const DEFAULT_POSITIONS = {
  radiusX: ${avgRadiusX.toFixed(6)},
  radiusY: ${avgRadiusY.toFixed(6)},
  angleOffset: ${calculatedAngleOffset.toFixed(15)},
  stretchFactor: ${calculatedStretchFactor.toFixed(6)},
};

// Posições exatas (para uso direto se preferir)
const CUSTOM_POSITIONS = ${JSON.stringify(customPositions, null, 2)};`;

                        // Copia para clipboard
                        navigator.clipboard
                          .writeText(code)
                          .then(() => {
                            alert(
                              `Código gerado e copiado!\n\n` +
                                `Valores calculados:\n` +
                                `- radiusX: ${avgRadiusX.toFixed(6)}\n` +
                                `- radiusY: ${avgRadiusY.toFixed(6)}\n` +
                                `- angleOffset: ${calculatedAngleOffset.toFixed(
                                  15
                                )}\n` +
                                `- stretchFactor: ${calculatedStretchFactor.toFixed(
                                  6
                                )}\n\n` +
                                `O código inclui também as posições exatas em CUSTOM_POSITIONS.\n` +
                                `Cole no código para substituir DEFAULT_POSITIONS.`
                            );
                          })
                          .catch(() => {
                            // Fallback se clipboard não funcionar
                            const textarea = document.createElement("textarea");
                            textarea.value = code;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand("copy");
                            document.body.removeChild(textarea);
                            alert(
                              `Código gerado e copiado!\n\n` +
                                `Valores calculados:\n` +
                                `- radiusX: ${avgRadiusX.toFixed(6)}\n` +
                                `- radiusY: ${avgRadiusY.toFixed(6)}\n` +
                                `- angleOffset: ${calculatedAngleOffset.toFixed(
                                  15
                                )}\n` +
                                `- stretchFactor: ${calculatedStretchFactor.toFixed(
                                  6
                                )}\n\n` +
                                `O código inclui também as posições exatas em CUSTOM_POSITIONS.\n` +
                                `Cole no código para substituir DEFAULT_POSITIONS.`
                            );
                          });
                      }}
                    >
                      Gerar Código das Posições Marcadas
                    </button>
                  )}
                <button
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                  onClick={() => {
                    if (
                      confirm("Deseja remover todas as posições customizadas?")
                    ) {
                      setCustomPositions({});
                      setUseCustomPositions(false);
                      setClickToPositionMode(false);
                      setAutoDetectMode(false);
                      setSelectedPlayerForPositioning(null);
                      setDetectedPositions([]);
                      localStorage.removeItem("poker_custom_positions");
                    }
                  }}
                >
                  Remover Customizações
                </button>
              </>
            )}
          </div>

          {!useCustomPositions && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Raio Horizontal (X): {(radiusX * 100).toFixed(1)}%
                </label>
                <input
                  type="range"
                  min="0.15"
                  max="0.45"
                  step="0.01"
                  value={radiusX}
                  onChange={(e) => setRadiusX(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Distância do centro na horizontal (largura)
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Raio Vertical (Y): {(radiusY * 100).toFixed(1)}%
                </label>
                <input
                  type="range"
                  min="0.15"
                  max="0.45"
                  step="0.01"
                  value={radiusY}
                  onChange={(e) => setRadiusY(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Distância do centro na vertical (altura)
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Rotação Inicial: {((angleOffset * 180) / Math.PI).toFixed(0)}°
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={(angleOffset * 180) / Math.PI}
                  onChange={(e) =>
                    setAngleOffset((Number(e.target.value) * Math.PI) / 180)
                  }
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Rotação inicial da posição dos jogadores
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Ajuste de Esticamento: {(stretchFactor * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.01"
                  value={stretchFactor}
                  onChange={(e) => setStretchFactor(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Ajusta o raio nas áreas inferiores/esquerdas (use &gt; 100% se
                  estiverem muito próximos do centro)
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                  onClick={() => {
                    localStorage.setItem(
                      "poker_table_positions",
                      JSON.stringify({
                        radiusX,
                        radiusY,
                        angleOffset,
                        stretchFactor,
                      })
                    );
                    alert("Posições salvas! (Salvas no navegador)");
                  }}
                >
                  Salvar Posições
                </button>
                <button
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                  onClick={() => {
                    const values = {
                      radiusX,
                      radiusY,
                      angleOffset,
                      stretchFactor,
                    };
                    const code = `// Valores padrão para posicionamento dos jogadores
  // Substitua os valores no objeto DEFAULT_POSITIONS no início do componente
  const DEFAULT_POSITIONS = {
    radiusX: ${values.radiusX},
    radiusY: ${values.radiusY},
    angleOffset: ${values.angleOffset},
    stretchFactor: ${values.stretchFactor},
  };`;

                    // Copia para clipboard
                    navigator.clipboard
                      .writeText(code)
                      .then(() => {
                        alert(
                          `Valores copiados para clipboard!\n\nCole no código:\n\n${code}`
                        );
                      })
                      .catch(() => {
                        // Fallback se clipboard não funcionar
                        const textarea = document.createElement("textarea");
                        textarea.value = code;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textarea);
                        alert(
                          `Valores copiados para clipboard!\n\nCole no código:\n\n${code}`
                        );
                      });
                  }}
                >
                  Copiar Valores para Código
                </button>
                <button
                  className="px-3 py-1 bg-gray-200 rounded text-sm"
                  onClick={() => {
                    setRadiusX(0.32);
                    setRadiusY(0.32);
                    setAngleOffset(-Math.PI / 2);
                    setStretchFactor(1.0);
                  }}
                >
                  Resetar
                </button>
              </div>
            </div>
          )}

          {/* Seção de Ajuste de Posições das Cartas */}
          <div className="mt-6 pt-6 border-t">
            <div className="font-semibold mb-3">
              Ajuste de Posicionamento das Cartas
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cartas Comunitárias (Y): {communityCardOffsetY}px
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={communityCardOffsetY}
                  onChange={(e) =>
                    setCommunityCardOffsetY(Number(e.target.value))
                  }
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Offset vertical das cartas comunitárias (centro da mesa)
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cartas dos Jogadores (Topo): {playerCardOffsetTop}px
                </label>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="1"
                  value={playerCardOffsetTop}
                  onChange={(e) =>
                    setPlayerCardOffsetTop(Number(e.target.value))
                  }
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Offset para jogadores na parte superior da mesa
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cartas dos Jogadores (Fundo): {playerCardOffsetBottom}px
                </label>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="1"
                  value={playerCardOffsetBottom}
                  onChange={(e) =>
                    setPlayerCardOffsetBottom(Number(e.target.value))
                  }
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Offset para jogadores na parte inferior da mesa
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                onClick={() => {
                  localStorage.setItem(
                    "poker_card_positions",
                    JSON.stringify({
                      communityCardOffsetY,
                      playerCardOffsetTop,
                      playerCardOffsetBottom,
                    })
                  );
                  alert("Posições das cartas salvas!");
                }}
              >
                Salvar Posições das Cartas
              </button>
              <button
                className="px-3 py-1 bg-gray-200 rounded text-sm"
                onClick={() => {
                  setCommunityCardOffsetY(15);
                  setPlayerCardOffsetTop(30);
                  setPlayerCardOffsetBottom(-90);
                }}
              >
                Resetar Cartas
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="border rounded p-3 bg-gray-50">
        <div className="flex justify-between items-center mb-2">
          <div className="font-medium">Mesa Hold'em</div>
          <div className="text-xs text-gray-600">Conexão: {status}</div>
        </div>
        <div
          className="w-full overflow-hidden py-6 px-2 relative rounded-lg"
          id="table-canvas-wrapper"
          style={{
            backgroundImage:
              "url('/images/poker-table.jpg'), url('/images/poker-table.png'), url('/images/poker-table.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            aspectRatio: "1.82 / 1", // Proporção da mesa de poker (largura:altura)
            boxShadow:
              "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 100px rgba(0, 0, 0, 0.3)",
            position: "relative",
            border: "6px solid #654321",
            backgroundColor: "#0d4a2e", // Fallback se imagem não existir
            cursor:
              autoDetectMode ||
              (clickToPositionMode && selectedPlayerForPositioning)
                ? "crosshair"
                : "default",
          }}
          onClick={(e) => {
            const wrapper = e.currentTarget;
            const rect = wrapper.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            // Usa as dimensões do wrapper para calcular porcentagem
            // Isso garante que a posição seja consistente com elementos React (que usam % do wrapper)
            const wrapperWidth = wrapper.clientWidth;
            const wrapperHeight = wrapper.clientHeight;

            // Calcula posição em porcentagem usando as dimensões do wrapper
            const xPercent = (clickX / wrapperWidth) * 100;
            const yPercent = (clickY / wrapperHeight) * 100;

            // Limita aos bounds da mesa
            const clampedX = Math.max(5, Math.min(95, xPercent));
            const clampedY = Math.max(5, Math.min(95, yPercent));

            if (autoDetectMode) {
              // Modo de detecção automática - atribui posições na ordem
              e.preventDefault();
              e.stopPropagation();

              const newPositions = [...detectedPositions];
              const positionIndex = newPositions.length;

              // Determina qual pessoa atribuir baseado na ordem
              let assigned: string;
              if (positionIndex === 0) {
                // Primeiro clique = Croupier (círculo aberto no topo)
                assigned = "Croupier";
              } else {
                // Próximos cliques = Jogadores na ordem
                const playerIndex = positionIndex - 1;
                if (playerIndex < players.length) {
                  assigned = players[playerIndex];
                } else {
                  assigned = `Jogador ${positionIndex}`;
                }
              }

              newPositions.push({
                x: clampedX,
                y: clampedY,
                assigned,
              });

              setDetectedPositions(newPositions);

              // Atualiza posição imediatamente
              setCustomPositions((prev) => ({
                ...prev,
                [assigned]: {
                  x: clampedX,
                  y: clampedY,
                },
              }));

              // Feedback visual - círculo colorido no ponto clicado
              const feedback = document.createElement("div");
              feedback.style.position = "absolute";
              feedback.style.left = `${clickX}px`;
              feedback.style.top = `${clickY}px`;
              feedback.style.width = "25px";
              feedback.style.height = "25px";
              feedback.style.borderRadius = "50%";
              feedback.style.background =
                assigned === "Croupier"
                  ? "rgba(139, 92, 246, 0.8)"
                  : "rgba(34, 197, 94, 0.8)";
              feedback.style.border = `2px solid ${
                assigned === "Croupier" ? "#8b5cf6" : "#22c55e"
              }`;
              feedback.style.pointerEvents = "none";
              feedback.style.transform = "translate(-50%, -50%)";
              feedback.style.zIndex = "100";
              feedback.style.display = "flex";
              feedback.style.alignItems = "center";
              feedback.style.justifyContent = "center";
              feedback.style.color = "white";
              feedback.style.fontSize = "12px";
              feedback.style.fontWeight = "bold";
              feedback.textContent = String(positionIndex + 1);
              wrapper.appendChild(feedback);

              setTimeout(() => {
                feedback.remove();
              }, 1000);

              // Se detectou todas as posições, desativa modo auto
              if (newPositions.length >= MAX_PLAYERS + 1) {
                setTimeout(() => {
                  setAutoDetectMode(false);
                  alert(
                    `Todas as posições detectadas! (Croupier + ${MAX_PLAYERS} slots de jogadores)`
                  );
                }, 500);
              }
            } else if (
              clickToPositionMode &&
              selectedPlayerForPositioning &&
              !draggingPlayer
            ) {
              // Modo de clique manual (selecionar jogador primeiro) - só funciona se não estiver arrastando
              e.preventDefault();
              e.stopPropagation();

              // Atualiza posição do jogador selecionado
              setCustomPositions((prev) => ({
                ...prev,
                [selectedPlayerForPositioning]: {
                  x: clampedX,
                  y: clampedY,
                },
              }));

              // Feedback visual - círculo amarelo no ponto clicado
              const feedback = document.createElement("div");
              feedback.style.position = "absolute";
              feedback.style.left = `${clickX}px`;
              feedback.style.top = `${clickY}px`;
              feedback.style.width = "20px";
              feedback.style.height = "20px";
              feedback.style.borderRadius = "50%";
              feedback.style.background = "rgba(255, 255, 0, 0.8)";
              feedback.style.border = "2px solid rgba(255, 255, 0, 1)";
              feedback.style.pointerEvents = "none";
              feedback.style.transform = "translate(-50%, -50%)";
              feedback.style.zIndex = "100";
              wrapper.appendChild(feedback);

              setTimeout(() => {
                feedback.remove();
              }, 500);
            }
          }}
        >
          {/* Overlay escuro sutil para melhorar contraste dos elementos */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.15)",
              borderRadius: "12px",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />

          <canvas
            ref={canvasRef}
            className="w-full rounded-lg"
            style={{
              display: "block",
              position: "relative",
              zIndex: 2,
              background: "transparent",
              pointerEvents:
                useCustomPositions &&
                showPositionAdjuster &&
                !clickToPositionMode &&
                !autoDetectMode
                  ? "none"
                  : (clickToPositionMode && selectedPlayerForPositioning) ||
                    autoDetectMode
                  ? "none"
                  : "auto",
            }}
          />

          {/* Bola de posicionamento quando uma posição é selecionada no dropdown */}
          {clickToPositionMode &&
            selectedPlayerForPositioning &&
            (() => {
              const canvas = canvasRef.current;
              if (!canvas) return null;
              const wrapper = canvas.parentElement;
              if (!wrapper) return null;

              const width = wrapper.clientWidth;
              const height = wrapper.clientHeight;

              // Pega a posição salva ou usa o centro
              const savedPos = customPositions[selectedPlayerForPositioning];
              const initialX = savedPos ? savedPos.x : 50; // Centro em porcentagem
              const initialY = savedPos ? savedPos.y : 50;

              const isCroupier = selectedPlayerForPositioning === "Croupier";
              const isSlot = selectedPlayerForPositioning.startsWith("Slot ");

              // Determina cor e label
              let bgColor = "#4a5568";
              let borderColor = "#2d3748";
              let label = "";

              if (isCroupier) {
                bgColor = "#1f2937";
                borderColor = "#111827";
                label = "Croupier";
              } else if (isSlot) {
                bgColor = "#6b7280";
                borderColor = "#4b5563";
                label = selectedPlayerForPositioning.replace("Slot ", "");
              }

              const handleMouseDown = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingPlayer(selectedPlayerForPositioning);
              };

              const handleMouseUp = () => {
                setDraggingPlayer(null);
              };

              return (
                <div
                  key={`positioning-${selectedPlayerForPositioning}`}
                  className="absolute cursor-move"
                  style={{
                    left: `${initialX}%`,
                    top: `${initialY}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 30,
                    userSelect: "none",
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div
                    className="rounded-full border-3 flex flex-col items-center justify-center animate-pulse"
                    style={{
                      width: "80px",
                      height: "80px",
                      background: `radial-gradient(circle, ${bgColor} 0%, ${bgColor} 70%, ${borderColor} 100%)`,
                      border: `3px solid ${borderColor}`,
                      boxShadow:
                        draggingPlayer === selectedPlayerForPositioning
                          ? "0 0 25px rgba(255, 255, 255, 1)"
                          : "0 0 15px rgba(255, 255, 255, 0.8), 0 4px 12px rgba(0, 0, 0, 0.5)",
                      transition:
                        draggingPlayer === selectedPlayerForPositioning
                          ? "none"
                          : "all 0.2s",
                    }}
                  >
                    {label && (
                      <div className="text-white text-sm font-bold">
                        {label}
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white text-xs font-bold whitespace-nowrap drop-shadow-lg bg-black bg-opacity-50 px-2 py-1 rounded">
                    {isCroupier
                      ? "Posição 1 (Croupier)"
                      : `Posição ${
                          parseInt(
                            selectedPlayerForPositioning.replace("Slot ", "")
                          ) + 1
                        }`}
                  </div>
                </div>
              );
            })()}

          {/* Croupier e Jogadores arrastáveis quando em modo de ajuste com posições customizadas */}
          {useCustomPositions &&
            showPositionAdjuster &&
            !clickToPositionMode &&
            (() => {
              const canvas = canvasRef.current;
              if (!canvas) return null;
              const wrapper = canvas.parentElement;
              if (!wrapper) return null;

              const width = wrapper.clientWidth;
              const height = wrapper.clientHeight;

              // Lista com croupier + todos os slots (9 jogadores)
              const slotsToShow = Array.from(
                { length: MAX_PLAYERS },
                (_, i) => `Slot ${i + 1}`
              );
              const allPlayers = ["Croupier", ...slotsToShow];

              return allPlayers.map((player, idx) => {
                // Para jogadores reais, usa posição do slot correspondente
                let pos = customPositions[player];

                if (!pos && idx > 0) {
                  // Se for um slot/jogador (idx > 0), usa posição do slot
                  const slotNumber = idx; // idx 1 = Slot 1, idx 2 = Slot 2, etc.
                  const slotName = `Slot ${slotNumber}`;
                  pos = customPositions[slotName];

                  // Se ainda não encontrar e houver jogador real correspondente, tenta usar
                  if (!pos && idx <= players.length) {
                    const realPlayer = players[idx - 1];
                    pos = customPositions[realPlayer];
                    // Se encontrou, salva no slot para usar no futuro
                    if (pos) {
                      setCustomPositions((prev) => ({
                        ...prev,
                        [slotName]: pos,
                      }));
                    }
                  }
                }

                // Fallback para centro se não encontrar
                if (!pos) {
                  pos = { x: 50, y: 50 };
                }

                // Usa as dimensões do wrapper para garantir consistência com o canvas
                const x = (pos.x / 100) * wrapper.clientWidth;
                const y = (pos.y / 100) * wrapper.clientHeight;

                // Determina se é croupier, slot ou jogador real
                const isCroupier = player === "Croupier";
                const isSlot = !isCroupier && !players.includes(player);
                const realPlayerForSlot =
                  idx > 0 && idx <= players.length ? players[idx - 1] : null;

                // Cor baseado em posição
                let bgColor = "#4a5568";
                let borderColor = "#2d3748";
                let label = "";

                // Croupier tem cores diferentes
                if (isCroupier) {
                  bgColor = "#1f2937";
                  borderColor = "#111827";
                  label = "Croupier";
                } else if (isSlot) {
                  // Slots vazios têm cores mais claras
                  bgColor = "#6b7280";
                  borderColor = "#4b5563";
                  label = player.replace("Slot ", "");
                } else if (realPlayerForSlot) {
                  // Jogador real - usa cores normais
                  if (dealer === realPlayerForSlot) {
                    bgColor = "#f59e0b";
                    borderColor = "#d97706";
                    label = "D";
                  }
                  if (sb === realPlayerForSlot) {
                    bgColor = "#3b82f6";
                    borderColor = "#2563eb";
                    label = label ? label + "/SB" : "SB";
                  }
                  if (bb === realPlayerForSlot) {
                    bgColor = "#8b5cf6";
                    borderColor = "#7c3aed";
                    label = label ? label + "/BB" : "BB";
                  }
                }

                const handleMouseDown = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Ao arrastar, usa o nome do slot (não do jogador real)
                  const slotToDrag = isCroupier
                    ? "Croupier"
                    : idx > 0
                    ? `Slot ${idx}`
                    : player;
                  setDraggingPlayer(slotToDrag);
                };

                const handleMouseUp = () => {
                  setDraggingPlayer(null);
                };

                return (
                  <div
                    key={`draggable-${player}`}
                    className="absolute cursor-move"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: 20,
                      userSelect: "none",
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div
                      className="rounded-full border-3 flex flex-col items-center justify-center"
                      style={{
                        width: "70px",
                        height: "70px",
                        background: `radial-gradient(circle, ${bgColor} 0%, ${bgColor} 70%, ${borderColor} 100%)`,
                        border: `3px solid ${borderColor}`,
                        boxShadow:
                          draggingPlayer ===
                          (isCroupier
                            ? "Croupier"
                            : idx > 0
                            ? `Slot ${idx}`
                            : player)
                            ? "0 0 20px rgba(255, 255, 255, 0.8)"
                            : "0 2px 8px rgba(0, 0, 0, 0.3)",
                        transition:
                          draggingPlayer ===
                          (isCroupier
                            ? "Croupier"
                            : idx > 0
                            ? `Slot ${idx}`
                            : player)
                            ? "none"
                            : "all 0.2s",
                      }}
                    >
                      {label && (
                        <div className="text-white text-xs font-bold">
                          {label}
                        </div>
                      )}
                    </div>
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-white text-xs font-bold whitespace-nowrap drop-shadow-lg">
                      {isCroupier
                        ? "Croupier"
                        : isSlot
                        ? player
                        : realPlayerForSlot
                        ? realPlayerForSlot.length > 12
                          ? realPlayerForSlot.substring(0, 12) + "..."
                          : realPlayerForSlot
                        : player}
                    </div>
                    {!isCroupier && realPlayerForSlot && (
                      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-white text-xs font-bold drop-shadow-lg">
                        ${stacks[realPlayerForSlot] ?? 0}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

          {/* Cartas comunitárias */}
          {community.length > 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 10 }}
            >
              <div
                className="flex gap-2.5"
                style={{ marginTop: `${communityCardOffsetY}px` }}
              >
                {community.map((card, idx) => (
                  <ProfessionalCard
                    key={idx}
                    card={card}
                    width={75}
                    height={105}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cartas do jogador atual e botões de ação - dentro do container da mesa */}
          {hole.length > 0 && (
            <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3 z-50">
              {/* Cartas do jogador */}
              <div className="flex gap-2">
                {hole.map((card, idx) => (
                  <ProfessionalCard
                    key={idx}
                    card={card}
                    width={75}
                    height={105}
                    isHighlighted={true}
                  />
                ))}
              </div>

              {/* Botões de ação */}
              {street !== "showdown" && (
                <div className="border rounded-lg p-4 min-w-[280px] bg-transparent">
                  <div className="flex gap-2 mb-2">
                    <button
                      className="border rounded px-3 py-2"
                      disabled={toAct !== params.nick || acting}
                      onClick={() => {
                        setActing(true);
                        wsRef.current?.send(
                          JSON.stringify({ type: "action", action: "check" })
                        );
                      }}
                    >
                      Check
                    </button>
                    <button
                      className="border rounded px-3 py-2 text-red-700"
                      disabled={toAct !== params.nick || acting}
                      onClick={() => {
                        setActing(true);
                        wsRef.current?.send(
                          JSON.stringify({ type: "action", action: "fold" })
                        );
                      }}
                    >
                      Fold
                    </button>
                  </div>

                  {toAct === params.nick && callAmount !== null && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {betAmount <= callAmount
                            ? callAmount === 0
                              ? "Check"
                              : betAmount < callAmount
                              ? `Call ${callAmount}`
                              : `Call ${callAmount}`
                            : betAmount >= stacks[params.nick]
                            ? "All-in"
                            : `Raise ${betAmount}`}
                        </span>
                        <span className="text-sm text-gray-600">
                          Stack: {stacks[params.nick] || 0}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={stacks[params.nick] || 0}
                        value={betAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBetAmount(val);
                        }}
                        step={1}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background:
                            callAmount === 0
                              ? `linear-gradient(to right, #10b981 0%, #10b981 ${
                                  (betAmount /
                                    Math.max(1, stacks[params.nick] || 0)) *
                                  100
                                }%, #e5e7eb ${
                                  (betAmount /
                                    Math.max(1, stacks[params.nick] || 0)) *
                                  100
                                }%, #e5e7eb 100%)`
                              : `linear-gradient(to right, #10b981 0%, #10b981 ${
                                  ((betAmount - callAmount) /
                                    Math.max(
                                      1,
                                      (stacks[params.nick] || 0) - callAmount
                                    )) *
                                  100
                                }%, #e5e7eb ${
                                  ((betAmount - callAmount) /
                                    Math.max(
                                      1,
                                      (stacks[params.nick] || 0) - callAmount
                                    )) *
                                  100
                                }%, #e5e7eb 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{callAmount === 0 ? "Check" : callAmount}</span>
                        <span className="font-medium text-gray-700">
                          {betAmount}
                        </span>
                        <span>{stacks[params.nick] || 0} (All-in)</span>
                      </div>
                      <button
                        className="w-full bg-blue-600 text-white rounded px-3 py-2 disabled:bg-gray-400"
                        disabled={
                          toAct !== params.nick ||
                          acting ||
                          (callAmount > 0 && betAmount < callAmount) ||
                          (betAmount > callAmount &&
                            betAmount < (callAmount || 0) + (minRaise || 0))
                        }
                        onClick={() => {
                          if (acting) return;
                          setActing(true);
                          const currentBet = betAmount;
                          const myStack = stacks[params.nick] || 0;

                          if (currentBet === 0 && callAmount === 0) {
                            wsRef.current?.send(
                              JSON.stringify({
                                type: "action",
                                action: "check",
                              })
                            );
                          } else if (currentBet === callAmount) {
                            wsRef.current?.send(
                              JSON.stringify({ type: "action", action: "call" })
                            );
                          } else if (currentBet >= myStack) {
                            wsRef.current?.send(
                              JSON.stringify({
                                type: "action",
                                action: "all_in",
                              })
                            );
                          } else if (currentBet > callAmount) {
                            const raiseAmount = currentBet - callAmount;
                            wsRef.current?.send(
                              JSON.stringify({
                                type: "action",
                                action: "raise",
                                amount: raiseAmount,
                              })
                            );
                          }
                          setBetAmount(callAmount || 0);
                        }}
                      >
                        {betAmount === 0 && callAmount === 0
                          ? "Check"
                          : betAmount >= stacks[params.nick]
                          ? "All-in"
                          : betAmount === callAmount
                          ? `Call ${callAmount}`
                          : `Raise ${betAmount}`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border rounded p-3">
          <div className="font-medium mb-2">Informações</div>
          {!started ? (
            <button
              className="bg-blue-600 text-white rounded p-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !wsRef.current ||
                wsRef.current.readyState !== WebSocket.OPEN ||
                players.length < 2
              }
              onClick={() => {
                console.log("Botão 'Iniciar mão' clicado");
                console.log("WebSocket:", wsRef.current);
                console.log("ReadyState:", wsRef.current?.readyState);
                console.log("Jogadores:", players.length);

                if (
                  !wsRef.current ||
                  wsRef.current.readyState !== WebSocket.OPEN
                ) {
                  console.error("WebSocket não está conectado");
                  setErrorMessage("WebSocket não está conectado. Aguarde...");
                  return;
                }
                if (players.length < 2) {
                  console.error("Menos de 2 jogadores");
                  setErrorMessage(
                    "É necessário pelo menos 2 jogadores para iniciar a mão."
                  );
                  return;
                }
                try {
                  console.log("Enviando comando start...");
                  wsRef.current.send(JSON.stringify({ type: "start" }));
                  console.log("Comando start enviado com sucesso");
                } catch (error) {
                  console.error("Erro ao enviar comando start:", error);
                  setErrorMessage("Erro ao enviar comando. Tente novamente.");
                }
              }}
            >
              Iniciar mão{" "}
              {players.length < 2 && `(${players.length}/2 jogadores)`}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {street === "showdown" && (
                <div className="flex flex-col gap-2">
                  <div className="font-bold text-green-700">Showdown</div>
                  {winners && winners.length > 0 ? (
                    <div className="bg-yellow-100 border border-yellow-400 rounded p-2">
                      <div className="font-semibold">
                        Vencedor(es): {winners.join(", ")}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      Aguardando cálculo do vencedor...
                    </div>
                  )}
                  <button
                    className="bg-blue-700 text-white rounded p-2"
                    onClick={() =>
                      wsRef.current?.send(
                        JSON.stringify({ type: "action", action: "new_hand" })
                      )
                    }
                  >
                    Nova mão
                  </button>
                </div>
              )}
              {recentActions.length > 0 && (
                <div className="border rounded p-2 bg-gray-50">
                  <div className="text-sm font-medium mb-1">
                    Ações recentes:
                  </div>
                  <div className="text-xs space-y-1">
                    {recentActions.slice(-5).map((action, idx) => (
                      <div key={idx}>
                        {action.player}{" "}
                        {action.action === "check"
                          ? "Check"
                          : action.action === "call"
                          ? `Call ${action.amount || ""}`
                          : action.action === "raise"
                          ? `Raise +${action.amount || ""}`
                          : action.action === "fold"
                          ? "Fold"
                          : action.action}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <button
        className="bg-gray-900 text-white rounded p-2"
        onClick={() =>
          wsRef.current?.send(
            JSON.stringify({ type: "chat", from: params.nick, text: "olá" })
          )
        }
      >
        Dizer olá
      </button>
    </div>
  );
}
