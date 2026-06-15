/**
 * Adapter: Por do Sol — dual XLSX (caixa + competência)
 *
 * Lê 3 arquivos do Drive:
 *   1. 2026.xlsx         → movimentações de caixa (debCred C/D)
 *   2. Recebimeto Comp.xls → receita competência (coluna Competencia)
 *   3. Pagamento Comp.xls  → despesa competência (coluna Competencia)
 *
 * Gera movimentos.json com campo `regime` ("caixa" | "competencia") em cada row.
 * O build-data.cjs usa esse campo pra filtrar por regime no runtime.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const XLSX = require('xlsx');

function readSheet(file, sheetIdx) {
  const wb = XLSX.readFile(file, { type: 'binary', codepage: 65001 });
  const sn = wb.SheetNames[sheetIdx || 0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
}

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  // Brazilian format: 1.234,56 → 1234.56
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// dd/mm/yyyy → yyyy-mm-dd
function isoDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 1000) {
    // Excel serial date
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

// ---------- Google Sheets CSV helpers ----------
const MONTH_MAP = {
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
  'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
  'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12',
};

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

function parseCsvLine(line) {
  const fields = [];
  let inQuotes = false, field = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      fields.push(field); field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

function parseBRL(v) {
  if (!v || typeof v !== 'string') return 0;
  const s = v.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function parseGSheetMonth(header) {
  // "junho/26" → "2026-06"
  const m = header.trim().toLowerCase().match(/^(\w+)\/(\d{2,4})$/);
  if (!m) return null;
  const monthNum = MONTH_MAP[m[1]];
  if (!monthNum) return null;
  const year = m[2].length === 2 ? '20' + m[2] : m[2];
  return `${year}-${monthNum}`;
}

function parseGSheetOrcamento(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const monthCols = [];
  for (let i = 1; i < headers.length; i++) {
    const ym = parseGSheetMonth(headers[i]);
    if (ym) monthCols.push({ idx: i, mes: ym });
  }
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const fields = parseCsvLine(lines[li]);
    const conta = (fields[0] || '').trim();
    if (!conta) continue;
    // Skip top-level totals like "2. Despesas" and group headers (XX.XX without children that have 0)
    // Include only rows with code pattern XX.XX or XX.XX.XX that have non-zero values
    if (/^\d+\.\s/.test(conta)) continue; // "2. Despesas" etc
    for (const mc of monthCols) {
      const val = parseBRL(fields[mc.idx] || '');
      if (val === 0) continue;
      rows.push({
        mes: mc.mes,
        departamento: '',
        conta,
        realizado: 0,
        orcamento: val,
        saldo: val,
      });
    }
  }
  return rows;
}

let idSeq = 1;

/**
 * Parse 2026.xlsx (caixa)
 * Columns: id, data, descricao, observacoes, nome, entrada, saida, valor, debCred, descricaoPortador, cnpj, idDocumento, situacao, tipoOrigem
 */
function parseCaixa(rows) {
  const movs = [];
  for (const r of rows) {
    const debCred = String(r.debCred || '').toUpperCase();
    if (!debCred) continue; // skip empty rows
    const natureza = debCred === 'C' ? 'R' : 'P';
    const valorRaw = num(r.valor);
    const valor = Math.abs(valorRaw);
    if (valor === 0) continue;
    const dt = isoDate(r.data);
    if (!dt) continue;

    movs.push({
      id: String(r.id || `cx-${idSeq++}`),
      fonte: 'pordosol-xlsx',
      regime: 'caixa',
      natureza,
      status: 'PAGO',
      realizado: true,
      data_emissao: dt,
      data_vencimento: dt,
      data_pagamento: dt,
      valor_total: valor,
      valor_pago: valor,
      valor_aberto: 0,
      categoria: String(r.descricao || 'Sem categoria').trim(),
      centro_custo: '',
      cliente: String(r.nome || '').trim(),
      conta_corrente: String(r.descricaoPortador || '').trim(),
      codigo_banco: '',
      observacao: String(r.observacoes || '').trim(),
      tags: [],
    });
  }
  return movs;
}

