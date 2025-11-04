import random
from typing import List, Tuple

SUITS = ["S", "H", "D", "C"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]


def standard_deck() -> List[str]:
    return [r + s for s in SUITS for r in RANKS]


def shuffle_deck(deck: List[str]) -> None:
    # Embaralha o baralho usando a fonte de aleatoriedade do sistema
    random.shuffle(deck)


