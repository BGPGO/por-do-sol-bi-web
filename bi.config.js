// bi.config.js — Por do Sol BI
// Fonte: XLSX manual (caixa + competência de arquivos separados)
module.exports = {
  cliente: {
    nome: "Por do Sol",
    subdomain: "por-do-sol-bi",
    coolify_app_uuid: "tsgnmype6hnqrudr60cyc39f",
    cor_primaria: "#f59e0b",  // amber/sunset
  },

  fontes: {
    adapters: ["pordosol-xlsx"],

    pordosol_xlsx: {
      // Caixa: arquivo único com movimentações de caixa
      caixa_file: "2026.xlsx",
      // Competência: receita e despesa em arquivos separados
      competencia_receita_file: "Recebimeto Comp.xls",
      competencia_despesa_file: "Pagamento Comp.xls",
      // Orçamento x Realizado (XLSX para meses até maio/2026)
      orcamento_file: "FINANCEIRO POR DO SOL.xlsx",
      orcamento_sheet: "ORCAMENTO X REALIZADO",
      // Google Sheets: orçamento a partir de junho/2026
      orcamento_gsheet_id: "1sOjrVQXkoJngO4B8cZd9kmlKLpYGlYne0vrzfuFinWo",
      orcamento_gsheet_gid: "789373136",
      orcamento_gsheet_from: "2026-06",
    },

    drive: {
      base_path: "G:/Meu Drive/BGP/CLIENTES/BI/457. Por do sol/BASES",
    },
  },

  pages: {
    geral: {
      overview: "active",
      receita: "active",
      despesa: "active",
      fluxo: "active",
      tesouraria: "active",
      comparativo: "active",
      relatorio: "active",
      orcamento: "active",
      dre: "active",
      valuation: "hidden",
    },
    outros: {
      indicators: "hidden",
      faturamento_produto: "hidden",
      curva_abc: "hidden",
      marketing: "hidden",
      hierarquia: "hidden",
      detalhado: "hidden",
      profunda_cliente: "hidden",
      crm: "hidden",
    },
  },

  meta: {
    ano_corrente: 2026,
    metas_crm: { mes: 0, ano: 0 },
    valuation_premissas: { wacc: 25, growth_year2: 20, growth_year3: 20, ipca: 4.5, perpetuity_growth: 10 },
  },

  template: {
    version_when_created: "1.0.0",
    version_last_synced: "1.0.0",
  },
};