/**
 * Parse Recebimeto Comp.xls / Pagamento Comp.xls (competência)
 * Columns: Observacoes, Data, Valor pago, Data - Documento, Valor, Observacoes(2), Nome, Email, Competencia, Descricao
 * Note: two columns named "Observacoes" — sheet_to_json auto-renames 2nd as "Observacoes_1"
 */
function parseCompetencia(rows, natureza) {
  const movs = [];
  for (const r of rows) {
    // Use Competencia date as the effective date for competência view
    const dtComp = isoDate(r['Competencia'] || r['Competencia '] || r['Competência']);
    if (!dtComp) continue;
    const dtPago = isoDate(r['Data']);
    const valor = num(r['Valor'] || r['Valor pago']);
    if (valor === 0) continue;

    const descricao = String(r['Descricao'] || r['Descrição'] || r['Descricão'] || '').trim();
    if (descricao === '-' || !descricao) continue;

    movs.push({
      id: `comp-${natureza === 'R' ? 'rec' : 'desp'}-${idSeq++}`,
      fonte: 'pordosol-xlsx',
      regime: 'competencia',
      natureza,
      status: 'PAGO',
      realizado: true,
      data_emissao: dtComp,
      data_vencimento: dtComp,
      data_pagamento: dtPago || dtComp,
      valor_total: Math.abs(valor),
      valor_pago: Math.abs(valor),
      valor_aberto: 0,
      categoria: descricao,
      centro_custo: '',
      cliente: String(r['Nome'] || '').trim(),
      conta_corrente: '',
      codigo_banco: '',
      observacao: String(r['Observacoes'] || r['Observacoes_1'] || '').trim(),
      tags: [],
    });
  }
  return movs;
}

