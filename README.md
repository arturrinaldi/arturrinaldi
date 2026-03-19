# LoveQuest RPG — Gamificação para Casais

Aplicativo estilo RPG para transformar tarefas domésticas e atitudes de afeto em **quests** com XP, moedas e progressão de nível.

## Stack (gratuita para testes)

- **Frontend mobile:** React Native + Expo (teste via Expo Go).
- **Backend API:** FastAPI (Python), pronto para deploy no Render Free.
- **Banco + Auth:** Supabase (PostgreSQL + Auth).

> Este repositório já inclui um backend FastAPI funcional de referência e o schema SQL para Supabase.

## Mecânicas implementadas

- Tarefas viram quests com categoria, dificuldade e recompensa.
- Fluxo de aprovação: quem conclui aguarda validação do parceiro para receber loot.
- Level up progressivo com fórmula:

```txt
XP_proximo = 100 * (level^2)
```

- Atributos por categoria de quest:
  - **Força**: limpeza pesada.
  - **Destreza**: cozinha/reparos.
  - **Carisma**: quests de afeto.
- Daily quest automática de afeto.
- Boss fight colaborativa com bônus de **+20% de XP** quando ambos participam.

## Estrutura de pastas

```txt
backend/
  main.py          # API FastAPI
  models.py        # Regras de domínio (XP, level, validação, atributos)
db/
  schema.sql       # Schema PostgreSQL/Supabase
```

## Rodando backend local

```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
uvicorn backend.main:app --reload
```

Swagger: `http://127.0.0.1:8000/docs`

## Próximos passos no frontend (Expo)

1. Criar app Expo com telas:
   - Login/Cadastro
   - Dashboard da Guilda (nível do casal lado a lado)
   - Lista de Quests
   - Loja de recompensas
2. Consumir os endpoints em `backend/main.py`.
3. Conectar autenticação no Supabase Auth.
4. Deploy backend no Render (free) e apontar base URL no app Expo.
