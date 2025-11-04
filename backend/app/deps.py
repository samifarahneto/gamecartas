import os
import time
from typing import Generator
from sqlmodel import SQLModel
from sqlmodel import create_engine, Session
from sqlalchemy.exc import OperationalError


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)


def init_db() -> None:
    wait_for_db()
    SQLModel.metadata.create_all(bind=engine)


def wait_for_db(retries: int = 30, delay_seconds: float = 1.0) -> None:
    for _ in range(retries):
        try:
            with engine.connect() as conn:
                conn.exec_driver_sql("SELECT 1")
                return
        except OperationalError:
            time.sleep(delay_seconds)
    # last attempt raises if still failing
    with engine.connect() as conn:
        conn.exec_driver_sql("SELECT 1")


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


