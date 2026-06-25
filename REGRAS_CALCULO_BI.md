# Regras de Calculo do BI — Por do Sol

Documento de referencia com todas as regras de negocio, formulas e logicas de calculo aplicadas no dashboard financeiro.

---

## 1. Fonte de Dados

### 1.1 Origem
Os dados vem de planilhas XLSX hospedadas no Google Drive (adapter `pordosol-xlsx`), **nao** de API direta do Bling:

| Arquivo | Conteudo |
|---|---|
| `2026.xlsx` | Movimentacoes de caixa (regime de caixa) |
| `Recebimeto Comp.xls` | Receitas em regime de competencia |
| `Pagamento Comp.xls` | Despesas em regime de competencia |
| `CurvaABCPRodutos.xlsx` | Classificacao ABC de produtos |
| `FaturamentoPorProduto.xlsx` | Faturamento detalhado por produto |
| `MarketingADS.xlsx` | Dados de campanhas Facebook/Instagram |
| `consolidado (33).xlsx` | Pipeline CRM |
| `Saldos.xlsx` | Saldos bancarios |
| `FINANCEIRO POR DO SOL.xlsx` | Orcamento (meses anteriores a Jun/2026) |
| Google Sheets (ID `1sOjrVQXkoJngO4B8cZd9kmlKLpYGlYne0vrzfuFinWo`) | Orcamento (meses a partir de Jun/2026) |

### 1.2 Classificacao das Transacoes
- Coluna `debCred = C` (Credito) → Receita (`natureza: 'R'`)
- Coluna `debCred = D` (Debito) → Despesa (`natureza: 'P'`)
- Regime: cada transacao e marcada como `caixa` ou `competencia`

### 1.3 Exclusoes Automaticas
Categorias removidas automaticamente na importacao:
- `transferencia entre contas`, `transferencia de saida`, `transferencia de entrada`
- `06.02.02 APLICACOES DE RESGATE`
- `Emprestimo`, `Pagamento de Emprestimo`

### 1.4 Estrutura da Transacao
Cada transacao e armazenada como tupla compacta:
```
[kind, mes(yyyy-mm), dia, categoria, cliente, valor, realizado(1|0), fornecedor, centroCusto, regime('c'|'k')]
```
- `kind`: `'r'` = receita, `'d'` = despesa
- `regime`: `'c'` = competencia, `'k'` = caixa
- `realizado`: `1` = pago/recebido, `0` = pendente

---

## 2. Segmentos de Dados

Todos os calculos sao feitos sobre tres segmentos:

| Segmento | Filtro | Uso |
|---|---|---|
| **Realizado** | Apenas transacoes com `realizado = true` | Valores ja efetivados |
| **A pagar/receber** | Apenas transacoes com `realizado = false` | Valores pendentes |
| **Tudo** | Todas as transacoes | Visao completa |

---

## 3. Metricas Globais (Base)

| Metrica | Formula |
|---|---|
| **Receita Total** | `soma(valores onde kind = 'r')` |
| **Despesa Total** | `soma(valores onde kind = 'd')` |
| **Valor Liquido** | `Receita Total - Despesa Total` |
| **Margem Liquida (%)** | `(Valor Liquido / Receita Total) * 100` |
| **Receita por Mes** | Array de 12 posicoes com soma de receitas por mes |
| **Despesa por Mes** | Array de 12 posicoes com soma de despesas por mes |
| **Receita por Dia** | Array de 31 posicoes com soma de receitas por dia do mes |
| **Despesa por Dia** | Array de 31 posicoes com soma de despesas por dia do mes |
| **Saldos Mensais** | Acumulado mensal: `soma(receita - despesa)` progressivo |

---

## 4. Sistema de Filtros

### 4.1 Filtros Globais (Header)
- **Periodo**: Data inicial e final
- **Dia**: Dia inicial e final (dentro do mes)
- **Categoria**: Dropdown com todas as categorias
- **Status**: Realizado / A pagar-receber / Tudo
- **Regime**: Caixa / Competencia

