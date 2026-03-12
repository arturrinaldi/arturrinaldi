# Gestão de Cookies e Biscoitos

Aplicação web simples (HTML/CSS/JS) para uso pessoal no PC e no celular, com foco em:

- Cadastro de produtos (cookies e biscoitos com sabor, preço e estoque).
- Registro rápido de vendas para dar baixa no estoque em tempo real.
- Registro de compras de ingredientes para acompanhar gastos.
- Dashboard com indicadores de receita, gastos e lucro estimado.
- Gráficos de lucro/gasto mensal e produtos mais vendidos.

## Como executar localmente

Como é um projeto estático, basta servir os arquivos.

Exemplo com Python:

```bash
python3 -m http.server 4173
```

Depois acesse `http://localhost:4173`.

## Deploy na Vercel

Você pode subir este repositório diretamente na Vercel como projeto estático.

1. Importe o repositório na Vercel.
2. Framework preset: **Other**.
3. Build command: vazio.
4. Output directory: `/` (raiz).

Pronto: o site ficará acessível pelo celular e PC.
