from typing import List

SUECA_RANKS = ["A", "7", "K", "J", "Q", "6", "5", "4", "3", "2"]
SUECA_SUITS = ["S", "H", "D", "C"]


def sueca_deck() -> List[str]:
    # 40 cartas: remove 8,9,10
    return [r + s for s in SUECA_SUITS for r in SUECA_RANKS]


