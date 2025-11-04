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
        # Armazena informações de mesas criadas (mesmo que vazias)
        self.created_tables: Dict[str, Dict] = {}  # {table_id: {game, name, created_at}}

    async def connect(self, websocket: WebSocket, *, game: Optional[str], table: str, nick: str) -> None:
        await websocket.accept()
        table_id = table if table != "new" else f"{game}-table-1"
        
        # Adiciona a conexão primeiro
        conn = Connection(websocket, nick, table_id, game or "")
        self.tables.setdefault(table_id, []).append(conn)
        
        # track player in game state
        if game == "holdem":
            st = self.holdem_state.setdefault(table_id, HoldemTableState())
            
            # Remove jogadores desconectados da lista antes de verificar
            # (jogadores que estão em st.players mas não estão mais conectados)
            connected_nicks = [c.nick for c in self.tables.get(table_id, [])]
            st.players = [p for p in st.players if p in connected_nicks]
            
            # Verifica se o jogador já está na mesa (reconexão)
            if nick not in st.players:
                # Se não está na mesa, verifica se há espaço
                # Permite até max_players jogadores (9 no caso padrão)
                print(f"[DEBUG] Tentando adicionar jogador {nick}. Jogadores atuais: {len(st.players)}/{st.max_players}, Lista: {st.players}")
                if len(st.players) >= st.max_players:
                    # Remove a conexão se não conseguiu adicionar o jogador
                    self.tables[table_id] = [c for c in self.tables.get(table_id, []) if c.websocket is not websocket]
                    print(f"[DEBUG] Mesa cheia! {len(st.players)} >= {st.max_players}. Removendo conexão.")
                    await websocket.send_text(json.dumps(error_message(f"Mesa cheia. Máximo de {st.max_players} jogadores.")))
                    await websocket.close()
                    return
            
            # Verifica novamente antes de adicionar (proteção extra)
            if nick not in st.players and len(st.players) >= st.max_players:
                # Remove a conexão se não conseguiu adicionar o jogador
                self.tables[table_id] = [c for c in self.tables.get(table_id, []) if c.websocket is not websocket]
                await websocket.send_text(json.dumps(error_message(f"Mesa cheia. Máximo de {st.max_players} jogadores.")))
                await websocket.close()
                return
            success = st.add_player(nick)
            if not success:
                # Remove a conexão se não conseguiu adicionar o jogador
                self.tables[table_id] = [c for c in self.tables.get(table_id, []) if c.websocket is not websocket]
                await websocket.send_text(json.dumps(error_message(f"Mesa cheia. Máximo de {st.max_players} jogadores.")))
                await websocket.close()
                return
        await self.broadcast_state(table_id)

    async def disconnect(self, websocket: WebSocket) -> None:
        for table_id, conns in list(self.tables.items()):
            # Remove a conexão
            disconnected_nick = None
            for c in conns:
                if c.websocket is websocket:
                    disconnected_nick = c.nick
                    break
            self.tables[table_id] = [c for c in conns if c.websocket is not websocket]
            if not self.tables[table_id]:
                del self.tables[table_id]
                # Se não há mais conexões, reseta o estado do jogo
                if table_id in self.holdem_state:
                    st = self.holdem_state[table_id]
                    st.started = False
                    st.community = []
                    st.hole = {}
                    st.street = "preflop"
            else:
                # Se ainda há conexões mas a mão estava ativa, verifica se precisa resetar
                if table_id in self.holdem_state:
                    st = self.holdem_state[table_id]
                    # Se não há mais jogadores conectados que estavam na mão, reseta
                    active_players_in_hand = [p for p in st.players if any(c.nick == p for c in self.tables.get(table_id, []))]
                    if st.started and len(active_players_in_hand) < 2:
                        st.started = False
                        st.community = []
                        st.hole = {}
                        st.street = "preflop"
                        await self.broadcast_state(table_id)

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
        # Usa a lista de jogadores do estado do jogo, não das conexões
        # Isso garante que apenas jogadores realmente no jogo recebam cartas
        st = self.holdem_state.get(table_id)
        if st:
            # Sincroniza jogadores: apenas jogadores conectados E no estado do jogo
            players = [p for p in st.players if any(c.nick == p for c in conns)]
        else:
            # Se não há estado, usa jogadores conectados
            players = [c.nick for c in conns]
        
        # Hold'em per-connection hole visibility
        for c in conns:
            if st and st.started:
                # Só envia cartas se o jogador está realmente no jogo (estava na mesa quando a mão começou)
                hole = st.hole.get(c.nick, []) if c.nick in st.players else []
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
                # Reseta o estado antes de iniciar nova mão
                st.started = False
                st.community = []
                st.hole = {}
                st.street = "preflop"
                st.pot = 0
                st.bets = {}
                st.total_committed = {p: 0 for p in st.players}
                st.folded = {}
                st.all_in = {p: False for p in st.players}
                st.recent_actions = []
                # Inicia nova mão
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

    def create_table(self, table_id: str, game: str, name: Optional[str] = None) -> Dict:
        """Cria uma nova mesa (mesmo que vazia)"""
        if table_id in self.created_tables:
            return {"error": "Mesa já existe"}
        
        # Inicializa o estado do jogo se for holdem
        if game == "holdem":
            self.holdem_state.setdefault(table_id, HoldemTableState())
        
        # Armazena informações da mesa
        self.created_tables[table_id] = {
            "game": game,
            "name": name or table_id,
            "created_at": None  # Poderia usar datetime se necessário
        }
        
        # Inicializa lista vazia de conexões se não existir
        if table_id not in self.tables:
            self.tables[table_id] = []
        
        return {
            "id": table_id,
            "game": game,
            "name": name or table_id,
            "players": [],
            "player_count": 0,
            "max_players": 9 if game == "holdem" else 4,
            "started": False,
        }

    def get_tables_info(self) -> List[Dict]:
        """Retorna informações de todas as salas/tabelas (incluindo vazias)"""
        tables = []
        
        # Adiciona mesas criadas (mesmo que vazias)
        for table_id, table_info in self.created_tables.items():
            conns = self.tables.get(table_id, [])
            game = table_info.get("game", "unknown")
            players = [c.nick for c in conns]
            
            # Obtém informações do estado do jogo se for holdem
            started = False
            if game == "holdem" and table_id in self.holdem_state:
                st = self.holdem_state[table_id]
                started = st.started
                players = st.players.copy()
            
            table_data = {
                "id": table_id,
                "game": game,
                "name": table_info.get("name", table_id),
                "players": players,
                "player_count": len(players),
                "max_players": 9 if game == "holdem" else 4,
                "started": started,
            }
            tables.append(table_data)
        
        # Adiciona mesas que têm conexões mas não foram criadas explicitamente (legacy)
        for table_id, conns in self.tables.items():
            if table_id not in self.created_tables and conns:
                game = conns[0].game if conns else "unknown"
                players = [c.nick for c in conns]
                
                # Obtém informações do estado do jogo se for holdem
                started = False
                if game == "holdem" and table_id in self.holdem_state:
                    st = self.holdem_state[table_id]
                    started = st.started
                    players = st.players.copy()
                
                table_data = {
                    "id": table_id,
                    "game": game,
                    "name": table_id,
                    "players": players,
                    "player_count": len(players),
                    "max_players": 9 if game == "holdem" else 4,
                    "started": started,
                }
                tables.append(table_data)
        
        return tables

    def get_table_info(self, table_id: str) -> Optional[Dict]:
        """Retorna informações detalhadas de uma sala específica"""
        # Verifica se a mesa foi criada (mesmo que vazia)
        if table_id not in self.created_tables and table_id not in self.tables:
            return None
        
        # Obtém informações da mesa criada ou usa defaults
        if table_id in self.created_tables:
            table_info_data = self.created_tables[table_id]
            game = table_info_data.get("game", "unknown")
        else:
            # Mesa legacy (não foi criada explicitamente)
            conns = self.tables.get(table_id, [])
            if not conns:
                return None
            game = conns[0].game if conns else "unknown"
        
        conns = self.tables.get(table_id, [])
        players = [c.nick for c in conns] if conns else []
        
        # Obtém informações do estado do jogo se for holdem
        started = False
        street = None
        pot = 0
        dealer = None
        sb = None
        bb = None
        
        if game == "holdem" and table_id in self.holdem_state:
            try:
                st = self.holdem_state[table_id]
                started = getattr(st, "started", False)
                street = getattr(st, "street", None)
                pot = getattr(st, "pot", 0)
                dealer = getattr(st, "dealer", None)
                sb = getattr(st, "sb", None)
                bb = getattr(st, "bb", None)
                # Atualiza players do estado do jogo se existir
                if hasattr(st, "players"):
                    players = st.players.copy() if st.players else []
            except Exception as e:
                # Se houver erro ao acessar o estado, usa valores padrão
                print(f"[ERROR] Erro ao acessar estado da mesa {table_id}: {e}")
                started = False
                street = None
                pot = 0
                dealer = None
                sb = None
                bb = None
                # Garante que players está definido
                if not players:
                    players = []
        
        # Determina slots disponíveis (1-9 para holdem, 1-4 para sueca)
        max_players = 9 if game == "holdem" else 4
        # Slots ocupados são baseados na ordem dos jogadores (1 = primeiro, 2 = segundo, etc)
        occupied_slots = list(range(1, len(players) + 1))
        available_slots = [i for i in range(1, max_players + 1) if i not in occupied_slots]
        
        # Obtém nome da mesa se foi criada explicitamente
        table_name = None
        if table_id in self.created_tables:
            table_name = self.created_tables[table_id].get("name", table_id)
        
        table_info = {
            "id": table_id,
            "game": game,
            "name": table_name or table_id,
            "players": players,
            "player_count": len(players),
            "max_players": max_players,
            "started": started,
            "street": street,
            "pot": pot,
            "dealer": dealer,
            "sb": sb,
            "bb": bb,
            "occupied_slots": list(occupied_slots),
            "available_slots": available_slots,
        }
        return table_info