### 4.2 Drilldown
Clicar em graficos aplica filtros contextuais:
- `mes` → filtra por mes especifico
- `categoria` → filtra por categoria
- `cliente` → filtra por cliente
- `fornecedor` → filtra por fornecedor
- `dia` → filtra por dia

Apos drilldown, todas as metricas sao recalculadas em tempo real (~10ms).

---

## 5. Paginas e Calculos por Pagina

### 5.1 Visao Geral (PageOverview)

**Indicadores principais:**

| Indicador | Formula |
|---|---|
| **Receita** | Soma total de receitas |
| **Despesa** | Soma total de despesas |
| **Valor Liquido** | `Receita - Despesa` |
| **Impostos** | Soma de despesas com categoria iniciando em `02.*` |
| **EBITDA** | `Receita - (Despesa - Impostos - Juros/Amortizacao)` |
| **Resultado Operacional** | `EBITDA - Impostos - Juros` |
| **CAPEX** | Soma de despesas com categoria iniciando em `05.*` |
| **Margem Liquida (%)** | `((Receita - Despesa) / Receita) * 100` |

**Componentes do EBITDA:**
- **Impostos**: despesas com categoria `02.*`
- **Juros/Amortizacao**: despesas contendo "AMORTIZA" ou categoria `10.*`
- **CAPEX**: despesas com categoria `05.*`

**Graficos**: Valor liquido mensal, Receita mensal, Despesa mensal, Margem liquida mensal

---

### 5.2 Indicadores (PageIndicators)

- Receita total (barra 100%)
- Despesa total (% da receita)
- Valor liquido
- Margem liquida
- Tendencia mensal da margem
- Grafico barras Receita vs Despesa mensal

---

### 5.3 Receita (PageReceita)

| KPI | Formula |
|---|---|
| **Receita Total** | Soma de todas as receitas filtradas |
| **Media Mensal** | `Receita Total / quantidade de meses com dados` |
| **Qtd Clientes** | Contagem distinta de clientes |
| **Ticket Medio** | `Receita Total / Qtd Clientes` |

**Graficos**: Receita por mes, por categoria (top 12), por cliente (top 12), tabela de transacoes

---

### 5.4 Despesa (PageDespesa)

| KPI | Formula |
|---|---|
| **Despesa Total** | Soma de todas as despesas filtradas |
| **Media Mensal** | `Despesa Total / quantidade de meses com dados` |
| **Qtd Fornecedores** | Contagem distinta de fornecedores |
| **Media por Fornecedor** | `Despesa Total / Qtd Fornecedores` |

**Graficos**: Despesa por mes, por categoria (top 12), por fornecedor (top 12), tabela de transacoes

---

### 5.5 Fluxo de Caixa (PageFluxo)

**Matriz completa** com colunas mensais (Jan-Dez) + Total + Percentual:
- Secao Receitas: todas as categorias de receita com subtotais
- Secao Despesas: todas as categorias de despesa com subtotais
- **Total Liquido por mes**: `receita[mes] - despesa[mes]`

**Calculo de percentuais:**
- **Visao Horizontal**: `valor_categoria / total_secao * 100`
- **Visao Vertical**: `valor / receita_do_mes * 100`

Expansivel ate nivel de cliente/fornecedor individual.

---

### 5.6 Tesouraria (PageTesouraria)

**KPIs:**

| KPI | Descricao |
|---|---|
| **Recebido** | Receitas ja pagas |
| **A Receber** | Receitas pendentes |
| **Pago** | Despesas ja pagas |
| **A Pagar** | Despesas pendentes |

**Saldo Acumulado:**
```
saldoInicial = ultimoSaldoReal - soma(saldosMes[0..ultimoMesComDados])
saldoAcumulado[i] = saldoAcumulado[i-1] + saldosMes[i]
```

**Analise de Risco de Caixa:**
- Varre transacoes futuras para encontrar primeira data com saldo projetado negativo
- Alerta se saldo minimo projetado < 30% do saldo atual
- Mostra dias ate a crise e detalhes da transacao critica

