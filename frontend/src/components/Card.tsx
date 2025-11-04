import React from "react";

type CardProps = {
  card: string; // Ex: "7H", "AS", "KC"
  width?: number;
  height?: number;
  isHighlighted?: boolean;
  className?: string;
};

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

export function Card({
  card,
  width = 80,
  height = 112,
  isHighlighted = false,
  className = "",
}: CardProps) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const suitSymbol = suitSymbols[suit] || suit;
  const suitColor = suitColors[suit] || "#000000";
  const isRed = suit === "H" || suit === "D";

  const cardWidth = width;
  const cardHeight = height;
  const cornerRadius = 8;
  const padding = 8;

  return (
    <svg
      width={cardWidth}
      height={cardHeight}
      viewBox={`0 0 ${cardWidth} ${cardHeight}`}
      className={className}
      style={{
        filter: isHighlighted
          ? "drop-shadow(0 4px 8px rgba(16, 185, 129, 0.5))"
          : "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))",
        cursor: "pointer",
      }}
    >
      {/* Sombra */}
      <rect
        x="2"
        y="2"
        width={cardWidth - 2}
        height={cardHeight - 2}
        rx={cornerRadius}
        fill="rgba(0, 0, 0, 0.15)"
      />

      {/* Fundo branco da carta */}
      <rect
        x="0"
        y="0"
        width={cardWidth}
        height={cardHeight}
        rx={cornerRadius}
        fill="#ffffff"
        stroke={isHighlighted ? "#10b981" : "#333333"}
        strokeWidth={isHighlighted ? 3 : 2}
      />

      {/* Rank no canto superior esquerdo */}
      <text
        x={padding}
        y={padding + 16}
        fontSize="18"
        fontWeight="bold"
        fill="#000000"
        fontFamily="Arial, sans-serif"
      >
        {rank}
      </text>
      <text
        x={padding}
        y={padding + 36}
        fontSize="20"
        fill={suitColor}
        fontFamily="Arial, sans-serif"
      >
        {suitSymbol}
      </text>

      {/* Suit grande no centro */}
      <text
        x={cardWidth / 2}
        y={cardHeight / 2}
        fontSize={Math.floor(cardHeight * 0.35)}
        fontWeight="bold"
        fill={suitColor}
        fontFamily="Arial, sans-serif"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {suitSymbol}
      </text>

      {/* Rank invertido no canto inferior direito */}
      <g
        transform={`translate(${cardWidth - padding}, ${
          cardHeight - padding
        }) rotate(180)`}
      >
        <text
          x="0"
          y="0"
          fontSize="18"
          fontWeight="bold"
          fill="#000000"
          fontFamily="Arial, sans-serif"
          textAnchor="start"
        >
          {rank}
        </text>
        <text
          x="0"
          y="20"
          fontSize="20"
          fill={suitColor}
          fontFamily="Arial, sans-serif"
          textAnchor="start"
        >
          {suitSymbol}
        </text>
      </g>
    </svg>
  );
}
