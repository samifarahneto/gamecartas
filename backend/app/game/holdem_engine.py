from typing import List, Dict, Optional, Tuple, Any
from .cards import standard_deck, shuffle_deck


class HoldemTableState:
    def __init__(self, max_players: int = 9, buy_in: int = 1000):
        self.max_players = max_players
        self.buy_in = buy_in
        self.players: List[str] = []
        self.deck: List[str] = []
        self.community: List[str] = []
        self.hole: Dict[str, List[str]] = {}
        self.stacks: Dict[str, int] = {}  # stack de cada jogador
        self.started = False
        self.street = "preflop"  # preflop, flop, turn, river, showdown
        self.pot: int = 0
        self.side_pots: List[Dict[str, Any]] = []  # side pots para all-ins
        self.bets: Dict[str, int] = {}  # apostas da rodada atual
        self.total_committed: Dict[str, int] = {}  # total apostado na mão
        self.folded: Dict[str, bool] = {}
        self.all_in: Dict[str, bool] = {}  # jogadores em all-in
        self.current_index: int = 0
        self.min_raise: int = 10
        self.last_raise_amount: int = 0  # valor do último raise para calcular min-raise
        self.dealer_index: int = 0  # índice do dealer
        self.last_action_index: int = 0  # rastreia onde a rodada começou
        self.recent_actions: List[Dict[str, Any]] = []  # histórico de ações recentes
        self.last_bettor: Optional[str] = None  # último jogador que apostou/raiseu (para showdown)
        self.sb_size: int = 5
        self.bb_size: int = 10

    def add_player(self, nick: str) -> bool:
        """Adiciona jogador à mesa. Retorna True se adicionado, False se mesa cheia."""
        if nick in self.players:
            return True  # Jogador já está na mesa
        if len(self.players) >= self.max_players:
            return False  # Mesa cheia
        self.players.append(nick)
        self.stacks[nick] = self.buy_in
        self.total_committed[nick] = 0
        self.all_in[nick] = False
        return True

    def start_hand(self) -> None:
        # remove jogadores com stack zero
        self.players = [p for p in self.players if self.stacks.get(p, 0) > 0]
        if len(self.players) < 2:
            return
        
        # rotaciona dealer
        self.dealer_index = (self.dealer_index + 1) % len(self.players)
        
        self.deck = standard_deck()
        shuffle_deck(self.deck)
        self.community = []
        self.hole = {p: [self.deck.pop(), self.deck.pop()] for p in self.players}
        self.started = True
        self.street = "preflop"
        self.pot = 0
        self.side_pots = []
        self.bets = {p: 0 for p in self.players}
        self.total_committed = {p: 0 for p in self.players}
        self.folded = {p: False for p in self.players}
        self.all_in = {p: False for p in self.players}
        self.recent_actions = []
        self.last_raise_amount = 0  # Reseta, BB não conta como raise inicial
        self.last_bettor = None  # Reseta último apostador
        
        # calcular posições de blinds (SB e BB após dealer)
        sb_idx = (self.dealer_index + 1) % len(self.players)
        bb_idx = (self.dealer_index + 2) % len(self.players)
        sb_player = self.players[sb_idx]
        bb_player = self.players[bb_idx]
        
        # post blinds usando stacks (pode ser all-in se stack < blind)
        sb_amt = min(self.sb_size, self.stacks.get(sb_player, 0))
        bb_amt = min(self.bb_size, self.stacks.get(bb_player, 0))
        
        self._commit_bet(sb_player, sb_amt)
        self._commit_bet(bb_player, bb_amt)
        
        # ação começa no próximo jogador após o BB
        self.current_index = (bb_idx + 1) % len(self.players)
        self.last_action_index = self.current_index

    def next_street(self) -> None:
        if not self.started:
            return
        if self.street == "preflop":
            # burn 1, then flop 3
            if len(self.deck) >= 4:
                self.deck.pop()
                self.community.extend([self.deck.pop(), self.deck.pop(), self.deck.pop()])
            self.street = "flop"
        elif self.street == "flop":
            # burn 1, turn 1
            if len(self.deck) >= 2:
                self.deck.pop()
                self.community.append(self.deck.pop())
            self.street = "turn"
        elif self.street == "turn":
            # burn 1, river 1
            if len(self.deck) >= 2:
                self.deck.pop()
                self.community.append(self.deck.pop())
            self.street = "river"
        elif self.street == "river":
            # após river, quando todos igualarem as apostas, vai para showdown
            self.street = "showdown"
            return  # não reseta bets no showdown

        # reset round bets when moving streets (flop, turn, river)
        if self.street in ("flop", "turn", "river"):
            for p in list(self.bets.keys()):
                self.bets[p] = 0
            # Ação começa no primeiro jogador ativo à esquerda do botão
            self.current_index = (self.dealer_index + 1) % len(self.players)
            # Pula jogadores que foldaram
            while self.folded.get(self.players[self.current_index], False):
                self.current_index = (self.current_index + 1) % len(self.players)
            self.last_action_index = self.current_index
            self.recent_actions = []  # limpa ações ao mudar de street
            self.last_raise_amount = 0  # reseta raise amount ao mudar de street
            self.last_bettor = None  # reseta último apostador na nova street

    def to_act(self) -> Optional[str]:
        if not self.players:
            return None
        # find next non-folded and non-all-in player based on current_index
        idx = self.current_index % len(self.players)
        for _ in range(len(self.players)):
            p = self.players[idx]
            if not self.folded.get(p, False) and not self.all_in.get(p, False):
                return p
            idx = (idx + 1) % len(self.players)
        return None

    def _next_index(self, idx: int) -> int:
        return (idx + 1) % len(self.players)

    def highest_bet(self) -> int:
        return max(self.bets.values()) if self.bets else 0
    
    def _commit_bet(self, nick: str, amount: int) -> int:
        """Commita aposta do stack, retorna quanto foi realmente pago (pode ser all-in)"""
        stack = self.stacks.get(nick, 0)
        actual_amount = min(amount, stack)
        self.stacks[nick] = stack - actual_amount
        self.bets[nick] = self.bets.get(nick, 0) + actual_amount
        self.total_committed[nick] = self.total_committed.get(nick, 0) + actual_amount
        self.pot += actual_amount
        if self.stacks[nick] == 0 and actual_amount > 0:
            self.all_in[nick] = True
        return actual_amount
    
    def call_amount(self, nick: str) -> int:
        """Retorna quanto o jogador precisa pagar para call"""
        hb = self.highest_bet()
        current_bet = self.bets.get(nick, 0)
        need = max(0, hb - current_bet)
        # não pode apostar mais que o stack
        return min(need, self.stacks.get(nick, 0))
    
    def min_raise_amount(self) -> int:
        """Retorna o valor mínimo para raise (igual ao último aumento completo, ou BB se não houve raise)"""
        # No-Limit: min raise = tamanho do último aumento completo
        # Ex: BB=100, alguém aumenta para 500 (aumento de +400), próximo min raise = +400 → 900 total
        if self.last_raise_amount > 0:
            return self.last_raise_amount  # min raise = último aumento completo
        # Se não houve raise ainda, min raise = BB (do BB até 2x BB)
        return self.bb_size
    
    def get_sb_player(self) -> Optional[str]:
        """Retorna o jogador que é Small Blind"""
        if not self.started or len(self.players) < 2:
            return None
        sb_idx = (self.dealer_index + 1) % len(self.players)
        return self.players[sb_idx]
    
    def get_bb_player(self) -> Optional[str]:
        """Retorna o jogador que é Big Blind"""
        if not self.started or len(self.players) < 2:
            return None
        bb_idx = (self.dealer_index + 2) % len(self.players)
        return self.players[bb_idx]

    def apply_action(self, nick: str, action: str, amount: Optional[int] = None) -> None:
        if not self.started or nick != self.to_act():
            return
        if self.street == "showdown":
            return
        if self.all_in.get(nick, False):
            return  # jogador já está all-in
        
        action_record = {"player": nick, "action": action, "amount": None}
        
        if action == "fold":
            self.folded[nick] = True
            self.current_index = self._next_index(self.current_index)
        elif action == "check":
            # só pode check se não há aposta pendente (todos têm a mesma aposta)
            hb = self.highest_bet()
            if self.bets.get(nick, 0) != hb:
                return  # não pode check, precisa call ou raise
            self.current_index = self._next_index(self.current_index)
        elif action == "call":
            target = self.highest_bet()
            current_bet = self.bets.get(nick, 0)
            need = max(0, target - current_bet)
            actual = self._commit_bet(nick, need)
            action_record["amount"] = actual
            if self.all_in.get(nick, False):
                action_record["action"] = "all_in"
            self.current_index = self._next_index(self.current_index)
        elif action == "bet":
            # Bet: primeira aposta da rodada (quando não há aposta ainda)
            min_bet = self.bb_size if self.street == "preflop" else self.bb_size
            amt = amount or min_bet
            if amt < min_bet:
                return  # aposta muito pequena
            hb = self.highest_bet()
            if hb > 0:
                return  # já há aposta, use raise em vez de bet
            actual = self._commit_bet(nick, amt)
            if actual < amt:
                # all-in parcial
                action_record["action"] = "all_in"
                action_record["amount"] = actual
                self.all_in[nick] = True
            else:
                action_record["amount"] = amt
                self.last_raise_amount = amt  # atualiza min-raise
                self.last_bettor = nick  # marca como último apostador
            self.last_action_index = self.current_index
            self.current_index = self._next_index(self.current_index)
        elif action == "raise":
            min_raise = self.min_raise_amount()
            hb = self.highest_bet()
            current_bet = self.bets.get(nick, 0)
            call_need = max(0, hb - current_bet)
            
            # Se não há aposta ainda, pode apostar diretamente (bet)
            if hb == 0:
                # Primeira aposta da rodada (bet)
                amt = amount or min_raise
                if amt < min_raise:
                    return  # aposta muito pequena
                actual = self._commit_bet(nick, amt)
                if actual < amt:
                    # all-in parcial
                    action_record["action"] = "all_in"
                    action_record["amount"] = actual
                    self.all_in[nick] = True
                else:
                    action_record["amount"] = amt
                    self.last_raise_amount = amt  # atualiza min-raise
            else:
                # Raise: precisa call + raise
                amt = amount or min_raise
                if amt < min_raise:
                    return  # raise muito pequeno
                need = call_need + amt
                actual = self._commit_bet(nick, need)
                if actual < need:
                    # all-in parcial - não reabre ação se for menor que min raise
                    action_record["action"] = "all_in"
                    action_record["amount"] = actual
                    self.all_in[nick] = True
                    # Se o all-in não é um raise completo, não reabre a ação
                    if actual <= call_need:
                        # All-in não reabre ação
                        pass
                    else:
                        # All-in é um raise completo, reabre ação
                        raise_amount = actual - call_need
                        self.last_raise_amount = raise_amount
                else:
                    # Raise completo
                    action_record["amount"] = amt
                    self.last_raise_amount = amt  # atualiza min-raise para próxima ação
                    self.last_bettor = nick  # marca como último apostador
            
            # após raise, atualiza last_action_index para este jogador
            self.last_action_index = self.current_index
            self.current_index = self._next_index(self.current_index)
        elif action == "all_in":
            # All-in: empurra todas as fichas
            stack = self.stacks.get(nick, 0)
            if stack == 0:
                return  # já está sem fichas
            hb = self.highest_bet()
            current_bet = self.bets.get(nick, 0)
            call_need = max(0, hb - current_bet)
            
            # Se all-in é maior que call_need, pode ser um raise
            actual = self._commit_bet(nick, stack)
            action_record["amount"] = actual
            action_record["action"] = "all_in"
            self.all_in[nick] = True
            
            # Se o all-in é um raise completo (maior que call_need), reabre ação
            if actual > call_need:
                raise_amount = actual - call_need
                if raise_amount >= self.min_raise_amount():
                    # All-in é um raise completo, reabre ação
                    self.last_raise_amount = raise_amount
                    self.last_bettor = nick
                    self.last_action_index = self.current_index
            
            self.current_index = self._next_index(self.current_index)
        
        # registra ação no histórico (mantém apenas últimas 10)
        self.recent_actions.append(action_record)
        if len(self.recent_actions) > 10:
            self.recent_actions.pop(0)

        # verifica se pode avançar street: todos ativos igualaram e ação voltou ao last_action_index
        active = [p for p in self.players if not self.folded.get(p, False)]
        if len(active) <= 1:
            self.street = "showdown"
            return
        
        hb = self.highest_bet()
        all_matched = all(self.bets.get(p, 0) == hb for p in active)
        
        # só avança se todos igualaram E a ação voltou ao last_action_index (todos agiram)
        if all_matched and self.current_index == self.last_action_index:
            self.next_street()

    def _best_5_card_hand(self, cards: List[str]) -> Tuple[int, List[int]]:
        """Encontra a melhor combinação de 5 cartas dentre as cartas disponíveis"""
        if len(cards) < 5:
            return (0, [])
        
        # Se exatamente 5 cartas, avalia diretamente
        if len(cards) == 5:
            return self._evaluate_5_cards(cards)
        
        # Se mais de 5 cartas, testa todas as combinações possíveis
        from itertools import combinations
        best_rank = -1
        best_highs = []
        
        for combo in combinations(cards, 5):
            rank, highs = self._evaluate_5_cards(list(combo))
            if rank > best_rank or (rank == best_rank and highs > best_highs):
                best_rank = rank
                best_highs = highs
        
        return (best_rank, best_highs)
    
    def _evaluate_5_cards(self, cards: List[str]) -> Tuple[int, List[int]]:
        """Avalia uma mão de exatamente 5 cartas. Retorna (rank, high_cards) onde rank 0=high card, 9=royal flush"""
        if len(cards) != 5:
            return (0, [])
        
        suits = [c[1] for c in cards]
        ranks_raw = [c[0] for c in cards]
        rank_map = {"2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14}
        ranks = sorted([rank_map.get(r, 2) for r in ranks_raw], reverse=True)

        is_flush = len(set(suits)) == 1 and len(cards) >= 5
        ranks_set = sorted(set(ranks), reverse=True)
        counts = {r: ranks.count(r) for r in ranks_set}
        sorted_by_count = sorted(counts.items(), key=lambda x: (x[1], x[0]), reverse=True)

        # straight check
        is_straight = False
        straight_high = 0
        if len(ranks_set) >= 5:
            for start in range(len(ranks_set) - 4):
                seq = ranks_set[start:start+5]
                if all(seq[i] - seq[i+1] == 1 for i in range(4)):
                    is_straight = True
                    straight_high = seq[0]
                    break
            # A-2-3-4-5 low straight
            if not is_straight and set([14, 2, 3, 4, 5]) <= set(ranks_set):
                is_straight = True
                straight_high = 5

        # royal flush (A-K-Q-J-10 same suit)
        if is_straight and is_flush and straight_high == 14:
            return (9, [14])
        # straight flush
        if is_straight and is_flush:
            return (8, [straight_high])
        # four of a kind
        if sorted_by_count[0][1] == 4:
            quad_rank = sorted_by_count[0][0]
            kicker = sorted_by_count[1][0] if len(sorted_by_count) > 1 else 0
            return (7, [quad_rank, kicker])
        # full house
        if sorted_by_count[0][1] == 3 and sorted_by_count[1][1] >= 2:
            trips_rank = sorted_by_count[0][0]
            pair_rank = sorted_by_count[1][0]
            return (6, [trips_rank, pair_rank])
        # flush
        if is_flush:
            return (5, ranks[:5])
        # straight
        if is_straight:
            return (4, [straight_high])
        # three of a kind
        if sorted_by_count[0][1] == 3:
            trips_rank = sorted_by_count[0][0]
            kickers = [r for r, _ in sorted_by_count[1:]][:2]
            while len(kickers) < 2:
                kickers.append(0)
            return (3, [trips_rank] + kickers)
        # two pair
        if sorted_by_count[0][1] == 2 and sorted_by_count[1][1] == 2:
            pairs = sorted([sorted_by_count[0][0], sorted_by_count[1][0]], reverse=True)
            kicker = sorted_by_count[2][0] if len(sorted_by_count) > 2 else 0
            return (2, pairs + [kicker])
        # one pair
        if sorted_by_count[0][1] == 2:
            pair_rank = sorted_by_count[0][0]
            kickers = [r for r, _ in sorted_by_count[1:]][:3]
            while len(kickers) < 3:
                kickers.append(0)
            return (1, [pair_rank] + kickers)
        # high card
        return (0, ranks[:5])
    
    def evaluate_hand(self, cards: List[str]) -> Tuple[int, List[int]]:
        """Retorna (rank, high_cards) para a melhor combinação de 5 cartas dentre as cartas disponíveis"""
        return self._best_5_card_hand(cards)

    def _calculate_side_pots(self, all_hands: List[Tuple[str, int, List[int]]]) -> List[Tuple[List[str], int]]:
        """Calcula side pots e retorna lista de (jogadores_eligíveis, valor_do_pote)"""
        active = [p for p in self.players if not self.folded.get(p, False)]
        if not active:
            return []
        
        # ordena jogadores por total_committed (menor primeiro)
        committed = sorted([(p, self.total_committed.get(p, 0)) for p in active], key=lambda x: x[1])
        
        side_pots: List[Tuple[List[str], int]] = []
        remaining_pot = self.pot
        
        # processa cada nível de all-in
        last_level = 0
        for player, level in committed:
            if level <= last_level:
                continue
            
            # calcula pote deste nível
            eligible_count = len([p for p, c in committed if c >= level])
            pot_size = (level - last_level) * eligible_count
            
            if pot_size > remaining_pot:
                pot_size = remaining_pot
                remaining_pot = 0
            else:
                remaining_pot -= pot_size
            
            # jogadores elegíveis para este pote (que apostaram pelo menos até este nível)
            eligible = [p for p, c in committed if c >= level]
            
            if pot_size > 0:
                side_pots.append((eligible, pot_size))
            
            last_level = level
            
            if remaining_pot <= 0:
                break
        
        return side_pots
    
    def get_winner(self) -> Optional[List[str]]:
        """Retorna lista de vencedores (pode ser empate) e atualiza stacks com distribuição de potes"""
        if not self.started:
            return None
        # permite calcular vencedor se temos 5 cartas comunitárias ou se street é showdown
        if len(self.community) < 5 and self.street != "showdown":
            return None
        active_players = [p for p in self.players if not self.folded.get(p, False)]
        if len(active_players) == 0:
            return None
        if len(active_players) == 1:
            winner = active_players[0]
            # dá o pote inteiro para o único jogador ativo
            self.stacks[winner] = self.stacks.get(winner, 0) + self.pot
            return [winner]
        
        # avaliar todas as mãos (melhor combinação de 5 cartas entre hole + community)
        all_hands = []
        for p in active_players:
            hole = self.hole.get(p, [])
            all_cards = hole + self.community
            rank, highs = self.evaluate_hand(all_cards)
            all_hands.append((p, rank, highs))
        
        # Ordenar mãos para determinar vencedores em cada side pot
        # Cria dict de mãos por jogador para consulta rápida
        hand_dict = {p: (rank, highs) for p, rank, highs in all_hands}
        
        # Calcula side pots
        side_pots = self._calculate_side_pots(all_hands)
        
        # Se não há side pots (todos apostaram igual), distribui normalmente
        if not side_pots:
            # ordenar por rank desc, depois por highs desc (comparação de listas)
            all_hands.sort(key=lambda x: (x[1], tuple(x[2])), reverse=True)
            # pegar o(s) vencedor(es) com melhor rank/highs
            best = all_hands[0]
            best_tuple = (best[1], tuple(best[2]))
            winners = [h[0] for h in all_hands if (h[1], tuple(h[2])) == best_tuple]
            
            if winners:
                pot_per_winner = self.pot // len(winners)
                remainder = self.pot % len(winners)
                for w in winners:
                    self.stacks[w] = self.stacks.get(w, 0) + pot_per_winner
                if remainder > 0 and winners:
                    self.stacks[winners[0]] = self.stacks.get(winners[0], 0) + remainder
            
            return winners if winners else None
        
        # Distribui side pots: cada pote vai para o(s) melhor(es) jogador(es) elegíveis
        all_winners = set()
        for eligible, pot_size in side_pots:
            # Encontra melhor mão entre elegíveis
            eligible_hands = [(p, hand_dict[p][0], hand_dict[p][1]) for p in eligible if p in hand_dict]
            if not eligible_hands:
                continue
            
            eligible_hands.sort(key=lambda x: (x[1], tuple(x[2])), reverse=True)
            best = eligible_hands[0]
            best_tuple = (best[1], tuple(best[2]))
            pot_winners = [h[0] for h in eligible_hands if (h[1], tuple(h[2])) == best_tuple]
            
            # Distribui este pote entre vencedores
            if pot_winners:
                pot_per_winner = pot_size // len(pot_winners)
                remainder = pot_size % len(pot_winners)
                for w in pot_winners:
                    self.stacks[w] = self.stacks.get(w, 0) + pot_per_winner
                    all_winners.add(w)
                if remainder > 0 and pot_winners:
                    self.stacks[pot_winners[0]] = self.stacks.get(pot_winners[0], 0) + remainder
        
        return list(all_winners) if all_winners else None
    
    def get_showdown_order(self) -> List[str]:
        """Retorna ordem de showdown: quem apostou por último mostra primeiro, senão primeiro à esquerda do botão"""
        active = [p for p in self.players if not self.folded.get(p, False)]
        if not active:
            return []
        
        # Se há último apostador, ele mostra primeiro
        if self.last_bettor and self.last_bettor in active:
            order = [self.last_bettor]
            # Resto na ordem a partir do próximo ao dealer
            start_idx = (self.dealer_index + 1) % len(self.players)
            for _ in range(len(self.players)):
                p = self.players[start_idx]
                if p != self.last_bettor and p in active:
                    order.append(p)
                start_idx = (start_idx + 1) % len(self.players)
            return order
        
        # Senão, ordem normal: primeiro à esquerda do botão
        order = []
        start_idx = (self.dealer_index + 1) % len(self.players)
        for _ in range(len(self.players)):
            p = self.players[start_idx]
            if p in active:
                order.append(p)
            start_idx = (start_idx + 1) % len(self.players)
        return order


