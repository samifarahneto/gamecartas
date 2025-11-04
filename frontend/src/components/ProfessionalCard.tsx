import React from "react";

type CardProps = {
  card: string; // Ex: "7H", "AS", "KC"
  width?: number;
  height?: number;
  isHighlighted?: boolean;
  className?: string;
};

// Mapeamento de cartas para nomes de arquivo de imagem
// Usaremos um CDN ou imagens locais de cartas profissionais
const cardToImage = (card: string): string => {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);

  // Mapeia ranks
  const rankMap: Record<string, string> = {
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    T: "10",
    J: "jack",
    Q: "queen",
    K: "king",
    A: "ace",
  };

  // Mapeia suits
  const suitMap: Record<string, string> = {
    H: "hearts",
    D: "diamonds",
    S: "spades",
    C: "clubs",
  };

  const rankName = rankMap[rank] || rank.toLowerCase();
  const suitName = suitMap[suit] || suit.toLowerCase();

  // Usa um CDN de cartas profissionais ou imagens locais
  // Opção 1: CDN com imagens de cartas (exemplo)
  // return `https://deckofcardsapi.com/static/img/${rank}${suit}.png`;

  // Opção 2: Usa um sprite sheet profissional
  // Por enquanto, vamos usar um sistema baseado em CSS com sprites
  // Mas vou criar uma solução visual melhor com CSS e gradientes profissionais

  return `${rankName}_of_${suitName}`;
};

// Mapeia carta para código do deckofcardsapi.com
const cardToCode = (card: string): string => {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);

  const rankMap: Record<string, string> = {
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    T: "10",
    J: "JACK",
    Q: "QUEEN",
    K: "KING",
    A: "ACE",
  };

  const suitMap: Record<string, string> = {
    H: "HEARTS",
    D: "DIAMONDS",
    S: "SPADES",
    C: "CLUBS",
  };

  const rankCode = rankMap[rank] || rank;
  const suitCode = suitMap[suit] || suit;

  return `${rankCode}_OF_${suitCode}`;
};

export function ProfessionalCard({
  card,
  width = 80,
  height = 112,
  isHighlighted = false,
  className = "",
}: CardProps) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);

  const suitSymbols: Record<string, string> = {
    H: "♥",
    D: "♦",
    S: "♠",
    C: "♣",
  };

  const suitColors: Record<string, string> = {
    H: "#dc2626",
    D: "#dc2626",
    S: "#000000",
    C: "#000000",
  };

  const suitSymbol = suitSymbols[suit] || suit;
  const suitColor = suitColors[suit] || "#000000";

  // Rank display
  const rankDisplay = rank === "T" ? "10" : rank;

  // URL da imagem profissional da carta
  // Usa um CDN de cartas profissionais ou cria visual local melhorado
  // Formato esperado: AS.png, KH.png, 7D.png, etc.
  const cardForUrl = card; // Já está no formato correto (ex: "AS", "KH")
  const imageUrl = `https://deckofcardsapi.com/static/img/${cardForUrl}.png`;

  return (
    <div
      className={className}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: "relative",
        filter: isHighlighted
          ? "drop-shadow(0 8px 16px rgba(16, 185, 129, 0.7)) drop-shadow(0 0 12px rgba(16, 185, 129, 0.5))"
          : "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))",
        transform: isHighlighted ? "scale(1.08)" : "scale(1)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
      }}
    >
      {/* Carta com imagem profissional */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          borderRadius: "14px",
          overflow: "hidden",
          border: isHighlighted ? "4px solid #10b981" : "3px solid #1a1a1a",
          boxShadow: isHighlighted
            ? "0 8px 24px rgba(16, 185, 129, 0.4), inset 0 0 0 1px rgba(16, 185, 129, 0.2)"
            : "0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
          background: "#ffffff",
        }}
      >
        {/* Imagem da carta profissional */}
        <img
          src={imageUrl}
          alt={card}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={(e) => {
            // Fallback se imagem não carregar - mostra visual SVG
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) {
              fallback.style.display = "block";
            }
          }}
        />

        {/* Overlay com fallback SVG se imagem não carregar */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "none", // Oculto por padrão, aparece se imagem falhar
            background: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
            zIndex: 10,
          }}
          className="card-fallback"
        >
          {/* Rank e suit no canto superior esquerdo */}
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              zIndex: 2,
            }}
          >
            <div
              style={{
                fontSize: `${width * 0.22}px`,
                fontWeight: "bold",
                color: "#000000",
                lineHeight: 1,
                fontFamily: "Arial, sans-serif",
              }}
            >
              {rankDisplay}
            </div>
            <div
              style={{
                fontSize: `${width * 0.28}px`,
                color: suitColor,
                lineHeight: 1,
                marginTop: "2px",
              }}
            >
              {suitSymbol}
            </div>
          </div>

          {/* Suit grande no centro */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: `${height * 0.4}px`,
              color: suitColor,
              opacity: 0.9,
              zIndex: 1,
            }}
          >
            {suitSymbol}
          </div>

          {/* Rank e suit invertidos no canto inferior direito */}
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              right: "10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              transform: "rotate(180deg)",
              zIndex: 2,
            }}
          >
            <div
              style={{
                fontSize: `${width * 0.22}px`,
                fontWeight: "bold",
                color: "#000000",
                lineHeight: 1,
                fontFamily: "Arial, sans-serif",
              }}
            >
              {rankDisplay}
            </div>
            <div
              style={{
                fontSize: `${width * 0.28}px`,
                color: suitColor,
                lineHeight: 1,
                marginTop: "2px",
              }}
            >
              {suitSymbol}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