**Projecao:**
```
saldo_projetado = saldo_atual + receita_futura - despesa_futura (mes a mes)
```

**Graficos**: Pulso diario (receita e despesa por dia), saldo acumulado, projecao futura

---

### 5.7 Comparativo (PageComparativo)

Compara dois periodos selecionados pelo usuario (mes, trimestre ou ano).

**Para cada periodo calcula:** Receita Total, Despesa Total, Valor Liquido

**Deltas:**
```
Delta Absoluto = Periodo2 - Periodo1
Delta Percentual = safePct(Periodo2 - Periodo1, Periodo1)
```

**Funcao safePct:**
```
safePct(a, b) = b !== 0 ? (a/b) * 100 : (a !== 0 ? 100 : 0)
```

Detalhamento expansivel por categoria com sub-itens (clientes/fornecedores).

---

### 5.8 Relatorio IA (PageRelatorio)

- Gerado por Claude Opus (API Anthropic) com temperature 0.2
- **7 secoes**: Visao Geral, Receita, Despesa, Fluxo de Caixa, Tesouraria, Comparativo, Conclusao
- As 6 primeiras secoes sao geradas em paralelo; a Conclusao e sequencial (sintetiza as demais)
- Cache: reutiliza arquivo se tiver menos de 1 hora (override com `--force`)
- Selecionavel por periodo (ano + mes opcional)

---

### 5.9 Orcamento (PageOrcamento)

**Fontes:**
- Meses < Jun/2026: XLSX (`FINANCEIRO POR DO SOL.xlsx`)
- Meses >= Jun/2026: Google Sheets

**KPIs:**

| KPI | Formula |
|---|---|
| **Total Orcado** | Soma de todos os valores orcados |
| **Total Realizado** | Soma de todos os valores efetivados |
| **Percentual** | `(Total Realizado / Total Orcado) * 100` |
| **Saldo** | `Total Orcado - Total Realizado` |

**Gauge (velocimetro):**
- Verde: utilizacao < 85%
- Amarelo: utilizacao entre 85% e 100%
- Vermelho: utilizacao > 100%

**Tres visoes:** Analise Geral (grafico barras), Analise Profunda (cards com gauges por categoria), Analise Tabular

---

### 5.10 DRE — Demonstrativo de Resultado (PageDRE)

**Sempre utiliza regime de competencia.**

**Hierarquia de 6 niveis cascata:**

| Nivel | Nome | Calculo |
|---|---|---|
| 1 | **Receita Bruta de Vendas** | Soma das categorias `01.01.*` e `08.01.01` |
| 2 | **Receita Liquida de Vendas** | Receita Bruta + Deducoes (categorias `02.*`) |
| 3 | **Lucro Bruto** | Receita Liquida + Custos (categorias `03.01.*`) |
| 4 | **Lucro/Prejuizo Operacional** | Lucro Bruto + Despesas Operacionais (categorias `03.02.*`, `04.*`, `08.01.02`) |
| 5 | **Lucro/Prejuizo Liquido** | Lucro Operacional + Receitas/Despesas Financeiras (categorias `01.02.*`, `09.*`, `10.01.03`) |
| 6 | **Lucro/Prejuizo Final** | Lucro Liquido + Investimentos/Emprestimos (categorias `05.*`, `10.01.01`, `10.01.02`) |

**Convencao de sinais:**
- Receitas: valor positivo (`+valor`)
- Despesas: valor negativo (`-valor`)

**Analise Vertical (AV%):**
```
AV% = |valor| / |receita_bruta| * 100
```

**Expansivel** ate nivel de categoria individual e cliente/fornecedor.

**Mapeamento completo de categorias:**

