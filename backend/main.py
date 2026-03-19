from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, Field

from backend.models import (
    Quest,
    QuestCategory,
    QuestDifficulty,
    QuestStatus,
    ShopItem,
    User,
    apply_rewards,
    calculate_boss_bonus,
    random_id,
)

app = FastAPI(title="LoveQuest API", version="0.1.0")

users: dict[str, User] = {}
quests: dict[str, Quest] = {}
shop_items: dict[str, ShopItem] = {}


class UserCreate(BaseModel):
    nome: str = Field(min_length=2)
    email: EmailStr
    senha: str = Field(min_length=6)
    partner_id: Optional[str] = None


class QuestCreate(BaseModel):
    titulo: str
    descricao: str
    categoria: QuestCategory
    dificuldade: QuestDifficulty
    recompensa_xp: int = Field(ge=1)
    recompensa_coins: int = Field(ge=0)
    criado_por: str
    atribuido_a: str
    is_daily: bool = False
    is_boss: bool = False


class ShopItemCreate(BaseModel):
    nome: str
    preco: int = Field(ge=1)
    descricao: str
    criado_por: str


class QuestAction(BaseModel):
    user_id: str


class BuyItemAction(BaseModel):
    user_id: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/users", response_model=dict)
def create_user(payload: UserCreate):
    user_id = random_id()
    users[user_id] = User(
        id=user_id,
        nome=payload.nome,
        email=payload.email,
        senha_hash=f"plain::{payload.senha}",
        partner_id=payload.partner_id,
    )
    return {"id": user_id, "nome": payload.nome, "email": payload.email}


@app.get("/users", response_model=List[dict])
def list_users():
    return [
        {
            "id": u.id,
            "nome": u.nome,
            "email": u.email,
            "level": u.level,
            "total_xp": u.total_xp,
            "coins": u.coins,
            "partner_id": u.partner_id,
            "forca": u.forca,
            "destreza": u.destreza,
            "carisma": u.carisma,
        }
        for u in users.values()
    ]


@app.get("/guild/{user_id}")
def guild_dashboard(user_id: str):
    user = users.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    partner = users.get(user.partner_id) if user.partner_id else None
    return {
        "guild": {
            "user": {
                "id": user.id,
                "nome": user.nome,
                "level": user.level,
                "xp": user.total_xp,
                "coins": user.coins,
            },
            "partner": (
                {
                    "id": partner.id,
                    "nome": partner.nome,
                    "level": partner.level,
                    "xp": partner.total_xp,
                    "coins": partner.coins,
                }
                if partner
                else None
            ),
        }
    }


@app.post("/quests", response_model=dict)
def create_quest(payload: QuestCreate):
    if payload.criado_por not in users or payload.atribuido_a not in users:
        raise HTTPException(status_code=400, detail="Usuário criador/atribuído inválido")

    quest_id = random_id()
    quests[quest_id] = Quest(
        id=quest_id,
        titulo=payload.titulo,
        descricao=payload.descricao,
        categoria=payload.categoria,
        dificuldade=payload.dificuldade,
        recompensa_xp=payload.recompensa_xp,
        recompensa_coins=payload.recompensa_coins,
        status=QuestStatus.PENDENTE,
        criado_por=payload.criado_por,
        atribuido_a=payload.atribuido_a,
        is_daily=payload.is_daily,
        is_boss=payload.is_boss,
    )
    return {"id": quest_id, "status": QuestStatus.PENDENTE}


@app.get("/quests", response_model=List[dict])
def list_quests(status: Optional[QuestStatus] = None):
    values = quests.values()
    if status:
        values = [q for q in values if q.status == status]
    return [
        {
            "id": q.id,
            "titulo": q.titulo,
            "descricao": q.descricao,
            "categoria": q.categoria,
            "dificuldade": q.dificuldade,
            "recompensa_xp": q.recompensa_xp,
            "recompensa_coins": q.recompensa_coins,
            "status": q.status,
            "criado_por": q.criado_por,
            "atribuido_a": q.atribuido_a,
            "is_daily": q.is_daily,
            "is_boss": q.is_boss,
            "participants": list(q.participants),
        }
        for q in values
    ]