module.exports = {
  id: 'pordosol-xlsx',
  label: 'Por do Sol XLSX (caixa + competência)',
  required_env: [],

  validate(config) {
    const errors = [];
    const drive = config.fontes && config.fontes.drive && config.fontes.drive.base_path;
    if (!drive) errors.push('config.fontes.drive.base_path não definido');
    else if (!fs.existsSync(drive)) errors.push(`drive base_path não existe: ${drive}`);

    const cfg = config.fontes && config.fontes['pordosol_xlsx'];
    if (!cfg) { errors.push('config.fontes.pordosol_xlsx não definido'); return { ok: false, errors }; }

    if (drive && fs.existsSync(drive)) {
      const cxFile = path.join(drive, cfg.caixa_file || '2026.xlsx');
      if (!fs.existsSync(cxFile)) errors.push(`caixa file não existe: ${cxFile}`);
      const recFile = path.join(drive, cfg.competencia_receita_file || 'Recebimeto Comp.xls');
      if (!fs.existsSync(recFile)) errors.push(`competência receita file não existe: ${recFile}`);
      const despFile = path.join(drive, cfg.competencia_despesa_file || 'Pagamento Comp.xls');
      if (!fs.existsSync(despFile)) errors.push(`competência despesa file não existe: ${despFile}`);
    }
    return { ok: errors.length === 0, errors };
  },

  async pull(config, dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    const drive = config.fontes.drive.base_path;
    const cfg = config.fontes['pordosol_xlsx'];

    console.log('=== Por do Sol XLSX pull ===');

    // 1. Caixa
    const cxPath = path.join(drive, cfg.caixa_file);
    console.log('Lendo caixa:', cxPath);
    const cxRows = readSheet(cxPath);
    const cxMovs = parseCaixa(cxRows);
    console.log(`  caixa: ${cxRows.length} rows → ${cxMovs.length} movimentos`);

    // 2. Competência receita
    const recPath = path.join(drive, cfg.competencia_receita_file);
    console.log('Lendo competência receita:', recPath);
    const recRows = readSheet(recPath);
    const recMovs = parseCompetencia(recRows, 'R');
    console.log(`  comp receita: ${recRows.length} rows → ${recMovs.length} movimentos`);

    // 3. Competência despesa
    const despPath = path.join(drive, cfg.competencia_despesa_file);
    console.log('Lendo competência despesa:', despPath);
    const despRows = readSheet(despPath);
    const despMovs = parseCompetencia(despRows, 'P');
    console.log(`  comp despesa: ${despRows.length} rows → ${despMovs.length} movimentos`);

    // Filtrar categorias de transferência e aplicações (não são receita/despesa real)
    const EXCLUIR_CATS = [
      '06.02.02 APLICAÇÔES DE RESGATE',
      'Empréstimo',
      'Pagamento de Empréstimo',
    ];
    const EXCLUIR_RE = /transfer[eê]ncia[s]?\s+(entre\s+contas|de\s+sa[ií]da|de\s+entrada)/i;
    const isExcluida = (cat) => EXCLUIR_CATS.includes(cat) || EXCLUIR_RE.test(cat);

    const cxFiltered = cxMovs.filter(m => !isExcluida(m.categoria));
    const recFiltered = recMovs.filter(m => !isExcluida(m.categoria));
    const despFiltered = despMovs.filter(m => !isExcluida(m.categoria));
    const excluded = (cxMovs.length - cxFiltered.length) + (recMovs.length - recFiltered.length) + (despMovs.length - despFiltered.length);
    if (excluded > 0) console.log(`  excluídas ${excluded} transações de transferência/aplicação`);

    // Merge all
    const allMovs = [...cxFiltered, ...recFiltered, ...despFiltered];
    fs.writeFileSync(path.join(dataDir, 'movimentos.json'), JSON.stringify(allMovs, null, 2));

    // Minimal empresa/categorias/clientes
    fs.writeFileSync(path.join(dataDir, 'empresa.json'), JSON.stringify({
      nome_fantasia: config.cliente?.nome || 'Por do Sol',
      fonte: 'pordosol-xlsx',
    }));

    const allCats = [...new Set(allMovs.map(m => m.categoria).filter(Boolean))];
    fs.writeFileSync(path.join(dataDir, 'categorias.json'), JSON.stringify(
      allCats.map(name => ({ codigo: name, descricao: name, tipo: 'mista' })), null, 2
    ));

    const allClientes = [...new Set(allMovs.map(m => m.cliente).filter(Boolean))];
    fs.writeFileSync(path.join(dataDir, 'clientes.json'), JSON.stringify(
      allClientes.map(name => ({ codigo: name, nome_fantasia: name, razao_social: name })), null, 2
    ));

    fs.writeFileSync(path.join(dataDir, 'departamentos.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_correntes.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_pagar.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_receber.json'), JSON.stringify([]));

    // 4. Orçamento x Realizado
    // Estratégia: meses < gsheet_from → XLSX local; meses >= gsheet_from → Google Sheets
    const gsheetFrom = cfg.orcamento_gsheet_from || null; // e.g. "2026-06"
    let orcamentoXlsx = [];

    const orcFile = cfg.orcamento_file ? path.join(drive, cfg.orcamento_file) : null;
    if (orcFile && fs.existsSync(orcFile)) {
      console.log('Lendo orçamento XLSX:', orcFile);
      const sheetName = cfg.orcamento_sheet || 'ORCAMENTO X REALIZADO';
      const orcWb = XLSX.readFile(orcFile, { type: 'binary', codepage: 65001 });
      const matchSheet = orcWb.SheetNames.find(sn => sn.replace(/[ÇçÃãÊêÔô]/g, c => ({Ç:'C',ç:'c',Ã:'A',ã:'a',Ê:'E',ê:'e',Ô:'O',ô:'o'}[c]||c)).toUpperCase() === sheetName.toUpperCase()) || sheetName;
      const orcSheet = orcWb.Sheets[matchSheet] || orcWb.Sheets[orcWb.SheetNames[0]];
      const orcRows = XLSX.utils.sheet_to_json(orcSheet, { defval: '' });

      function serialToYearMonth(v) {
        if (!v && v !== 0) return null;
        if (typeof v === 'number' && v > 1000) {
          const d = new Date((v - 25569) * 86400000);
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          return `${y}-${m}`;
        }
        if (typeof v === 'string') {
          const mm = v.match(/^(\d{4})-(\d{2})/);
          if (mm) return `${mm[1]}-${mm[2]}`;
        }
        return null;
      }

      const colMes = Object.keys(orcRows[0] || {}).find(k => /^M[EÊ]S$/i.test(k)) || 'MES';
      const colOrc = Object.keys(orcRows[0] || {}).find(k => /^OR[CÇ]AMENTO$/i.test(k)) || 'ORCAMENTO';
      for (const r of orcRows) {
        const mes = serialToYearMonth(r[colMes]);
        if (!mes) continue;
        if (!mes.startsWith('2026')) continue;
        const realizado = num(r['REALIZADO']);
        const orcamentoVal = num(r[colOrc]);
        if (realizado === 0 && orcamentoVal === 0) continue;
        const saldo = num(r['SALDO']);
        const departamento = String(r['DEPARTAMENTO'] || '').trim();
        const conta = String(r['CONTAS'] || '').trim();
        if (!conta) continue;
        orcamentoXlsx.push({ mes, departamento, conta, realizado, orcamento: orcamentoVal, saldo });
      }
      console.log(`  orçamento XLSX: ${orcRows.length} rows → ${orcamentoXlsx.length} registros`);
    } else if (orcFile) {
      console.warn(`  [warn] arquivo de orçamento não encontrado: ${orcFile}`);
    }

    // Google Sheets: orçamento a partir de gsheet_from (ex: junho/2026)
    let orcamentoGSheet = [];
    if (cfg.orcamento_gsheet_id && cfg.orcamento_gsheet_gid) {
      const gsheetUrl = `https://docs.google.com/spreadsheets/d/${cfg.orcamento_gsheet_id}/gviz/tq?tqx=out:csv&gid=${cfg.orcamento_gsheet_gid}`;
      try {
        console.log('Buscando orçamento Google Sheets...');
        const csvText = await fetchCsv(gsheetUrl);
        orcamentoGSheet = parseGSheetOrcamento(csvText);
        console.log(`  orçamento Google Sheets: ${orcamentoGSheet.length} registros`);
      } catch (e) {
        console.warn(`  [warn] falha ao buscar Google Sheets: ${e.message}`);
      }
    }

    // Merge: XLSX para meses < gsheet_from, Google Sheets para meses >= gsheet_from
    let orcamento;
    if (gsheetFrom && orcamentoGSheet.length > 0) {
      const xlsxFiltered = orcamentoXlsx.filter(r => r.mes < gsheetFrom);
      const gsheetFiltered = orcamentoGSheet.filter(r => r.mes >= gsheetFrom);
      orcamento = [...xlsxFiltered, ...gsheetFiltered];
      console.log(`  orçamento merged: ${xlsxFiltered.length} XLSX (< ${gsheetFrom}) + ${gsheetFiltered.length} GSheet (>= ${gsheetFrom}) = ${orcamento.length} total`);
    } else {
      orcamento = orcamentoXlsx;
    }

    fs.writeFileSync(path.join(dataDir, 'orcamento.json'), JSON.stringify(orcamento, null, 2));
    console.log(`  orçamento final: ${orcamento.length} registros`);

    fs.writeFileSync(path.join(dataDir, '_summary.json'), JSON.stringify({
      adapter: 'pordosol-xlsx',
      fetched_at: new Date().toISOString(),
      records: allMovs.length,
      caixa: cxMovs.length,
      competencia_receita: recMovs.length,
      competencia_despesa: despMovs.length,
    }, null, 2));

    console.log(`=== Por do Sol XLSX OK: ${allMovs.length} movimentos (${cxMovs.length} caixa + ${recMovs.length} comp.rec + ${despMovs.length} comp.desp) ===`);
    return { fetched: allMovs.length, summary: { adapter: 'pordosol-xlsx', records: allMovs.length } };
  },
};