| Codigo | Categoria |
|---|---|
| **01.01.01** | Receita Site |
| **01.01.02** | Receita Loja Fisica |
| **01.01.03** | Receita Feiras/Eventos |
| **01.01.04** | Receita Marketplace |
| **01.01.05** | Receita Revendedores |
| **01.01.06** | Receita WhatsApp |
| **01.02.*** | Receitas Financeiras |
| **02.01** | Taxas sobre vendas |
| **02.02** | Simples Nacional |
| **02.03** | Outros impostos |
| **02.04** | Devolucoes |
| **03.01.01** | Materia Prima Rape |
| **03.01.02** | Materia Prima Ervas |
| **03.01.03** | Materia Prima Artesanato |
| **03.01.04** | Materia Prima Fumo |
| **03.01.05** | Produtos para Revenda |
| **03.01.06** | Embalagem Producao |
| **03.01.07** | Manutencao Feitio |
| **03.02.01** | Fretes |
| **03.02.02** | Embalagem Expedicao |
| **04.01.*** | Pro-labore / Retiradas Socio |
| **04.02.*** | Folha (Salarios, 13o, Ferias, VT, VA, Plano Saude, FGTS, INSS, Comissoes, Rescisoes) |
| **04.03.*** | Despesas Administrativas (Aluguel, Telefone, Energia, Agua, Software) |
| **04.04.*** | Assessorias (Contabil, Juridica, Financeira) |
| **04.05.*** | Outras Administrativas (Material, Taxas Bancarias, Reparos) |
| **04.06.*** | Marketing (Agencia, Freelancers, Trafego Pago, Materiais) |
| **04.07.*** | Eventos (Locacao, Mao de Obra Temporaria, Refeicoes) |
| **05.*** | Investimentos (Imoveis, Moveis, Equipamentos) |
| **08.01.01** | Outras Receitas Operacionais |
| **08.01.02** | Outras Despesas Operacionais |
| **09.*** | Nao Operacionais |
| **10.01.01** | Emprestimos |
| **10.01.02** | Amortizacao |
| **10.01.03** | Rendimentos |

---

### 5.11 Valuation — Fluxo de Caixa Descontado (PageValuation)

**Modelo DCF de 5 anos.**

**Dados de entrada (do BI):**
- Receita YTD, Despesa YTD, Resultado YTD
- Margem efetiva: `(resultadoYTD / receitaYTD) * 100`
- Receita anualizada (Ano 1): `receitaYTD * 12 / qtdMeses`

**Premissas editaveis (salvas em localStorage):**

| Premissa | Padrao |
|---|---|
| Crescimento Ano 2 | 20% |
| Crescimento Ano 3 | 20% |
| IPCA (inflacao, usado Anos 4-5) | 4,5% |
| WACC (taxa de desconto) | 25% |
| Crescimento perpetuidade | 10% |
| Margem simulada (opcional) | 15% |

**Projecao de Receita:**
```
Ano 1 = receita anualizada
Ano 2 = Ano1 * (1 + crescimento_ano2 / 100)
Ano 3 = Ano2 * (1 + crescimento_ano3 / 100)
Ano 4 = Ano3 * (1 + ipca / 100)
Ano 5 = Ano4 * (1 + ipca / 100)
```

**Fluxo de Caixa Livre (FCL):**
```
FCL[n] = receita[n] * margem
```

**Valor Presente:**
```
VP[n] = FCL[n] / (1 + WACC)^n
```

**Valor Terminal (Modelo Gordon):**
```
ValorTerminal = FCL[5] * (1 + g) / (WACC - g)
VP_Terminal = ValorTerminal / (1 + WACC)^5
```

**Valor da Empresa:**
```
EnterpriseValue = soma(VP[1..5]) + VP_Terminal
```

---

### 5.12 Faturamento por Produto (PageFaturamentoProduto)

**Fonte**: `FaturamentoPorProduto.xlsx` (filtrado para tipo PEDIDO + status Autorizado)

| KPI | Formula |
|---|---|
| **Total Vendas** | Soma dos valores de venda |
| **Quantidade Vendida** | Soma das quantidades |
| **Ticket Medio** | `totalValor / quantidadeNFs` |

**Rankings**: Por produto, por vendedor, por familia. Matriz Produto x Mes.

---

### 5.13 Curva ABC (PageCurvaABC)

