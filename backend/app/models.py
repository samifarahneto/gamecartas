from typing import Optional
from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nickname: str


class Table(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    game: str
    max_players: int


class Seat(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    table_id: int
    user_id: int


