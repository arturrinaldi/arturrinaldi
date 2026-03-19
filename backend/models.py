from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from math import floor
from typing import Dict, Optional
from uuid import uuid4


class QuestCategory(str, Enum):
    FORCA = "Força"
    DESTREZA = "Destreza"
    CARISMA = "Carisma"


class QuestDifficulty(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"
    BOSS = "Boss"


class QuestStatus(str, Enum):
    PENDENTE = "Pendente"
    AGUARDANDO_VALIDACAO = "Aguardando_Validacao"
    CONCLUIDA = "Concluida"
    REJEITADA = "Rejeitada"


@dataclass
class User:
    id: str
    nome: str
    email: str
    senha_hash: str
    level: int = 1
    total_xp: int = 0
    coins: int = 0
    partner_id: Optional[str] = None
    forca: int = 0
    destreza: int = 0
    carisma: int = 0


@dataclass
class Quest:
    id: str
    titulo: str
    descricao: str
    categoria: QuestCategory
    dificuldade: QuestDifficulty
    recompensa_xp: int
    recompensa_coins: int
    status: QuestStatus
    criado_por: str
    atribuido_a: str
    completed_by: Optional[str] = None
    validated_by: Optional[str] = None
    is_daily: bool = False
    is_boss: bool = False
    participants: set[str] = field(default_factory=set)


@dataclass
class ShopItem:
    id: str
    nome: str
    preco: int
    descricao: str
    criado_por: str
    comprado: bool = False


def next_level_xp(level: int) -> int:
    return 100 * (level**2)


def apply_rewards(user: User, xp: int, coins: int, category: QuestCategory) -> Dict[str, int]:
    user.total_xp += xp
    user.coins += coins

    if category == QuestCategory.FORCA:
        user.forca += xp
    elif category == QuestCategory.DESTREZA:
        user.destreza += xp
    elif category == QuestCategory.CARISMA:
        user.carisma += xp

    levels_gained = 0
    while user.total_xp >= next_level_xp(user.level):
        user.level += 1
        levels_gained += 1

    return {
        "xp_ganho": xp,
        "coins_ganhas": coins,
        "novo_level": user.level,
        "levels_subidos": levels_gained,
        "xp_para_proximo": max(0, next_level_xp(user.level) - user.total_xp),
    }


def calculate_boss_bonus(base_xp: int, joined_participants: int) -> int:
    if joined_participants >= 2:
        return floor(base_xp * 1.2)
    return base_xp


def random_id() -> str:
    return str(uuid4())