**Fonte**: `CurvaABCPRodutos.xlsx`

**Regra de classificacao (80/15/5):**
Recalculada do zero (nao usa labels da planilha):
1. Ordena produtos por valor decrescente
2. Calcula % acumulado
3. Classifica:
   - **Classe A**: primeiros 80% do acumulado
   - **Classe B**: de 80% a 95%
   - **Classe C**: de 95% a 100%

**Graficos**: Curva acumulada, tabelas filtradas por classe

---

### 5.14 Marketing ADS (PageMarketing)

**Fonte**: `MarketingADS.xlsx` (Facebook/Instagram Ads)

| KPI | Formula |
|---|---|
| **CPM** | `(gastoTotal / impressoesTotal) * 1000` |
| **CPC** | `gastoTotal / cliquesTotal` |
| **Frequencia** | `impressoesTotal / alcanceTotal` |

**Graficos**: Rankings por cliques de campanha, leads por anuncio, CPM vs Investimento

---

### 5.15 CRM (PageCRM)

**Fonte**: `consolidado (33).xlsx`

**Funil de vendas (fases consideradas):**
```
03 Proposta → 04 Negociacao → 05 Aguardando Pedido → 06 Conclusao
```
Fases 01 (Prospect) e 02 (Qualificacao) sao excluidas.

**Classificacao de oportunidades:**
- **Ganho**: situacao comeca com "Conquistado"
- **Perdido**: possui motivo (diferente de N/D) e nao e ganho
- **Aberto**: nem ganho nem perdido

| KPI | Formula |
|---|---|
| **Leads** | Total de oportunidades |
| **Taxa de Conversao** | `ganhos / leads * 100` |
| **Pipeline** | Soma total dos tickets |
| **Ticket Ganho** | Soma dos tickets ganhos |

**Metas comerciais:**
- Mensal: R$ 1.000.000
- Anual: R$ 12.000.000

**Detalhamentos**: Por vendedor, por origem, por motivo de perda

---

### 5.16 Analise Profunda de Cliente (PageProfundaCliente)

- Filtra transacoes de receita (`kind = 'r'`)
- Agrega por nome de cliente
- Filtravel por periodo (range de meses), cliente especifico e status

---

### 5.17 Hierarquia de Campanhas (PageHierarquia)

Visualizacao em arvore:
```
Campanha → Conjunto de Anuncios → Anuncio → Metricas (Alcance/Impressoes/Valor)
```
Renderizado em SVG com conectores Bezier.

---

### 5.18 Detalhado (PageDetalhado)

- Cruza familias de faturamento com classificacao ABC
- Matriz Produto x Mes com quantidades e badges ABC

---

## 6. Pipeline de Dados

```
1. fetch-data.cjs
   └─ Chama adapter pordosol-xlsx
   └─ Le planilhas XLSX do Google Drive
   └─ Grava data/movimentos.json (formato canonico)

2. build-data.cjs
   └─ Le data/*.json
   └─ Calcula agregacoes (receita, despesa, saldos, rankings)
   └─ Grava data.js (carregado pelo browser)

3. build-data-extras.cjs
   └─ Le planilhas adicionais (ABC, Faturamento, Marketing, CRM, Saldos, Orcamento)
   └─ Grava data-extras.js

4. generate-report.cjs
   └─ Executa data.js em sandbox Node VM
   └─ Envia dados para API Claude Opus
   └─ Grava report.json / report-YYYY-MM.json
```

---

## 7. Paginas Ativas vs Ocultas

| Status | Paginas |
|---|---|
| **Ativas** | Visao Geral, Receita, Despesa, Fluxo de Caixa, Tesouraria, Comparativo, Relatorio IA, Orcamento, DRE |
| **Ocultas** | Valuation, Indicadores, Faturamento Produto, Curva ABC, Marketing, Hierarquia, Detalhado, Analise Profunda Cliente, CRM |

Paginas ocultas podem ser ativadas por configuracao. Paginas `upsell` exibem tela promocional com botao de contratacao.