@app.post("/quests/{quest_id}/join")
def join_boss_fight(quest_id: str, payload: QuestAction):
    quest = quests.get(quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest não encontrada")
    if not quest.is_boss:
        raise HTTPException(status_code=400, detail="Apenas Boss quests aceitam participação")
    if payload.user_id not in (quest.criado_por, quest.atribuido_a):
        raise HTTPException(status_code=403, detail="Usuário não participa desta quest")

    quest.participants.add(payload.user_id)
    return {"quest_id": quest.id, "participants": list(quest.participants)}


@app.post("/quests/{quest_id}/complete")
def complete_quest(quest_id: str, payload: QuestAction):
    quest = quests.get(quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest não encontrada")
    if payload.user_id != quest.atribuido_a:
        raise HTTPException(status_code=403, detail="Apenas usuário atribuído pode concluir")
    if quest.status != QuestStatus.PENDENTE:
        raise HTTPException(status_code=400, detail="Quest não está pendente")

    quest.status = QuestStatus.AGUARDANDO_VALIDACAO
    quest.completed_by = payload.user_id

    validator_id = users[payload.user_id].partner_id
    return {
        "quest_id": quest.id,
        "status": quest.status,
        "message": "Aguardando validação do parceiro para liberar loot",
        "validator_id": validator_id,
    }


@app.post("/quests/{quest_id}/validate")
def validate_quest(quest_id: str, payload: QuestAction):
    quest = quests.get(quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest não encontrada")
    if quest.status != QuestStatus.AGUARDANDO_VALIDACAO:
        raise HTTPException(status_code=400, detail="Quest não está aguardando validação")

    completed_user = users.get(quest.completed_by or "")
    if not completed_user:
        raise HTTPException(status_code=400, detail="Usuário que concluiu não encontrado")
    if payload.user_id != completed_user.partner_id:
        raise HTTPException(status_code=403, detail="Somente parceiro pode validar")

    xp = quest.recompensa_xp
    if quest.is_boss:
        xp = calculate_boss_bonus(xp, joined_participants=len(quest.participants))

    rewards = apply_rewards(
        completed_user,
        xp=xp,
        coins=quest.recompensa_coins,
        category=quest.categoria,
    )
    quest.status = QuestStatus.CONCLUIDA
    quest.validated_by = payload.user_id

    return {
        "quest_id": quest.id,
        "status": quest.status,
        "loot": rewards,
    }


@app.post("/quests/{quest_id}/reject")
def reject_quest(quest_id: str, payload: QuestAction):
    quest = quests.get(quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest não encontrada")

    completed_user = users.get(quest.completed_by or "")
    if not completed_user or payload.user_id != completed_user.partner_id:
        raise HTTPException(status_code=403, detail="Somente parceiro pode rejeitar")

    quest.status = QuestStatus.REJEITADA
    return {"quest_id": quest.id, "status": quest.status}


@app.post("/shop-items", response_model=dict)
def create_shop_item(payload: ShopItemCreate):
    if payload.criado_por not in users:
        raise HTTPException(status_code=404, detail="Criador não encontrado")

    item_id = random_id()
    shop_items[item_id] = ShopItem(
        id=item_id,
        nome=payload.nome,
        preco=payload.preco,
        descricao=payload.descricao,
        criado_por=payload.criado_por,
    )
    return {"id": item_id}


@app.get("/shop-items", response_model=List[dict])
def list_shop_items():
    return [
        {
            "id": s.id,
            "nome": s.nome,
            "preco": s.preco,
            "descricao": s.descricao,
            "criado_por": s.criado_por,
            "comprado": s.comprado,
        }
        for s in shop_items.values()
    ]


@app.post("/shop-items/{item_id}/buy")
def buy_shop_item(item_id: str, payload: BuyItemAction):
    item = shop_items.get(item_id)
    user = users.get(payload.user_id)
    if not item or not user:
        raise HTTPException(status_code=404, detail="Item ou usuário não encontrado")
    if item.comprado:
        raise HTTPException(status_code=400, detail="Item já comprado")
    if user.coins < item.preco:
        raise HTTPException(status_code=400, detail="Moedas insuficientes")

    user.coins -= item.preco
    item.comprado = True
    return {"item_id": item.id, "coins_restantes": user.coins}


@app.post("/quests/daily/generate")
def generate_daily_affection_quest(created_by: str, assigned_to: str):
    suggestions = [
        "Elogiar 3 coisas no parceiro",
        "Planejar 15 minutos de conversa sem celular",
        "Preparar um café/lanche surpresa",
    ]
    title = f"Quest de Afeto {date.today().isoformat()}"
    description = suggestions[hash(date.today().isoformat()) % len(suggestions)]

    quest_id = random_id()
    quests[quest_id] = Quest(
        id=quest_id,
        titulo=title,
        descricao=description,
        categoria=QuestCategory.CARISMA,
        dificuldade=QuestDifficulty.EASY,
        recompensa_xp=30,
        recompensa_coins=10,
        status=QuestStatus.PENDENTE,
        criado_por=created_by,
        atribuido_a=assigned_to,
        is_daily=True,
        is_boss=False,
    )
    return {"id": quest_id, "titulo": title, "descricao": description}
