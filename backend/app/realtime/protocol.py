from typing import Any, Dict, List, Optional


def state_message(*, players: List[str], started: bool, community: List[str], hole_self: List[str], pot: int = 0, street: Optional[str] = None, to_act: Optional[str] = None, winners: Optional[List[str]] = None, recent_actions: Optional[List[Dict[str, Any]]] = None, call_amount: Optional[int] = None, stacks: Optional[Dict[str, int]] = None, dealer: Optional[str] = None, sb: Optional[str] = None, bb: Optional[str] = None, min_raise: Optional[int] = None, all_holes: Optional[Dict[str, List[str]]] = None) -> Dict[str, Any]:
    return {
        "type": "state",
        "players": players,
        "started": started,
        "community": community,
        "hole": hole_self,
        "pot": pot,
        "street": street,
        "toAct": to_act,
        "winners": winners,
        "recentActions": recent_actions or [],
        "callAmount": call_amount,
        "stacks": stacks or {},
        "dealer": dealer,
        "sb": sb,
        "bb": bb,
        "minRaise": min_raise,
        "allHoles": all_holes or {},
    }

def error_message(text: str) -> Dict[str, Any]:
    return {"type": "error", "text": text}


