from pydantic import BaseModel


class CreateTable(BaseModel):
    game: str
    max_players: int = 4


class TableOut(BaseModel):
    id: int
    game: str
    max_players: int


