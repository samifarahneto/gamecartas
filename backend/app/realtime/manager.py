import json
from typing import Dict, List, Optional
from fastapi import WebSocket
from ..game.holdem_engine import HoldemTableState
from .protocol import state_message, error_message


class Connection:
    def __init__(self, websocket: WebSocket, nick: str, table_id: str, game: str):
        self.websocket = websocket
        self.nick = nick
        self.table_id = table_id
        self.game = game


class ConnectionManager:
    def __init__(self):
        self.tables: Dict[str, List[Connection]] = {}
        self.holdem_state: Dict[str, HoldemTableState] = {}

    async def connect(self, websocket: WebSocket, *, game: Optional[str], table: str, nick: str) -> None:
        await websocket.accept()
        table_id = table if table != "new" else f"{game}-table-1"
        
        # Verifica se a mesa está cheia ANTES de adicionar a conexão
        if game == "holdem":
            st = self.holdem_state.setdefault(table_id, HoldemTableState())
            # Verifica se o jogador já está na mesa (reconexão)
            if nick not in st.players:
                # Se não está na mesa, verifica se há espaço
                # IMPORTANTE: Usa > em vez de >= para garantir que não permite 9 jogadores
                if len(st.players) > st.max_players - 1:
                    await websocket.send_text(json.dumps(error_message("Mesa cheia. Máximo de 9 jogadores.")))
                    await websocket.close()
                    return
        
        conn = Connection(websocket, nick, table_id, game or "")
        self.tables.setdefault(table_id, []).append(conn)
        
        # track player in game state
        if game == "holdem":
            st = self.holdem_state.setdefault(table_id, HoldemTableState())
            # Verifica novamente antes de adicionar (proteção extra)
            if nick not in st.players and len(st.players) >= st.max_players:
                # Remove a conexão se não conseguiu adicionar o jogador
                self.tables[table_id] = [c for c in self.tables.get(table_id, []) if c.websocket is not websocket]
                await websocket.send_text(json.dumps(error_message("Mesa cheia. Máximo de 8 jogadores.")))
                await websocket.close()
                return
            success = st.add_player(nick)
            if not success:
                # Remove a conexão se não conseguiu adicionar o jogador
                self.tables[table_id] = [c for c in self.tables.get(table_id, []) if c.websocket is not websocket]
                await websocket.send_text(json.dumps(error_message("Mesa cheia. Máximo de 8 jogadores.")))
                await websocket.close()
                return
        await self.broadcast_state(table_id)

    async def disconnect(self, websocket: WebSocket) -> None:
        for table_id, conns in list(self.tables.items()):
            self.tables[table_id] = [c for c in conns if c.websocket is not websocket]
            if not self.tables[table_id]:
                del self.tables[table_id]

    async def broadcast(self, table_id: str, message: dict) -> None:
        text = json.dumps(message)
        conns = self.tables.get(table_id, [])
        # Remove conexões fechadas durante o broadcast
        active_conns = []
        for c in conns:
            try:
                await c.websocket.send_text(text)
                active_conns.append(c)
            except (RuntimeError, ConnectionError, Exception):
                # Conexão fechada, não adiciona à lista ativa
                pass
        # Atualiza lista removendo conexões fechadas
        if len(active_conns) < len(conns):
            self.tables[table_id] = active_conns

    async def broadcast_state(self, table_id: str) -> None:
        conns = self.tables.get(table_id, [])
        players = [c.nick for c in conns]
        # Hold'em per-connection hole visibility
        st = self.holdem_state.get(table_id)
        for c in conns:
            if st and st.started:
                hole = st.hole.get(c.nick, [])
                winners = st.get_winner() if st.street == "showdown" else None
                call_amt = st.call_amount(c.nick) if c.nick == st.to_act() else None
                dealer_name = st.players[st.dealer_index] if st.players else None
                sb_name = st.get_sb_player() if st.started else None
                bb_name = st.get_bb_player() if st.started else None
                # no showdown, mostra cartas de todos os jogadores (apenas não-folded)
                all_holes = None
                if st.street == "showdown":
                    all_holes = {p: st.hole.get(p, []) for p in st.players if not st.folded.get(p, False)}
                msg = state_message(
                    players=players,
                    started=True,
                    community=st.community,
                    hole_self=hole,
                    pot=st.pot,
                    street=st.street,
                    to_act=st.to_act(),
                    winners=winners,
                    recent_actions=st.recent_actions,
                    call_amount=call_amt,
                    stacks=st.stacks,
                    dealer=dealer_name,
                    sb=sb_name,
                    bb=bb_name,
                    min_raise=st.min_raise_amount() if st.to_act() else None,
                    all_holes=all_holes,
                )
            else:
                dealer_name = st.players[st.dealer_index] if (st and st.players) else None
                sb_name = st.get_sb_player() if (st and st.started) else None
                bb_name = st.get_bb_player() if (st and st.started) else None
                # Só envia community se a mão realmente começou e não está em preflop
                community_cards = []
                if st and st.started and st.street != "preflop":
                    community_cards = st.community
                msg = state_message(
                    players=players,
                    started=bool(st and st.started),
                    community=community_cards,
                    hole_self=[],
                    pot=st.pot if st else 0,
                    street=st.street if st else None,
                    to_act=st.to_act() if st else None,
                    winners=None,
                    recent_actions=st.recent_actions if st else [],
                    call_amount=None,
                    stacks=st.stacks if st else {},
                    dealer=dealer_name,
                    sb=sb_name,
                    bb=bb_name,
                    min_raise=None,
                    all_holes=None,
                )
            try:
                await c.websocket.send_text(json.dumps(msg))
            except (RuntimeError, ConnectionError, Exception):
                # Conexão fechada, remove da lista
                self.tables[table_id] = [conn for conn in self.tables.get(table_id, []) if conn.websocket is not c.websocket]

    async def handle_message(self, websocket: WebSocket, data: str) -> None:
        # MVP: ecoa chat e atualiza estado simples
        try:
            msg = json.loads(data)
        except Exception:
            return
        table_id = None
        for t, conns in self.tables.items():
            if any(c.websocket is websocket for c in conns):
                table_id = t
                break
        if not table_id:
            return
        if msg.get("type") == "chat":
            await self.broadcast(table_id, {"type": "chat", "from": msg.get("from"), "text": msg.get("text")})
        elif msg.get("type") == "start":
            st = self.holdem_state.get(table_id)
            if not st:
                await websocket.send_text(json.dumps(error_message("jogo não suportado ou estado ausente")))
                return
            if not st.players:
                await websocket.send_text(json.dumps(error_message("sem jogadores")))
                return
            # Debug: log dos jogadores e stacks
            print(f"[DEBUG] Iniciar mão - Jogadores na mesa: {len(st.players)}")
            print(f"[DEBUG] Jogadores: {st.players}")
            print(f"[DEBUG] Stacks: {st.stacks}")
            print(f"[DEBUG] Todos os stacks: {[(p, st.stacks.get(p, 'NÃO ENCONTRADO')) for p in st.players]}")
            players_with_stack = [p for p in st.players if st.stacks.get(p, 0) > 0]
            print(f"[DEBUG] Jogadores com stack > 0: {len(players_with_stack)}")
            print(f"[DEBUG] Jogadores com stack: {players_with_stack}")
            
            # Verifica número de jogadores
            if len(st.players) < 2:
                error_msg = f"É necessário pelo menos 2 jogadores para iniciar a mão. Atualmente há {len(st.players)} jogador(es) na mesa: {st.players}"
                print(f"[DEBUG] {error_msg}")
                await websocket.send_text(json.dumps(error_message(error_msg)))
                return
            # Verifica se há jogadores com stack antes de iniciar
            if len(players_with_stack) < 2:
                error_msg = f"É necessário pelo menos 2 jogadores com fichas para iniciar a mão. Há {len(st.players)} jogador(es) na mesa, mas apenas {len(players_with_stack)} têm fichas. Jogadores sem fichas: {[p for p in st.players if st.stacks.get(p, 0) <= 0]}"
                print(f"[DEBUG] {error_msg}")
                await websocket.send_text(json.dumps(error_message(error_msg)))
                return
            st.start_hand()
            await self.broadcast_state(table_id)
        elif msg.get("type") == "action":
            action = msg.get("action")
            st = self.holdem_state.get(table_id)
            if not st:
                await websocket.send_text(json.dumps(error_message("estado não encontrado")))
                return
            elif action in ("check", "call", "fold", "raise", "all_in"):
                amount = msg.get("amount")
                # find nick of sender
                nick = next((c.nick for c in self.tables.get(table_id, []) if c.websocket is websocket), None)
                if nick:
                    st.apply_action(nick, action, amount)
                    # Após ação, verifica se pode avançar automaticamente até showdown
                    await self._auto_advance_to_showdown(st, table_id)
            elif action == "new_hand":
                st.start_hand()
            await self.broadcast_state(table_id)
        else:
            await self.broadcast_state(table_id)
    
    async def _auto_advance_to_showdown(self, st: HoldemTableState, table_id: str) -> None:
        """Avança automaticamente até showdown se todos estão all-in ou não há mais ação possível"""
        # Continua avançando streets enquanto houver jogadores ativos e não estiver no showdown
        max_iterations = 10  # Evita loop infinito
        iteration = 0
        
        while iteration < max_iterations and st.street != "showdown":
            iteration += 1
            active = [p for p in st.players if not st.folded.get(p, False)]
            
            # Se só sobrou 1 jogador, vai para showdown
            if len(active) <= 1:
                st.street = "showdown"
                break
            
            # Se todos ativos estão all-in, avança automaticamente até showdown
            all_all_in = all(st.all_in.get(p, False) for p in active)
            
            if all_all_in:
                # Avança até river/showdown
                while st.street != "showdown":
                    if st.street == "preflop":
                        st.next_street()  # vai para flop
                    elif st.street == "flop":
                        st.next_street()  # vai para turn
                    elif st.street == "turn":
                        st.next_street()  # vai para river
                    elif st.street == "river":
                        st.street = "showdown"
                        break
                break
            
            # Verifica se há alguém para agir
            to_act_player = st.to_act()
            if to_act_player is None:
                # Não há mais ninguém para agir, avança street
                if st.street != "showdown":
                    st.next_street()
                    # Se avançou e ainda não há ninguém para agir, continua
                    if st.to_act() is None and st.street != "showdown":
                        continue
                    else:
                        break
                else:
                    break
            
            # Se chegou aqui, há alguém para agir, para o loop
            break
        
        # Se chegou no showdown, calcula vencedores
        if st.street == "showdown":
            st.get_winner()


