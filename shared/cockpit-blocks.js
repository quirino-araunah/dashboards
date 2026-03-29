/* ══════════════════════════════════════════════════════════
   COCKPIT BLOCKS JS v4 — Araunah TV Dashboard
   Depends on: tv-base.js (sbFetch, formatters, clock, etc.)
   ══════════════════════════════════════════════════════════ */

var DATA = {};
var COLAB = [];
var VERT_CONSULTORES = [];
var NOW = new Date();
var YEAR = NOW.getFullYear();
var MONTH = NOW.getMonth() + 1;
var MONTH_STR = YEAR + '-' + String(MONTH).padStart(2, '0');
var TODAY_STR = NOW.toISOString().slice(0, 10);
var MONTH_NAMES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
var MONTH_NAMES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var _feedItems = [];
var _feedPollTimer = null;
var _prevFeedCount = 0;
var _prevFatDiaCount = 0;
var _audioCtx = null;

/* ═══ AUDIO (Web Audio API beep) ═══ */
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return _audioCtx;
}

function playBeep(freq, duration) {
  var ctx = getAudioCtx();
  if (!ctx) return;
  try {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq || 880;
    osc.type = 'sine';
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (duration || 0.3));
    osc.stop(ctx.currentTime + (duration || 0.3));
  } catch(e) {}
}

function playSoundNF() { playBeep(1200, 0.15); setTimeout(function(){ playBeep(1600, 0.1); }, 160); }
function playSoundCheckin() { playBeep(800, 0.2); setTimeout(function(){ playBeep(1000, 0.15); }, 220); }
function playSoundFeed() { playBeep(660, 0.1); }

/* ═══ FOTO MAPPING ═══ */
function fotoUrl(nome) {
  if (!nome) return '';
  var parts = nome.toLowerCase().replace(/[áàãâ]/g,'a').replace(/[éèê]/g,'e').replace(/[íìî]/g,'i').replace(/[óòõô]/g,'o').replace(/[úùû]/g,'u').split(/\s+/);
  if (parts.length >= 2) return 'public/fotos/' + parts[0] + '_' + parts[1] + '.jpg';
  return '';
}

/* ═══ BIZ DAYS ═══ */
function bizDaysInRange(start, end) {
  var count = 0;
  var d = new Date(start);
  while (d <= end) {
    var dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/* ═══ DOW NAMES ═══ */
var DOW_NAMES = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

/* ═══ IS VERTICAL CONSULTANT ═══ */
function isVertConsultor(nome, vertFilter) {
  if (!vertFilter) return true;
  for (var i = 0; i < VERT_CONSULTORES.length; i++) {
    var cn = VERT_CONSULTORES[i].nome_agrupado || VERT_CONSULTORES[i].nome || '';
    if (cn && nome && nome.toUpperCase().indexOf(cn.toUpperCase()) >= 0) return true;
    if (cn && nome && cn.toUpperCase().indexOf(nome.toUpperCase()) >= 0) return true;
  }
  return false;
}

/* ═══ LOAD ALL DATA ═══ */
function loadDashboard(cfg) {
  NOW = new Date();
  YEAR = NOW.getFullYear();
  MONTH = NOW.getMonth() + 1;
  MONTH_STR = YEAR + '-' + String(MONTH).padStart(2, '0');
  TODAY_STR = NOW.toISOString().slice(0, 10);

  var vertFilter = cfg.vertical || null;
  var yearStr = String(YEAR);
  var pending = 0;

  function done() {
    pending--;
    if (pending <= 0) {
      renderAll(cfg);
      var el = document.getElementById('loading');
      if (el) el.style.display = 'none';
      startClock();
      startCountdown(function() { loadDashboard(cfg); });
      if (!_feedPollTimer) startFeedPoll(cfg);
    }
  }

  // 1. Colaboradores
  pending++;
  sbFetch('colaboradores', 'ativo=eq.true&select=nome,nome_agrupado,nome_curto,vertical,foto_url,perfil,celular').then(function(data) {
    COLAB = data || [];
    if (vertFilter) {
      VERT_CONSULTORES = COLAB.filter(function(c) { return normalizeVertical(c.vertical) === vertFilter; });
    } else {
      VERT_CONSULTORES = COLAB.filter(function(c) {
        var v = normalizeVertical(c.vertical);
        return v === 'AGRO' || v === 'AGUA' || v === 'FLORESTAS' || v === 'CORPORATIVO';
      });
    }
    done();
  }).catch(function(){ done(); });

  // 2. Plan vs Real by Vertical
  pending++;
  var pvp = vertFilter ? 'vertical=eq.' + vertFilter + '&id_tempo=like.' + yearStr + '-*' : 'id_tempo=like.' + yearStr + '-*';
  sbFetch('vw_plan_vs_real_vertical', pvp).then(function(d) { DATA.planVertical = d || []; done(); }).catch(function(){ done(); });

  // 3. Plan vs Real by Consultor
  pending++;
  var pcp = 'vendedor_ativo=eq.true&id_tempo=like.' + yearStr + '-*';
  if (vertFilter) pcp = 'vertical=eq.' + vertFilter + '&' + pcp;
  sbFetch('vw_plan_vs_real_consultor', pcp).then(function(d) { DATA.planConsultor = d || []; done(); }).catch(function(){ done(); });

  // 4. Movimento Fiscal
  pending++;
  var mfp = 'id_tempo=like.' + yearStr + '-*';
  if (vertFilter) mfp = 'vertical=eq.' + vertFilter + '&' + mfp;
  sbFetch('vw_movimento_fiscal', mfp).then(function(d) {
    DATA.movimento = (d || []).map(function(r) {
      r.consultor = r.consultor_agrupado || r.representante || '';
      r.vendedor = r.representante || '';
      r._valor = safeNum(r.receita_liquida);
      r._frete = safeNum(r.frete_rateado);
      return r;
    });
    done();
  }).catch(function(){ done(); });

  // 5. Carteira
  pending++;
  sbFetch('vw_carteira_pedidos_unificada', 'status_pedido=not.in.(CANCELADO,ENTREGUE,FATURADO,cancelado,entregue,faturado)').then(function(d) {
    DATA.carteira = (d || []).map(function(r) {
      r.consultor = r.representante || r.consultor || '';
      r.vendedor = r.representante || '';
      return r;
    });
    done();
  }).catch(function(){ done(); });

  // 6. Plan vs Real by Cliente
  pending++;
  var clp = vertFilter ? 'vertical=eq.' + vertFilter : '';
  sbFetch('vw_plan_vs_real_cliente', clp).then(function(d) { DATA.planCliente = d || []; done(); }).catch(function(){ done(); });

  // 7. Plan vs Real by Produto
  pending++;
  var prp = 'id_tempo=like.' + yearStr + '-*';
  if (vertFilter) prp = 'vertical=eq.' + vertFilter + '&' + prp;
  sbFetch('vw_plan_vs_real_produto', prp).then(function(d) { DATA.planProduto = d || []; done(); }).catch(function(){ done(); });

  // 8. Locação (sempre carregar)
  pending++;
  sbFetch('vw_locacao_completa', 'id_tempo=like.' + yearStr + '-*').then(function(d) { DATA.locacao = d || []; done(); }).catch(function(){ done(); });

  // 9. Leads
  pending++;
  sbFetch('leads', 'status=not.in.(Ganho,Perdido,Cancelado,Inativo)&select=id,nome,telefone,produto,consultor_nome,etapa,status,temperatura,data_entrada,ultimo_contato,cidade,uf,classificacao').then(function(d) {
    DATA.leads = d || [];
    done();
  }).catch(function(){ done(); });

  // 10. Atividades (30 dias)
  pending++;
  var d30 = new Date(); d30.setDate(d30.getDate() - 30);
  var d30str = d30.toISOString().slice(0, 10);
  sbFetch('atividades', 'data=gte.' + d30str + '&select=id,consultor_nome,tipo,data,hora,status,lead_nome,dados_checkin,descricao').then(function(d) {
    DATA.atividades = d || [];
    done();
  }).catch(function(){ done(); });

  // 11. Pedidos Emitidos (recent)
  pending++;
  sbFetch('pedidos_emitidos', 'order=created_at.desc&limit=50&select=id,numero,cliente_nome,consultor_nome,vertical,total,produtos,status,created_at,observacao').then(function(d) {
    DATA.pedidosEmitidos = d || [];
    done();
  }).catch(function(){ done(); });

  // 12. Fretes Controle
  pending++;
  sbFetch('fretes_controle', 'select=id,cliente,nota,transportadora,valor_cobrado,status,status_cotacao,data_saida,previsao_entrega,codigo_rastreio,created_at').then(function(d) {
    DATA.fretes = d || [];
    done();
  }).catch(function(){ done(); });

  // 13. Movimento ano anterior (comparativo)
  pending++;
  var prevYear = String(YEAR - 1);
  sbFetch('vw_movimento_fiscal', 'id_tempo=like.' + prevYear + '-*').then(function(d) {
    DATA.movimentoPrev = (d || []).map(function(r) {
      r._valor = safeNum(r.receita_liquida);
      return r;
    });
    done();
  }).catch(function(){ done(); });

  // 14. Movimento 2 anos atrás (comparativo 3 anos)
  pending++;
  var prevYear2 = String(YEAR - 2);
  sbFetch('vw_movimento_fiscal', 'id_tempo=like.' + prevYear2 + '-*').then(function(d) {
    DATA.movimentoPrev2 = (d || []).map(function(r) {
      r._valor = safeNum(r.receita_liquida);
      return r;
    });
    done();
  }).catch(function(){ done(); });

  // Force-render after 25s
  setTimeout(function() {
    var el = document.getElementById('loading');
    if (el && el.style.display !== 'none') {
      el.style.display = 'none';
      renderAll(cfg);
    }
  }, 25000);
}

/* ═══ COMPUTE ALL KPIs ═══ */
function computeAllKPIs(cfg) {
  var vertFilter = cfg.vertical || null;
  var movAll = DATA.movimento || [];
  var planAll = DATA.planVertical || [];

  var mov = vertFilter ? movAll.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; }) : movAll;
  var plan = vertFilter ? planAll.filter(function(p) { return normalizeVertical(p.vertical || '') === vertFilter; }) : planAll;

  // Monthly
  var movMonth = mov.filter(function(m) { return (m.id_tempo || '').startsWith(MONTH_STR); });
  var realMonth = movMonth.reduce(function(s, m) { return s + m._valor; }, 0);
  var freteMonth = movMonth.reduce(function(s, m) { return s + m._frete; }, 0);
  var planMonth = plan.filter(function(p) { return (p.id_tempo || '') === MONTH_STR; });
  var metaMonth = planMonth.reduce(function(s, p) { return s + safeNum(p.meta); }, 0);

  // YTD
  var ytdMonths = [];
  for (var i = 1; i <= MONTH; i++) ytdMonths.push(YEAR + '-' + String(i).padStart(2, '0'));
  var movYTD = mov.filter(function(m) { return ytdMonths.indexOf(m.id_tempo) >= 0; });
  var realYTD = movYTD.reduce(function(s, m) { return s + m._valor; }, 0);
  var freteYTD = movYTD.reduce(function(s, m) { return s + m._frete; }, 0);
  var metaYTD = plan.filter(function(p) { return ytdMonths.indexOf(p.id_tempo) >= 0; })
    .reduce(function(s, p) { return s + safeNum(p.meta); }, 0);

  // Annual
  var realAno = mov.reduce(function(s, m) { return s + m._valor; }, 0);
  var freteAno = mov.reduce(function(s, m) { return s + m._frete; }, 0);
  var metaAno = plan.reduce(function(s, p) { return s + safeNum(p.meta); }, 0);

  // Locação (sempre incluir nos totais)
  var locMonth = 0, locYTD = 0, locAno = 0;
  (DATA.locacao || []).forEach(function(r) {
    var v = safeNum(r.vlr_liquido);
    locAno += v;
    var parts = (r.id_tempo || '').split('-');
    var lMonth = parseInt(parts[1]) || 0;
    if (lMonth <= MONTH) locYTD += v;
    if (lMonth === MONTH) locMonth += v;
  });
  realMonth += locMonth;
  realYTD += locYTD;
  realAno += locAno;

  // Projeção
  var monthStart = new Date(YEAR, MONTH - 1, 1);
  var monthEnd = new Date(YEAR, MONTH, 0);
  var bizElapsed = bizDaysInRange(monthStart, NOW);
  var bizTotal = bizDaysInRange(monthStart, monthEnd);
  var bizLeft = bizTotal - bizElapsed;
  var rate = bizElapsed > 0 ? realMonth / bizElapsed : 0;
  var projecao = realMonth + rate * bizLeft;

  // Carteira
  var cart = DATA.carteira || [];
  if (vertFilter) cart = cart.filter(function(c) { return isVertConsultor(c.consultor, vertFilter); });
  var carteiraTotal = cart.reduce(function(s, c) { return s + safeNum(c.valor || c.vlr_total); }, 0);
  var carteiraPedidos = cart.length;

  // Pipeline
  var leads = DATA.leads || [];
  if (vertFilter) {
    leads = leads.filter(function(l) {
      if (vertFilter === 'AGUA') return (l.produto || '').toUpperCase().indexOf('AGUA') >= 0 || (l.produto || '').toUpperCase().indexOf('GUA') >= 0 || isVertConsultor(l.consultor_nome, vertFilter);
      return isVertConsultor(l.consultor_nome, vertFilter);
    });
  }
  var leadsAtivos = leads.length;
  var leadsQuentes = leads.filter(function(l) { return safeNum(l.temperatura) >= 5; }).length;
  var d7 = new Date(); d7.setDate(d7.getDate() - 7);
  var d7str = d7.toISOString().slice(0, 10);
  var leadsNovos7d = leads.filter(function(l) { return (l.data_entrada || '') >= d7str; }).length;

  return {
    realMonth: realMonth, metaMonth: metaMonth, freteMonth: freteMonth,
    atingMonth: metaMonth > 0 ? realMonth / metaMonth * 100 : 0,
    realYTD: realYTD, metaYTD: metaYTD, freteYTD: freteYTD,
    atingYTD: metaYTD > 0 ? realYTD / metaYTD * 100 : 0,
    realAno: realAno, metaAno: metaAno, freteAno: freteAno,
    atingAno: metaAno > 0 ? realAno / metaAno * 100 : 0,
    locMonth: locMonth, locYTD: locYTD, locAno: locAno,
    rate: rate, projecao: projecao, bizLeft: bizLeft, bizElapsed: bizElapsed, bizTotal: bizTotal,
    carteiraTotal: carteiraTotal, carteiraPedidos: carteiraPedidos,
    carteiraMetaPct: metaAno > 0 ? carteiraTotal / metaAno * 100 : 0,
    leadsAtivos: leadsAtivos, leadsQuentes: leadsQuentes, leadsNovos7d: leadsNovos7d,
    cart: cart, leads: leads
  };
}

/* ═══ RENDER ALL ═══ */
function renderAll(cfg) {
  var kpis = computeAllKPIs(cfg);
  renderKPIs(kpis, cfg);
  renderMemoriaCalculo(kpis, cfg);
  renderDailyTable(kpis, cfg);
  renderFaturamentoDia(cfg);
  renderRanking(kpis, cfg);
  renderPedidos(cfg);
  renderMonthlyVision(cfg);
  renderCarteiraDetalhada(kpis, cfg);
  renderClientes8020(cfg);
  renderAgendaCheckin(cfg);
  renderFreteMonitor(cfg);
  renderProdutosTop(cfg);
  renderComparativoAnual(cfg);
  renderMapaUF(cfg);
  renderFunilLeads(cfg);
  renderLocacoesAtivas(cfg);
  renderClientesNovosRecorrentes(cfg);
  renderFeed(cfg);

  // Ticker
  var monthName = MONTH_NAMES_FULL[MONTH - 1];
  var tkTitle = document.getElementById('tk-title');
  if (tkTitle) tkTitle.textContent = (cfg.title || 'COCKPIT') + ' — ' + monthName.toUpperCase() + ' ' + YEAR;
  renderTicker(kpis.atingMonth, kpis.atingYTD, kpis.carteiraTotal, kpis.bizLeft);
}

/* ═══ BLOCK 1: KPI STRIP ═══ */
function renderKPIs(kpis, cfg) {
  var el = document.getElementById('kpi-strip');
  if (!el) return;

  var monthName = MONTH_NAMES[MONTH - 1];
  var cards = [
    { label: 'FATURAMENTO MÊS (' + monthName + ')', value: kpis.realMonth, meta: kpis.metaMonth, pct: kpis.atingMonth, proj: kpis.projecao, rate: kpis.rate, bizLeft: kpis.bizLeft, cls: 'kpi-fat' },
    { label: 'FATURAMENTO YTD', value: kpis.realYTD, meta: kpis.metaYTD, pct: kpis.atingYTD, cls: 'kpi-fat' },
    { label: 'FATURAMENTO ' + YEAR, value: kpis.realAno, meta: kpis.metaAno, pct: kpis.atingAno, cls: 'kpi-fat' },
    { label: 'CARTEIRA PEDIDOS', value: kpis.carteiraTotal, count: kpis.carteiraPedidos, metaPct: kpis.carteiraMetaPct, cls: 'kpi-cart' },
    { label: 'PIPELINE LEADS', leads: kpis.leadsAtivos, quentes: kpis.leadsQuentes, novos: kpis.leadsNovos7d, cls: 'kpi-pipe' },
  ];

  var html = '';
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    html += '<div class="kpi-box ' + c.cls + '">';
    html += '<div class="kpi-label">' + c.label + '</div>';

    if (c.leads !== undefined) {
      html += '<div class="kpi-value">' + c.leads + ' <span style="font-size:12px;color:var(--text-dim)">leads</span></div>';
      html += '<div class="kpi-sub">';
      html += '<span style="color:var(--red)">' + c.quentes + ' quentes</span>';
      html += '<span>· ' + c.novos + ' novos (7d)</span>';
      html += '</div>';
    } else if (c.count !== undefined) {
      html += '<div class="kpi-value">' + fmtBRL(c.value) + '</div>';
      html += '<div class="kpi-sub">' + c.count + ' pedidos abertos</div>';
      var cpct = c.metaPct;
      var cStatus = cpct >= 15 ? 'Bom' : cpct >= 8 ? 'Moderado' : 'Crítico';
      var cColor = cpct >= 15 ? 'var(--green)' : cpct >= 8 ? 'var(--amber)' : 'var(--red)';
      html += '<div class="kpi-pct" style="color:' + cColor + '">' + fmtPct(cpct) + ' da meta — ' + cStatus + '</div>';
    } else {
      html += '<div class="kpi-value">' + fmtBRL(c.value) + '</div>';
      html += '<div class="kpi-sub">Meta <span class="meta-val">' + fmtBRL(c.meta) + '</span></div>';
      html += '<div class="kpi-pct" style="color:' + pctColor(c.pct) + '">' + fmtPct(c.pct) + '</div>';
      html += '<div class="kpi-progress"><div class="kpi-progress-fill" style="width:' + Math.min(c.pct, 100) + '%;background:' + pctColor(c.pct) + '"></div></div>';
      if (c.proj !== undefined) {
        var projColor = c.proj >= c.meta ? 'var(--green)' : 'var(--amber)';
        html += '<div class="kpi-proj">Projeção <span class="proj-val" style="color:' + projColor + '">' + fmtBRL(c.proj) + '</span>';
        html += ' · ' + fmtBRL(c.rate) + '/dia · ' + c.bizLeft + ' dias úteis restam</div>';
      }
    }
    html += '</div>';
  }
  el.innerHTML = html;
}

/* ═══ BLOCK 2: ALERTS ═══ */
function renderMemoriaCalculo(kpis, cfg) {
  var el = document.getElementById('memoria-calculo');
  if (!el) return;

  var vertFilter = cfg.vertical || null;
  var movAll = DATA.movimento || [];
  var mov = vertFilter ? movAll.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; }) : movAll;
  var loc = DATA.locacao || [];
  var incluiLoc = !vertFilter || vertFilter === 'AGUA';

  // Group by month
  var months = {};
  for (var i = 1; i <= 12; i++) {
    var key = YEAR + '-' + String(i).padStart(2, '0');
    months[key] = { mov: 0, loc: 0, nfs: 0 };
  }

  mov.forEach(function(m) {
    var t = m.id_tempo || '';
    if (months[t]) { months[t].mov += m._valor; months[t].nfs++; }
  });

  if (incluiLoc) {
    loc.forEach(function(r) {
      var t = r.id_tempo || '';
      if (months[t]) months[t].loc += safeNum(r.vlr_liquido);
    });
  }

  var mNames = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  var html = '<div style="font-family:var(--mono);font-size:8px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px;padding-bottom:4px;border-bottom:1px solid var(--border);margin-bottom:4px;display:flex;align-items:center;gap:6px"><span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--accent)"></span> FATURAMENTO POR MÊS</div>';
  html += '<div style="display:grid;grid-template-columns:32px 1fr 1fr 1fr;gap:2px 6px;font-family:var(--mono);font-size:8px;padding:2px 0">';
  html += '<span style="color:var(--text-dim);font-weight:700">MÊS</span>';
  html += '<span style="color:var(--text-dim);font-weight:700;text-align:right">NFs</span>';
  if (incluiLoc) {
    html += '<span style="color:var(--text-dim);font-weight:700;text-align:right">LOCAÇÃO</span>';
  } else {
    html += '<span style="color:var(--text-dim);font-weight:700;text-align:right">FRETE</span>';
  }
  html += '<span style="color:var(--text-dim);font-weight:700;text-align:right">TOTAL</span>';
  html += '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:1px;overflow-y:auto;flex:1;min-height:0">';

  var acum = 0;
  var keys = Object.keys(months).sort();
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var d = months[key];
    var total = d.mov + d.loc;
    acum += total;
    var mIdx = parseInt(key.slice(5, 7)) - 1;
    var isCurrent = (mIdx + 1) === MONTH;
    var isFuture = (mIdx + 1) > MONTH;
    var rowColor = isCurrent ? 'color:var(--accent);font-weight:700' : isFuture ? 'color:var(--text-dim);opacity:.4' : 'color:var(--text-muted)';

    html += '<div style="display:grid;grid-template-columns:32px 1fr 1fr 1fr;gap:2px 6px;font-family:var(--mono);font-size:9px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.03);' + rowColor + '">';
    html += '<span>' + mNames[mIdx] + '</span>';
    html += '<span style="text-align:right">' + (d.mov > 0 ? fmtBRL(d.mov) : '—') + '</span>';
    if (incluiLoc) {
      html += '<span style="text-align:right">' + (d.loc > 0 ? fmtBRL(d.loc) : '—') + '</span>';
    } else {
      var freteMes = mov.filter(function(m) { return m.id_tempo === key; }).reduce(function(s, m) { return s + m._frete; }, 0);
      html += '<span style="text-align:right">' + (freteMes > 0 ? fmtBRL(freteMes) : '—') + '</span>';
    }
    html += '<span style="text-align:right;font-weight:700">' + (total > 0 ? fmtBRL(total) : '—') + '</span>';
    html += '</div>';
  }
  html += '</div>';

  // Totals
  var totalMov = mov.reduce(function(s, m) { return s + m._valor; }, 0);
  var totalLoc = incluiLoc ? loc.reduce(function(s, r) { return s + safeNum(r.vlr_liquido); }, 0) : 0;
  html += '<div style="display:grid;grid-template-columns:32px 1fr 1fr 1fr;gap:2px 6px;font-family:var(--mono);font-size:9px;font-weight:700;padding:4px 0;border-top:2px solid var(--accent);margin-top:4px">';
  html += '<span style="color:var(--text-dim)">ANO</span>';
  html += '<span style="text-align:right;color:var(--text)">' + fmtBRL(totalMov) + '</span>';
  html += '<span style="text-align:right;color:var(--text)">' + fmtBRL(totalLoc) + '</span>';
  html += '<span style="text-align:right;color:var(--accent)">' + fmtBRL(totalMov + totalLoc) + '</span>';
  html += '</div>';

  el.innerHTML = html;
}

/* ═══ BLOCK 3: DAILY TABLE (calendar grid 1-31) ═══ */
function renderDailyTable(kpis, cfg) {
  var el = document.getElementById('daily-chart');
  if (!el) return;

  var movAll = DATA.movimento || [];
  var mov = cfg.vertical ? movAll.filter(function(m) { return normalizeVertical(m.vertical || '') === cfg.vertical; }) : movAll;
  var daysInMonth = new Date(YEAR, MONTH, 0).getDate();
  var totalMonth = 0;

  // Build daily data
  var days = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var dayStr = MONTH_STR + '-' + String(d).padStart(2, '0');
    var dayMov = mov.filter(function(m) { return (m.data_faturamento || '').startsWith(dayStr); });
    var val = dayMov.reduce(function(s, m) { return s + m._valor; }, 0);

    if (DATA.locacao) {
      DATA.locacao.forEach(function(r) {
        if ((r.id_tempo || '').startsWith(dayStr)) val += safeNum(r.vlr_liquido);
      });
    }

    var dow = new Date(YEAR, MONTH - 1, d).getDay();
    var isWeekend = dow === 0 || dow === 6;
    var isToday = d === NOW.getDate();
    var isFuture = d > NOW.getDate();

    if (!isFuture) totalMonth += val;
    days.push({ day: d, val: val, dow: dow, isWeekend: isWeekend, isToday: isToday, isFuture: isFuture });
  }

  // Calendar grid: 8 cols per row (accommodates 31 days in ~4 rows)
  var html = '<div class="daily-grid">';
  for (var i = 0; i < days.length; i++) {
    var dd = days[i];
    var cls = 'daily-cell';
    if (dd.val > 0) cls += ' has-value';
    if (dd.isToday) cls += ' today';
    if (dd.isWeekend && !dd.val) cls += ' weekend';
    if (dd.isFuture) cls += ' future';

    html += '<div class="' + cls + '">';
    html += '<div class="dc-day">' + dd.day + '</div>';
    html += '<div class="dc-dow">' + DOW_NAMES[dd.dow] + '</div>';
    html += '<div class="dc-val">' + (dd.val > 0 ? fmtBRL(dd.val) : '—') + '</div>';
    html += '</div>';
  }
  html += '</div>';

  // Stats
  var avgDia = kpis.bizElapsed > 0 ? kpis.realMonth / kpis.bizElapsed : 0;
  var faltaDia = kpis.bizLeft > 0 ? Math.max(kpis.metaMonth - kpis.realMonth, 0) / kpis.bizLeft : 0;
  html += '<div class="daily-stats">';
  html += '<span>Média/dia <strong style="color:var(--text)">' + fmtBRL(avgDia) + '</strong></span>';
  html += '<span>Falta/dia <strong style="color:' + (faltaDia > avgDia * 1.5 ? 'var(--red)' : 'var(--amber)') + '">' + fmtBRL(faltaDia) + '</strong></span>';
  html += '<span>' + kpis.bizElapsed + '/' + kpis.bizTotal + ' dias úteis</span>';
  html += '<span>Total mês <strong style="color:var(--accent)">' + fmtBRL(kpis.realMonth) + '</strong></span>';
  html += '</div>';

  el.innerHTML = html;
}

/* ═══ BLOCK 4: FATURAMENTO — HISTÓRICO LIVE ═══ */
function renderFaturamentoDia(cfg) {
  var el = document.getElementById('fat-dia');
  if (!el) return;

  var movAll = DATA.movimento || [];
  var mov = cfg.vertical ? movAll.filter(function(m) { return normalizeVertical(m.vertical || '') === cfg.vertical; }) : movAll;

  // All month, sorted by date asc for accumulator then reversed for display
  var mesAtual = TODAY_STR.slice(0, 7);
  var mesMov = mov.filter(function(m) { return (m.data_faturamento || '').slice(0, 7) === mesAtual; });
  mesMov.sort(function(a, b) { return (a.data_faturamento || '').localeCompare(b.data_faturamento || ''); });

  // Compute accumulated
  var acum = 0;
  for (var k = 0; k < mesMov.length; k++) {
    acum += mesMov[k]._valor || 0;
    mesMov[k]._acum = acum;
  }
  var totalMes = acum;

  // Reverse for display (most recent first)
  mesMov.reverse();

  // Sound on new NF today
  var todayCount = mesMov.filter(function(m) { return (m.data_faturamento || '').startsWith(TODAY_STR); }).length;
  var isNew = todayCount > _prevFatDiaCount && _prevFatDiaCount > 0;
  if (isNew) playSoundNF();
  _prevFatDiaCount = todayCount;

  var html = '<div class="fat-dia-header">';
  html += '<span>DATA</span><span>CLIENTE</span><span style="text-align:right">VALOR</span><span style="text-align:right">ACUMULADO</span>';
  html += '</div>';
  html += '<div class="fat-dia-list">';

  for (var i = 0; i < mesMov.length; i++) {
    var m = mesMov[i];
    var dt = (m.data_faturamento || '').slice(8, 10) + '/' + (m.data_faturamento || '').slice(5, 7);
    var isToday = (m.data_faturamento || '').startsWith(TODAY_STR);
    var newCls = (i === 0 && isNew) ? ' new-entry' : '';
    var todayCls = isToday ? ' style="color:var(--green)"' : '';
    html += '<div class="fat-dia-row' + newCls + '">';
    html += '<span style="color:var(--text-dim)">' + dt + '</span>';
    html += '<span title="' + escHtml(m.nome_cliente || '') + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml((m.nome_cliente || '').slice(0, 22)) + '</span>';
    html += '<span style="text-align:right;font-weight:700"' + todayCls + '>' + fmtBRL(m._valor) + '</span>';
    html += '<span style="text-align:right;color:var(--text-dim)">' + fmtBRL(m._acum) + '</span>';
    html += '</div>';
  }

  if (mesMov.length === 0) {
    html += '<div style="text-align:center;padding:20px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem faturamento no mês</div>';
  }

  html += '</div>';

  // Total row
  var todayTotal = mesMov.filter(function(m) { return (m.data_faturamento || '').startsWith(TODAY_STR); }).reduce(function(s, m) { return s + m._valor; }, 0);
  html += '<div style="display:flex;justify-content:space-between;padding:4px 6px;border-top:2px solid var(--accent);font-family:var(--mono);font-size:10px;font-weight:700;margin-top:4px">';
  html += '<span style="color:var(--text-dim)">' + mesMov.length + ' NFs mês · ' + todayCount + ' hoje</span>';
  html += '<span style="color:var(--accent)">' + fmtBRLFull(totalMes) + '</span>';
  html += '</div>';

  el.innerHTML = html;
}

/* ═══ BLOCK 5: RANKING CONSULTORES ═══ */
function renderRanking(kpis, cfg) {
  var el = document.getElementById('ranking');
  if (!el) return;

  var planC = DATA.planConsultor || [];
  var mov = DATA.movimento || [];
  var leads = kpis.leads || [];
  var acts = DATA.atividades || [];

  var map = {};
  var source = cfg.isExec ? COLAB.filter(function(c) { var v = normalizeVertical(c.vertical); return v === 'AGRO' || v === 'AGUA' || v === 'FLORESTAS' || v === 'CORPORATIVO'; }) : VERT_CONSULTORES;

  source.forEach(function(c) {
    var nome = c.nome_agrupado || c.nome;
    if (!nome) return;
    map[nome] = {
      nome: c.nome_curto || nome,
      nomeCompleto: nome,
      foto: fotoUrl(nome),
      vertical: normalizeVertical(c.vertical),
      metaAno: 0, realAno: 0, realMes: 0, realPrevMes: 0,
      pct: 0, trend: 'flat', leadsAtivos: 0, acts30d: 0
    };
  });

  planC.forEach(function(p) {
    var key = Object.keys(map).find(function(k) { return matchPlanName(k, p.consultor) || matchPlanName(p.consultor, k); });
    if (!key) return;
    map[key].metaAno += safeNum(p.meta);
    var pp = (p.id_tempo || '').split('-');
    var pMonth = parseInt(pp[1]) || 0;
    if (pMonth <= MONTH) map[key].realAno += safeNum(p.realizado);
    if (pMonth === MONTH) map[key].realMes += safeNum(p.realizado);
    if (pMonth === MONTH - 1 || (MONTH === 1 && pMonth === 12)) map[key].realPrevMes += safeNum(p.realizado);
  });

  leads.forEach(function(l) {
    var key = Object.keys(map).find(function(k) { return matchPlanName(k, l.consultor_nome) || matchPlanName(l.consultor_nome, k); });
    if (key) map[key].leadsAtivos++;
  });

  acts.forEach(function(a) {
    var key = Object.keys(map).find(function(k) { return matchPlanName(k, a.consultor_nome) || matchPlanName(a.consultor_nome, k); });
    if (key) map[key].acts30d++;
  });

  var list = [];
  var totalMeta = 0, totalReal = 0;
  Object.keys(map).forEach(function(k) {
    var r = map[k];
    r.pct = r.metaAno > 0 ? r.realAno / r.metaAno * 100 : 0;
    if (r.realMes > r.realPrevMes * 1.1) r.trend = 'up';
    else if (r.realMes < r.realPrevMes * 0.9) r.trend = 'down';
    if (r.metaAno > 0 || r.realAno > 0 || r.leadsAtivos > 0) {
      totalMeta += r.metaAno;
      totalReal += r.realAno;
      list.push(r);
    }
  });

  list.sort(function(a, b) { return b.pct - a.pct; });

  var html = '<div class="rank-header">';
  html += '<span>#</span><span></span><span>CONSULTOR</span><span>META × REAL</span><span>%</span><span></span>';
  html += '</div>';
  html += '<div class="rank-list">';

  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
    var trendIcon = r.trend === 'up' ? '▲' : r.trend === 'down' ? '▼' : '—';
    var vertClass = r.vertical.toLowerCase();
    var badgeClass = 'badge-' + vertClass;

    html += '<div class="rank-row">';
    html += '<div class="rank-pos ' + posClass + '">' + (i + 1) + '</div>';

    if (r.foto) {
      html += '<img class="rank-avatar" src="' + escHtml(r.foto) + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'" alt="">';
      html += '<div class="rank-avatar-fallback" style="display:none">' + escHtml(r.nome.slice(0, 2).toUpperCase()) + '</div>';
    } else {
      html += '<div class="rank-avatar-fallback">' + escHtml(r.nome.slice(0, 2).toUpperCase()) + '</div>';
    }

    html += '<div class="rank-info">';
    html += '<div class="rank-name">' + escHtml(r.nome) + '</div>';
    html += '<div class="rank-meta-row">';
    if (cfg.isExec) html += '<span class="badge ' + badgeClass + '">' + r.vertical + '</span>';
    html += '<span>' + r.leadsAtivos + ' leads</span>';
    html += '<span>' + r.acts30d + ' ativ</span>';
    html += '</div></div>';

    html += '<div class="rank-bar-cell">';
    html += '<span style="font-size:9px;color:var(--text-dim)">' + fmtBRL(r.realAno) + '</span>';
    html += '<div class="rank-bar-track"><div class="rank-bar-fill" style="width:' + Math.min(r.pct, 100) + '%;background:' + pctColor(r.pct) + '"></div></div>';
    html += '</div>';

    html += '<div class="rank-pct" style="color:' + pctColor(r.pct) + '">' + fmtPct(r.pct) + '</div>';
    html += '<div class="rank-trend ' + r.trend + '">' + trendIcon + '</div>';
    html += '</div>';
  }

  // Total row
  var totalPct = totalMeta > 0 ? totalReal / totalMeta * 100 : 0;
  html += '<div class="rank-row total-row">';
  html += '<div class="rank-pos"></div><div></div>';
  html += '<div class="rank-info"><div class="rank-name">TOTAL</div></div>';
  html += '<div class="rank-bar-cell"><span style="font-size:9px">' + fmtBRL(totalReal) + ' / ' + fmtBRL(totalMeta) + '</span></div>';
  html += '<div class="rank-pct" style="color:' + pctColor(totalPct) + '">' + fmtPct(totalPct) + '</div>';
  html += '<div></div>';
  html += '</div>';

  html += '</div>';
  el.innerHTML = html;
}

/* ═══ BLOCK 6: PEDIDOS — CARTEIRA ABERTA ═══ */
function renderPedidos(cfg) {
  var el = document.getElementById('pedidos-recentes');
  if (!el) return;

  var cart = DATA.carteira || [];
  if (cfg.vertical) {
    cart = cart.filter(function(c) {
      return normalizeVertical(c.vertical || '') === cfg.vertical || isVertConsultor(c.representante || c.consultor, cfg.vertical);
    });
  }

  // Sort by most recent
  var sorted = cart.slice().sort(function(a, b) {
    var da = a.dt_pedido || a.created_at || '';
    var db = b.dt_pedido || b.created_at || '';
    return db.localeCompare(da);
  });

  var totalCarteira = sorted.reduce(function(s, c) { return s + safeNum(c.vlr_carteira || c.vlr_total); }, 0);

  var html = '<div class="pedido-header">';
  html += '<span>DATA</span><span>CLIENTE</span><span>CONSULTOR</span><span style="text-align:right">VALOR</span>';
  html += '</div>';
  html += '<div class="pedidos-list">';

  var shown = Math.min(sorted.length, 30);
  for (var i = 0; i < shown; i++) {
    var p = sorted[i];
    var data = (p.dt_pedido || p.created_at || '').slice(0, 10);
    var isToday = data === TODAY_STR;

    html += '<div class="pedido-row' + (isToday ? ' today' : '') + '">';
    html += '<span>' + (data ? data.slice(8, 10) + '/' + data.slice(5, 7) : '—') + '</span>';
    html += '<span title="' + escHtml(p.nome_cliente || '') + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml((p.nome_cliente || '').slice(0, 25)) + '</span>';
    html += '<span style="color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml((p.representante || p.consultor || '').split(' ').slice(0, 2).join(' ')) + '</span>';
    html += '<span style="text-align:right;font-weight:700">' + fmtBRL(safeNum(p.vlr_carteira || p.vlr_total)) + '</span>';
    html += '</div>';
  }

  if (sorted.length === 0) {
    html += '<div style="text-align:center;padding:16px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem pedidos em carteira</div>';
  }

  html += '</div>';

  // Total row
  html += '<div style="display:flex;justify-content:space-between;padding:4px 6px;border-top:2px solid var(--accent);font-family:var(--mono);font-size:10px;font-weight:700;margin-top:4px">';
  html += '<span style="color:var(--text-dim)">' + sorted.length + ' pedidos em carteira</span>';
  html += '<span style="color:var(--accent)">TOTAL ' + fmtBRLFull(totalCarteira) + '</span>';
  html += '</div>';

  el.innerHTML = html;
}

/* ═══ BLOCK 7: MONTHLY VISION (mosaic 6x2) ═══ */
function renderMonthlyVision(cfg) {
  var el = document.getElementById('monthly-vision');
  if (!el) return;

  var vertFilter = cfg.vertical || null;
  var planAll = DATA.planVertical || [];
  var movAll = DATA.movimento || [];
  var plan = vertFilter ? planAll.filter(function(p) { return normalizeVertical(p.vertical || '') === vertFilter; }) : planAll;
  var mov = vertFilter ? movAll.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; }) : movAll;

  var html = '<div class="month-mosaic">';
  for (var m = 1; m <= 12; m++) {
    var mStr = YEAR + '-' + String(m).padStart(2, '0');
    var isCurrent = m === MONTH;
    var isFuture = m > MONTH;

    var meta = plan.filter(function(p) { return p.id_tempo === mStr; }).reduce(function(s, p) { return s + safeNum(p.meta); }, 0);
    var real = mov.filter(function(r) { return (r.id_tempo || '') === mStr; }).reduce(function(s, r) { return s + r._valor; }, 0);

    if (DATA.locacao) {
      DATA.locacao.forEach(function(r) {
        var parts = (r.id_tempo || '').split('-');
        if (parseInt(parts[1]) === m) real += safeNum(r.vlr_liquido);
      });
    }

    var pct = meta > 0 ? real / meta * 100 : 0;

    html += '<div class="month-cell' + (isCurrent ? ' current' : '') + (isFuture ? ' future' : '') + '">';
    html += '<div class="month-name">' + MONTH_NAMES[m - 1] + '</div>';
    html += '<div class="month-real">' + fmtBRL(real) + '</div>';
    html += '<div class="month-meta">Meta ' + fmtBRL(meta) + '</div>';
    html += '<div class="month-pct" style="color:' + pctColor(pct) + '">' + (meta > 0 ? fmtPct(pct) : '—') + '</div>';
    html += '<div class="month-bar"><div class="month-bar-fill" style="width:' + Math.min(pct, 100) + '%;background:' + pctColor(pct) + '"></div></div>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

/* ═══ BLOCK 8: CARTEIRA DETALHADA ═══ */
function renderCarteiraDetalhada(kpis, cfg) {
  var el = document.getElementById('carteira-detalhe');
  if (!el) return;

  var cart = kpis.cart || [];
  var byConsultor = {};
  cart.forEach(function(c) {
    var nome = c.consultor || 'OUTROS';
    if (!byConsultor[nome]) byConsultor[nome] = { pedidos: 0, clientes: new Set(), valor: 0 };
    byConsultor[nome].pedidos++;
    byConsultor[nome].clientes.add(c.nome_cliente || c.cliente || '');
    byConsultor[nome].valor += safeNum(c.valor || c.vlr_total);
  });

  var total = kpis.carteiraTotal || 1;
  var list = Object.keys(byConsultor).map(function(k) {
    return { nome: k, pedidos: byConsultor[k].pedidos, clientes: byConsultor[k].clientes.size, valor: byConsultor[k].valor };
  }).sort(function(a, b) { return b.valor - a.valor; });

  var html = '<table class="cart-table"><thead><tr>';
  html += '<th>Consultor</th><th style="text-align:center">Pedidos</th><th style="text-align:center">Clientes</th><th style="text-align:right">Valor</th><th style="text-align:right">%</th>';
  html += '</tr></thead><tbody>';

  list.forEach(function(r) {
    var pct = total > 0 ? r.valor / total * 100 : 0;
    html += '<tr>';
    html += '<td><span class="cart-name">' + escHtml(r.nome.split(' ').slice(0, 2).join(' ')) + '</span></td>';
    html += '<td class="cart-count">' + r.pedidos + '</td>';
    html += '<td class="cart-count">' + r.clientes + '</td>';
    html += '<td class="cart-val">' + fmtBRL(r.valor) + '</td>';
    html += '<td style="text-align:right;color:var(--text-muted)">' + fmtPct(pct) + '</td>';
    html += '</tr>';
  });

  html += '<tr style="border-top:2px solid var(--accent);font-weight:700">';
  html += '<td>TOTAL</td><td class="cart-count">' + cart.length + '</td><td></td>';
  html += '<td class="cart-val">' + fmtBRL(kpis.carteiraTotal) + '</td><td></td></tr>';
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* ═══ BLOCK 9: CLIENTES 80/20 ═══ */
function renderClientes8020(cfg) {
  var el = document.getElementById('clientes-8020');
  if (!el) return;

  var vertFilter = cfg.vertical || null;
  var dataAll = DATA.planCliente || [];
  var data = vertFilter ? dataAll.filter(function(d) { return normalizeVertical(d.vertical || '') === vertFilter; }) : dataAll;
  var sorted = data.slice().sort(function(a, b) { return safeNum(b.realizado) - safeNum(a.realizado); });
  var totalReal = sorted.reduce(function(s, r) { return s + safeNum(r.realizado); }, 0) || 1;

  var html = '<table class="detail-table"><thead><tr>';
  html += '<th>Cliente</th><th class="right">Meta</th><th class="right">Real</th><th class="right">%</th><th class="right">Acum</th>';
  html += '</tr></thead><tbody>';

  var acum = 0;
  var shown = Math.min(sorted.length, 25);
  for (var i = 0; i < shown; i++) {
    var c = sorted[i];
    var real = safeNum(c.realizado);
    var meta = safeNum(c.meta);
    var pct = meta > 0 ? real / meta * 100 : 0;
    acum += real;
    var acumPct = totalReal > 0 ? acum / totalReal * 100 : 0;

    html += '<tr>';
    html += '<td><span class="dt-name">' + escHtml((c.cliente || '').slice(0, 30)) + '</span></td>';
    html += '<td class="dt-muted">' + fmtBRL(meta) + '</td>';
    html += '<td class="dt-val">' + fmtBRL(real) + '</td>';
    html += '<td class="dt-pct" style="color:' + pctColor(pct) + '">' + fmtPct(pct) + '</td>';
    html += '<td class="right" style="color:var(--text-dim)">' + fmtPct(acumPct) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* ═══ BLOCK 10: AGENDA + CHECK-IN DO DIA ═══ */
function renderAgendaCheckin(cfg) {
  var el = document.getElementById('agenda-checkin');
  if (!el) return;

  var acts = DATA.atividades || [];
  var todayActs = acts.filter(function(a) { return (a.data || '') === TODAY_STR; });

  if (cfg.vertical) {
    todayActs = todayActs.filter(function(a) { return isVertConsultor(a.consultor_nome, cfg.vertical); });
  }

  todayActs.sort(function(a, b) { return (a.hora || '').localeCompare(b.hora || ''); });

  var done = todayActs.filter(function(a) { return a.status === 'realizada'; }).length;
  var pending = todayActs.filter(function(a) { return a.status !== 'realizada'; }).length;
  var hasCheckin = todayActs.filter(function(a) { return a.dados_checkin; }).length;

  // Sound on new check-in
  if (hasCheckin > 0 && hasCheckin > (window._prevCheckinCount || 0)) {
    playSoundCheckin();
  }
  window._prevCheckinCount = hasCheckin;

  var html = '<div class="agenda-header">';
  html += '<span>HORA</span><span>ST</span><span>CONSULTOR / ATIVIDADE</span><span>LEAD/CLIENTE</span>';
  html += '</div>';
  html += '<div class="agenda-list">';

  var shown = Math.min(todayActs.length, 12);
  for (var i = 0; i < shown; i++) {
    var a = todayActs[i];
    var isDone = a.status === 'realizada';
    var hasCI = !!a.dados_checkin;
    var tipoTag = a.tipo ? ' <span style="font-size:8px;color:var(--text-dim)">' + escHtml(a.tipo) + '</span>' : '';

    html += '<div class="agenda-row' + (isDone ? ' done' : ' pending') + '">';
    html += '<span style="color:var(--text-dim)">' + (a.hora || '—').slice(0, 5) + '</span>';
    html += '<div class="agenda-status-dot ' + (isDone ? 'done' : 'pending') + '" title="' + (isDone ? 'Realizada' : 'Pendente') + (hasCI ? ' (Check-in)' : '') + '"></div>';
    html += '<span>' + escHtml((a.consultor_nome || '').split(' ').slice(0, 2).join(' ')) + (a.descricao ? ' — ' + escHtml(a.descricao.slice(0, 20)) : '') + (hasCI ? ' ✓CI' : '') + tipoTag + '</span>';
    html += '<span style="color:var(--text-dim)">' + escHtml((a.lead_nome || '').slice(0, 20)) + '</span>';
    html += '</div>';
  }

  if (todayActs.length === 0) {
    html += '<div style="text-align:center;padding:16px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem atividades agendadas hoje</div>';
  }

  html += '</div>';

  // Summary
  html += '<div class="agenda-summary">';
  html += '<span style="color:var(--green)">' + done + ' realizadas</span>';
  html += '<span style="color:var(--amber)">' + pending + ' pendentes</span>';
  html += '<span style="color:#9b59b6">' + hasCheckin + ' check-ins</span>';
  html += '</div>';

  // Alerts section
  var alerts = [];
  var leads = DATA.leads || [];
  var d3 = new Date(); d3.setDate(d3.getDate() - 3);
  var d3str = d3.toISOString().slice(0, 10);
  var hotAbandoned = leads.filter(function(l) {
    return safeNum(l.temperatura) >= 5 && (l.ultimo_contato || l.data_entrada || '') < d3str;
  });
  if (hotAbandoned.length > 0) {
    alerts.push({ tipo: 'danger', msg: hotAbandoned.length + ' leads quentes sem contato +3d' });
  }
  var noConsultor = leads.filter(function(l) { return !l.consultor_nome; });
  if (noConsultor.length > 0) {
    alerts.push({ tipo: 'info', msg: noConsultor.length + ' leads sem consultor' });
  }
  if (alerts.length > 0) {
    html += '<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px">';
    for (var ai = 0; ai < alerts.length; ai++) {
      var al = alerts[ai];
      var alColor = al.tipo === 'danger' ? 'var(--red)' : al.tipo === 'warning' ? 'var(--amber)' : 'var(--blue)';
      html += '<div style="font-family:var(--mono);font-size:8px;color:' + alColor + ';padding:1px 0">● ' + al.msg + '</div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;
}

/* ═══ BLOCK 11: FRETE MONITOR ═══ */
function renderFreteMonitor(cfg) {
  var el = document.getElementById('frete-monitor');
  if (!el) return;

  var fretes = DATA.fretes || [];
  // Show active fretes (not delivered/completed)
  var active = fretes.filter(function(f) {
    var st = (f.status || '').toUpperCase();
    return st !== 'ENTREGUE' && st !== 'CANCELADO';
  });

  active.sort(function(a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var html = '<div class="frete-header">';
  html += '<span>STATUS</span><span>CLIENTE</span><span>TRANSPORT.</span><span style="text-align:right">VALOR</span>';
  html += '</div>';
  html += '<div class="frete-list">';

  var shown = Math.min(active.length, 10);
  for (var i = 0; i < shown; i++) {
    var f = active[i];
    var st = (f.status || '').toUpperCase();
    var stCot = (f.status_cotacao || '').toUpperCase();
    var statusCls = 'cotando';
    var statusLabel = 'ABERTO';
    if (stCot === 'APROVADO' || st === 'FECHADO') { statusCls = 'aprovado'; statusLabel = 'APROVADO'; }
    if (f.data_saida) { statusCls = 'enviado'; statusLabel = 'ENVIADO'; }
    if (f.codigo_rastreio) { statusCls = 'enviado'; statusLabel = 'RASTREIO'; }
    var prev = f.previsao_entrega ? f.previsao_entrega.slice(8, 10) + '/' + f.previsao_entrega.slice(5, 7) : '';

    html += '<div class="frete-row">';
    html += '<span class="frete-status ' + statusCls + '">' + statusLabel + '</span>';
    html += '<span title="' + escHtml(f.cliente || '') + '">' + escHtml((f.cliente || '').slice(0, 25)) + '</span>';
    html += '<span style="color:var(--text-dim)">' + escHtml((f.transportadora || '—').slice(0, 18)) + '</span>';
    html += '<span style="text-align:right;font-weight:700">' + fmtBRL(safeNum(f.valor_cobrado)) + (prev ? '<br><span style="font-size:8px;font-weight:400;color:var(--text-dim)">prev ' + prev + '</span>' : '') + '</span>';
    html += '</div>';
  }

  if (active.length === 0) {
    html += '<div style="text-align:center;padding:16px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem fretes em andamento</div>';
  }

  html += '</div>';

  // Summary
  var cotando = active.filter(function(f) { return !f.data_saida && (f.status_cotacao || '').toUpperCase() !== 'APROVADO'; }).length;
  var enviados = active.filter(function(f) { return !!f.data_saida; }).length;
  var totalVal = active.reduce(function(s, f) { return s + safeNum(f.valor_cobrado); }, 0);
  html += '<div style="display:flex;gap:12px;padding:4px 6px;border-top:1px solid var(--border);font-family:var(--mono);font-size:9px;color:var(--text-muted);margin-top:4px">';
  html += '<span style="color:var(--amber)">' + cotando + ' cotando</span>';
  html += '<span style="color:var(--green)">' + enviados + ' enviados</span>';
  html += '<span>Total ' + fmtBRL(totalVal) + '</span>';
  html += '</div>';

  el.innerHTML = html;
}

/* ═══ EXEC: VERTICAL CARDS ═══ */
function renderVerticalCards() {
  var el = document.getElementById('vert-cards');
  if (!el) return;

  var verts = ['AGRO', 'AGUA', 'FLORESTAS', 'CORPORATIVO'];
  var vertLabels = { AGRO: 'AGRO', AGUA: 'ÁGUA', FLORESTAS: 'FLORESTAS', CORPORATIVO: 'CORPORATIVO' };
  var plan = DATA.planVertical || [];
  var mov = DATA.movimento || [];
  var leads = DATA.leads || [];

  var html = '';
  verts.forEach(function(v) {
    var vPlan = plan.filter(function(p) { return normalizeVertical(p.vertical) === v; });

    // Use realizado from vw_plan_vs_real_vertical (already resolved by DB, includes FLORESTAS/CORPORATIVO)
    var metaMes = 0, realMes = 0, metaAno = 0, realAno = 0, metaYTD = 0, realYTD = 0;
    var ytdMonths = [];
    for (var i = 1; i <= MONTH; i++) ytdMonths.push(YEAR + '-' + String(i).padStart(2, '0'));

    vPlan.forEach(function(p) {
      var m = safeNum(p.meta);
      var r = safeNum(p.realizado);
      var f = safeNum(p.frete);
      metaAno += m;
      realAno += r + f;
      if (p.id_tempo === MONTH_STR) { metaMes += m; realMes += r + f; }
      if (ytdMonths.indexOf(p.id_tempo) >= 0) { metaYTD += m; realYTD += r + f; }
    });

    if (v === 'AGUA' && DATA.locacao) {
      DATA.locacao.forEach(function(r) {
        var vl = safeNum(r.vlr_liquido);
        realAno += vl;
        var parts = (r.id_tempo || '').split('-');
        var lMonth = parseInt(parts[1]) || 0;
        if (lMonth <= MONTH) realYTD += vl;
        if (lMonth === MONTH) realMes += vl;
      });
    }

    var pctMes = metaMes > 0 ? realMes / metaMes * 100 : 0;
    var pctYTD = metaYTD > 0 ? realYTD / metaYTD * 100 : 0;
    var pctAno = metaAno > 0 ? realAno / metaAno * 100 : 0;

    var vLeads = leads.filter(function(l) {
      if (v === 'AGUA') return (l.produto || '').toUpperCase().indexOf('AGUA') >= 0 || (l.produto || '').toUpperCase().indexOf('GUA') >= 0;
      return isVertConsultor(l.consultor_nome, v);
    });
    var vLeadsQuentes = vLeads.filter(function(l) { return safeNum(l.temperatura) >= 5; }).length;

    html += '<div class="vert-card vert-' + v.toLowerCase() + '">';
    html += '<div class="vert-card-title ' + v.toLowerCase() + '">' + vertLabels[v] + '</div>';

    var rows = [
      { label: 'MÊS', meta: metaMes, real: realMes, pct: pctMes },
      { label: 'YTD', meta: metaYTD, real: realYTD, pct: pctYTD },
      { label: 'ANO', meta: metaAno, real: realAno, pct: pctAno },
    ];
    rows.forEach(function(row) {
      html += '<div class="vert-row">';
      html += '<span class="vert-row-label">' + row.label + '</span>';
      html += '<span class="vert-row-val">' + fmtBRL(row.real) + ' / ' + fmtBRL(row.meta) + '</span>';
      html += '<span class="vert-row-pct" style="color:' + pctColor(row.pct) + '">' + fmtPct(row.pct) + '</span>';
      html += '</div>';
    });

    html += '<div class="vert-footer">';
    html += '<span>' + vLeads.length + ' leads</span>';
    html += '<span style="color:var(--red)">' + vLeadsQuentes + ' quentes</span>';
    html += '</div></div>';
  });

  el.innerHTML = html;
}

/* ═══ ACTIVITY FEED (today only + sound) ═══ */
function buildFeedItems(cfg) {
  var items = [];
  var mov = DATA.movimento || [];
  var leads = DATA.leads || [];
  var cart = DATA.carteira || [];
  var acts = DATA.atividades || [];
  var fretes = DATA.fretes || [];

  // Today's invoices
  mov.filter(function(m) { return (m.data_faturamento || '').startsWith(TODAY_STR); }).forEach(function(m) {
    items.push({
      time: (m.data_faturamento || '').slice(11, 16) || '—',
      type: 'nf',
      msg: fmtBRL(m._valor) + ' — ' + (m.nome_cliente || '').slice(0, 25) + ' (' + (m.consultor || '').split(' ').slice(0, 2).join(' ') + ')',
      ts: m.data_faturamento || ''
    });
  });

  // Today's leads
  leads.filter(function(l) { return (l.data_entrada || '') === TODAY_STR; }).forEach(function(l) {
    items.push({
      time: '—',
      type: 'lead',
      msg: (l.nome || '').slice(0, 30) + (l.consultor_nome ? ' (' + l.consultor_nome.split(' ').slice(0, 2).join(' ') + ')' : ''),
      ts: l.data_entrada || ''
    });
  });

  // Today's orders from carteira
  cart.filter(function(c) { return (c.data_emissao || c.created_at || '').startsWith(TODAY_STR); }).forEach(function(c) {
    items.push({
      time: (c.created_at || '').slice(11, 16) || '—',
      type: 'pedido',
      msg: fmtBRL(safeNum(c.valor || c.vlr_total)) + ' — ' + (c.nome_cliente || c.cliente || '').slice(0, 25),
      ts: c.created_at || ''
    });
  });

  // Today's check-ins
  acts.filter(function(a) { return (a.data || '') === TODAY_STR && a.dados_checkin; }).forEach(function(a) {
    items.push({
      time: (a.hora || '').slice(0, 5) || '—',
      type: 'checkin',
      msg: (a.consultor_nome || '').split(' ').slice(0, 2).join(' ') + ' — ' + (a.lead_nome || '').slice(0, 20),
      ts: a.data + 'T' + (a.hora || '00:00')
    });
  });

  // Recent fretes
  fretes.filter(function(f) { return (f.created_at || '').startsWith(TODAY_STR) || (f.data_saida || '').startsWith(TODAY_STR); }).forEach(function(f) {
    items.push({
      time: (f.created_at || '').slice(11, 16) || '—',
      type: 'frete',
      msg: (f.cliente || '').slice(0, 20) + ' — ' + (f.transportadora || ''),
      ts: f.created_at || ''
    });
  });

  items.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
  return items;
}

function renderFeed(cfg) {
  var el = document.getElementById('feed-track');
  if (!el) return;

  var items = buildFeedItems(cfg || {});

  // Sound on new items
  if (items.length > _prevFeedCount && _prevFeedCount > 0) {
    playSoundFeed();
  }
  _prevFeedCount = items.length;

  if (items.length === 0) {
    items.push({ time: '—', type: 'nf', msg: 'Aguardando movimentação do dia...' });
  }

  var html = '';
  var allItems = items.concat(items);
  for (var i = 0; i < allItems.length; i++) {
    var it = allItems[i];
    var newCls = (i === 0 && items.length > _prevFeedCount) ? ' new-feed' : '';
    html += '<div class="feed-item' + newCls + '">';
    html += '<span class="feed-time">' + escHtml(it.time) + '</span>';
    html += '<span class="feed-type ' + it.type + '">' + it.type.toUpperCase() + '</span>';
    html += '<span class="feed-msg">' + escHtml(it.msg) + '</span>';
    html += '</div>';
  }
  el.innerHTML = html;

  var duration = Math.max(items.length * 8, 30);
  el.style.animationDuration = duration + 's';
}

function startFeedPoll(cfg) {
  _feedPollTimer = setInterval(function() {
    renderFeed(cfg);
  }, 60000);
}

/* ═══ EXEC RENDER ALL ═══ */
function renderAllExec(cfg) {
  var kpis = computeAllKPIs(cfg);
  renderKPIs(kpis, cfg);
  renderMemoriaCalculo(kpis, cfg);
  renderVerticalCards();
  renderDailyTable(kpis, cfg);
  renderFaturamentoDia(cfg);
  renderRanking(kpis, cfg);
  renderPedidos(cfg);
  renderMonthlyVision(cfg);
  renderCarteiraDetalhada(kpis, cfg);
  renderClientes8020(cfg);
  renderAgendaCheckin(cfg);
  renderFreteMonitor(cfg);
  renderFeed(cfg);

  // New executive blocks
  renderProdutosTop(cfg);
  renderComparativoAnual(cfg);
  renderMapaUF(cfg);
  renderFunilLeads(cfg);
  renderLocacoesAtivas(cfg);
  renderClientesNovosRecorrentes(cfg);

  var monthName = MONTH_NAMES_FULL[MONTH - 1];
  var tkTitle = document.getElementById('tk-title');
  if (tkTitle) tkTitle.textContent = 'EXECUTIVO — ' + monthName.toUpperCase() + ' ' + YEAR;
  renderTicker(kpis.atingMonth, kpis.atingYTD, kpis.carteiraTotal, kpis.bizLeft);
}

/* ═══════════════════════════════════════════════════════════
   BLOCOS EXECUTIVOS COMPLEMENTARES
   ═══════════════════════════════════════════════════════════ */

/* ═══ PRODUTOS TOP 10 ═══ */
function renderProdutosTop(cfg) {
  var el = document.getElementById('produtos-top');
  if (!el) return;

  var prod = DATA.planProduto || [];
  var vertFilter = cfg.vertical || null;
  if (vertFilter) prod = prod.filter(function(p) { return normalizeVertical(p.vertical || '') === vertFilter; });

  // Aggregate by product
  var byProd = {};
  prod.forEach(function(p) {
    var nome = (p.produto || p.nome || 'SEM PRODUTO').toUpperCase().trim();
    if (!byProd[nome]) byProd[nome] = { meta: 0, real: 0 };
    byProd[nome].meta += safeNum(p.meta || p.valor);
    byProd[nome].real += safeNum(p.realizado);
  });

  var list = Object.keys(byProd).map(function(k) {
    return { nome: k, meta: byProd[k].meta, real: byProd[k].real };
  }).filter(function(r) { return r.real > 0 || r.meta > 0; })
    .sort(function(a, b) { return b.real - a.real; })
    .slice(0, 10);

  var totalReal = list.reduce(function(s, r) { return s + r.real; }, 0);

  var html = '<div class="exec-table-header"><span>#</span><span>PRODUTO</span><span style="text-align:right">REAL</span><span style="text-align:right">%</span></div>';
  html += '<div class="exec-table-list">';
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var pct = totalReal > 0 ? r.real / totalReal * 100 : 0;
    html += '<div class="exec-table-row">';
    html += '<span style="color:var(--text-dim)">' + (i + 1) + '</span>';
    html += '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + escHtml(r.nome) + '">' + escHtml(r.nome.slice(0, 25)) + '</span>';
    html += '<span style="text-align:right;font-weight:700">' + fmtBRL(r.real) + '</span>';
    html += '<span style="text-align:right;color:' + pctColor(pct > 20 ? 90 : pct > 10 ? 60 : 30) + '">' + fmtPct(pct) + '</span>';
    html += '</div>';
  }
  if (list.length === 0) html += '<div style="text-align:center;padding:16px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem dados de produtos</div>';
  html += '</div>';
  html += '<div class="exec-table-total"><span>' + list.length + ' produtos</span><span style="color:var(--accent)">' + fmtBRL(totalReal) + '</span></div>';
  el.innerHTML = html;
}

/* ═══ COMPARATIVO ANUAL (2025 vs 2026) ═══ */
function renderComparativoAnual(cfg) {
  var el = document.getElementById('comparativo-anual');
  if (!el) return;

  var movAtual = DATA.movimento || [];
  var movPrev = DATA.movimentoPrev || [];
  var movPrev2 = DATA.movimentoPrev2 || [];
  var vertFilter = cfg.vertical || null;
  if (vertFilter) {
    movAtual = movAtual.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; });
    movPrev = movPrev.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; });
    movPrev2 = movPrev2.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; });
  }

  var y0 = YEAR - 2, y1 = YEAR - 1, y2 = YEAR;
  var mNames = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

  function sumMonth(arr, key) {
    return arr.filter(function(r) { return r.id_tempo === key; }).reduce(function(s, r) { return s + r._valor; }, 0);
  }

  var html = '<div class="comp3-header">';
  html += '<span class="comp3-col-mes">MÊS</span>';
  html += '<span class="comp3-col-val">' + y0 + '</span>';
  html += '<span class="comp3-col-val">' + y1 + '</span>';
  html += '<span class="comp3-col-val" style="color:var(--accent)">' + y2 + '</span>';
  html += '<span class="comp3-col-var">VAR</span>';
  html += '</div>';
  html += '<div class="comp3-list">';

  var t0 = 0, t1 = 0, t2 = 0;
  for (var m = 1; m <= 12; m++) {
    var key = String(m).padStart(2, '0');
    var v0 = sumMonth(movPrev2, y0 + '-' + key);
    var v1 = sumMonth(movPrev, y1 + '-' + key);
    var v2 = sumMonth(movAtual, y2 + '-' + key);
    t0 += v0; t1 += v1; t2 += v2;

    var varPct = v1 > 0 ? ((v2 - v1) / v1 * 100) : (v2 > 0 ? 100 : 0);
    var isCurrent = m === MONTH;
    var isFuture = m > MONTH;
    var cls = isCurrent ? ' comp3-current' : isFuture ? ' comp3-future' : '';
    var partial = isCurrent ? ' *' : '';

    html += '<div class="comp3-row' + cls + '">';
    html += '<span class="comp3-col-mes">' + mNames[m - 1] + partial + '</span>';
    html += '<span class="comp3-col-val comp3-dim">' + (v0 > 0 ? fmtBRL(v0) : '—') + '</span>';
    html += '<span class="comp3-col-val comp3-dim">' + (v1 > 0 ? fmtBRL(v1) : '—') + '</span>';
    html += '<span class="comp3-col-val comp3-bold">' + (v2 > 0 ? fmtBRL(v2) : '—') + '</span>';
    var varColor = varPct > 0 ? 'var(--green)' : varPct < 0 ? 'var(--red)' : 'var(--text-dim)';
    var varArrow = varPct > 0 ? '▲' : varPct < 0 ? '▼' : '';
    html += '<span class="comp3-col-var" style="color:' + varColor + '">' + varArrow + (v1 > 0 || v2 > 0 ? fmtPct(Math.abs(varPct)) : '—') + '</span>';
    html += '</div>';
  }
  html += '</div>';

  var tVar = t1 > 0 ? ((t2 - t1) / t1 * 100) : 0;
  html += '<div class="comp3-total">';
  html += '<span class="comp3-col-mes">TOTAL</span>';
  html += '<span class="comp3-col-val comp3-dim">' + fmtBRL(t0) + '</span>';
  html += '<span class="comp3-col-val comp3-dim">' + fmtBRL(t1) + '</span>';
  html += '<span class="comp3-col-val comp3-bold" style="color:var(--accent)">' + fmtBRL(t2) + '</span>';
  html += '<span class="comp3-col-var" style="color:' + (tVar >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (tVar >= 0 ? '▲' : '▼') + fmtPct(Math.abs(tVar)) + '</span>';
  html += '</div>';

  html += '<div style="text-align:right;font-size:8px;color:var(--text-dim);padding:4px 6px">* mês parcial</div>';
  el.innerHTML = html;
}

/* ═══ MAPA POR UF ═══ */
function renderMapaUF(cfg) {
  var el = document.getElementById('mapa-uf');
  if (!el) return;

  var mov = DATA.movimento || [];
  var vertFilter = cfg.vertical || null;
  if (vertFilter) mov = mov.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; });

  var byUF = {};
  mov.forEach(function(m) {
    var uf = (m.uf || 'N/D').toUpperCase().trim();
    if (!byUF[uf]) byUF[uf] = { valor: 0, clientes: new Set(), nfs: 0 };
    byUF[uf].valor += m._valor;
    byUF[uf].clientes.add(m.nome_cliente || '');
    byUF[uf].nfs++;
  });

  var list = Object.keys(byUF).map(function(k) {
    return { uf: k, valor: byUF[k].valor, clientes: byUF[k].clientes.size, nfs: byUF[k].nfs };
  }).sort(function(a, b) { return b.valor - a.valor; }).slice(0, 15);

  var totalVal = list.reduce(function(s, r) { return s + r.valor; }, 0);

  var html = '<div class="exec-table-header"><span>UF</span><span style="text-align:center">CLIENTES</span><span style="text-align:right">FATURAMENTO</span><span style="text-align:right">%</span></div>';
  html += '<div class="exec-table-list">';
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var pct = totalVal > 0 ? r.valor / totalVal * 100 : 0;
    html += '<div class="exec-table-row">';
    html += '<span style="font-weight:700">' + escHtml(r.uf) + '</span>';
    html += '<span style="text-align:center;color:var(--text-dim)">' + r.clientes + '</span>';
    html += '<span style="text-align:right;font-weight:700">' + fmtBRL(r.valor) + '</span>';
    html += '<span style="text-align:right;color:var(--text-dim)">' + fmtPct(pct) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  html += '<div class="exec-table-total"><span>' + list.length + ' UFs</span><span style="color:var(--accent)">' + fmtBRL(totalVal) + '</span></div>';
  el.innerHTML = html;
}

/* ═══ FUNIL DE LEADS ═══ */
function renderFunilLeads(cfg) {
  var el = document.getElementById('funil-leads');
  if (!el) return;

  var leads = DATA.leads || [];
  var vertFilter = cfg.vertical || null;
  if (vertFilter) leads = leads.filter(function(l) { return isVertConsultor(l.consultor_nome, vertFilter); });

  // Group by etapa
  var byEtapa = {};
  var etapaOrder = ['Prospecção', 'Contato Inicial', 'Qualificação', 'Proposta', 'Negociação', 'Fechamento'];
  leads.forEach(function(l) {
    var etapa = l.etapa || 'Sem Etapa';
    if (!byEtapa[etapa]) byEtapa[etapa] = { count: 0, quentes: 0 };
    byEtapa[etapa].count++;
    if (safeNum(l.temperatura) >= 5) byEtapa[etapa].quentes++;
  });

  var total = leads.length;
  var html = '<div class="funil-container">';

  // Show known stages first, then others
  var shown = [];
  etapaOrder.forEach(function(e) { if (byEtapa[e]) shown.push(e); });
  Object.keys(byEtapa).forEach(function(e) { if (shown.indexOf(e) < 0) shown.push(e); });

  for (var i = 0; i < shown.length; i++) {
    var etapa = shown[i];
    var d = byEtapa[etapa];
    var pct = total > 0 ? d.count / total * 100 : 0;
    var barWidth = Math.max(pct, 8);
    html += '<div class="funil-row">';
    html += '<span class="funil-label">' + escHtml(etapa) + '</span>';
    html += '<div class="funil-bar-track"><div class="funil-bar-fill" style="width:' + barWidth + '%;background:var(--accent);opacity:' + (1 - i * 0.1) + '"></div></div>';
    html += '<span class="funil-count">' + d.count + (d.quentes > 0 ? ' <span style="color:var(--red);font-size:8px">(' + d.quentes + '🔥)</span>' : '') + '</span>';
    html += '</div>';
  }
  html += '</div>';

  // Summary
  var quentes = leads.filter(function(l) { return safeNum(l.temperatura) >= 5; }).length;
  var semana = leads.filter(function(l) {
    var d7 = new Date(); d7.setDate(d7.getDate() - 7);
    return (l.data_entrada || '') >= d7.toISOString().slice(0, 10);
  }).length;
  html += '<div class="exec-table-total"><span>' + total + ' leads</span><span style="color:var(--red)">' + quentes + ' quentes</span><span style="color:var(--blue)">' + semana + ' novos 7d</span></div>';
  el.innerHTML = html;
}

/* ═══ LOCAÇÕES ATIVAS (ÁGUA) ═══ */
function renderLocacoesAtivas(cfg) {
  var el = document.getElementById('locacoes-ativas');
  if (!el) return;

  var loc = DATA.locacao || [];
  if (loc.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:20px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem dados de locação</div>';
    return;
  }

  // Group by month
  var byMonth = {};
  var byCliente = {};
  loc.forEach(function(r) {
    var t = r.id_tempo || '';
    byMonth[t] = (byMonth[t] || 0) + safeNum(r.vlr_liquido);
    var cli = r.cliente || 'N/D';
    if (!byCliente[cli]) byCliente[cli] = 0;
    byCliente[cli] += safeNum(r.vlr_liquido);
  });

  var mrmVal = byMonth[MONTH_STR] || 0;
  var totalAno = loc.reduce(function(s, r) { return s + safeNum(r.vlr_liquido); }, 0);
  var contratos = new Set(loc.map(function(r) { return r.cliente; })).size;

  // Top clients
  var topCli = Object.keys(byCliente).map(function(k) {
    return { nome: k, valor: byCliente[k] };
  }).sort(function(a, b) { return b.valor - a.valor; }).slice(0, 8);

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">';
  html += '<div class="loc-kpi"><span class="loc-kpi-label">MRR (mensal)</span><span class="loc-kpi-val">' + fmtBRL(mrmVal) + '</span></div>';
  html += '<div class="loc-kpi"><span class="loc-kpi-label">Acum. ' + YEAR + '</span><span class="loc-kpi-val">' + fmtBRL(totalAno) + '</span></div>';
  html += '<div class="loc-kpi"><span class="loc-kpi-label">Clientes</span><span class="loc-kpi-val">' + contratos + '</span></div>';
  html += '</div>';

  html += '<div class="exec-table-header"><span>CLIENTE</span><span style="text-align:right">VALOR ANO</span></div>';
  html += '<div class="exec-table-list">';
  for (var i = 0; i < topCli.length; i++) {
    html += '<div class="exec-table-row" style="grid-template-columns:1fr auto">';
    html += '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(topCli[i].nome.slice(0, 30)) + '</span>';
    html += '<span style="text-align:right;font-weight:700">' + fmtBRL(topCli[i].valor) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

/* ═══ CLIENTES NOVOS vs RECORRENTES ═══ */
function renderClientesNovosRecorrentes(cfg) {
  var el = document.getElementById('clientes-novos-rec');
  if (!el) return;

  var movAtual = DATA.movimento || [];
  var movPrev = DATA.movimentoPrev || [];
  var vertFilter = cfg.vertical || null;
  if (vertFilter) {
    movAtual = movAtual.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; });
    movPrev = movPrev.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; });
  }

  // Clients who bought in previous year
  var prevClientes = new Set();
  movPrev.forEach(function(m) { if (m.nome_cliente) prevClientes.add(m.nome_cliente.toUpperCase().trim()); });

  // Current year clients
  var novos = {}, recorrentes = {};
  movAtual.forEach(function(m) {
    var cli = (m.nome_cliente || '').toUpperCase().trim();
    if (!cli) return;
    var isNovo = !prevClientes.has(cli);
    var bucket = isNovo ? novos : recorrentes;
    if (!bucket[cli]) bucket[cli] = 0;
    bucket[cli] += m._valor;
  });

  var novosCount = Object.keys(novos).length;
  var recCount = Object.keys(recorrentes).length;
  var novosVal = Object.values(novos).reduce(function(s, v) { return s + v; }, 0);
  var recVal = Object.values(recorrentes).reduce(function(s, v) { return s + v; }, 0);
  var totalVal = novosVal + recVal;
  var totalCount = novosCount + recCount;

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
  // Novos
  html += '<div style="background:rgba(45,140,240,.06);border:1px solid rgba(45,140,240,.2);border-radius:6px;padding:8px;text-align:center">';
  html += '<div style="font-family:var(--mono);font-size:8px;color:var(--blue);font-weight:700;text-transform:uppercase;letter-spacing:.8px">NOVOS</div>';
  html += '<div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--blue)">' + novosCount + '</div>';
  html += '<div style="font-family:var(--mono);font-size:9px;color:var(--text-dim)">' + fmtBRL(novosVal) + '</div>';
  html += '<div style="font-family:var(--mono);font-size:8px;color:var(--text-dim)">' + (totalVal > 0 ? fmtPct(novosVal / totalVal * 100) : '0%') + ' do fat.</div>';
  html += '</div>';
  // Recorrentes
  html += '<div style="background:rgba(0,212,170,.06);border:1px solid rgba(0,212,170,.2);border-radius:6px;padding:8px;text-align:center">';
  html += '<div style="font-family:var(--mono);font-size:8px;color:var(--green);font-weight:700;text-transform:uppercase;letter-spacing:.8px">RECORRENTES</div>';
  html += '<div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--green)">' + recCount + '</div>';
  html += '<div style="font-family:var(--mono);font-size:9px;color:var(--text-dim)">' + fmtBRL(recVal) + '</div>';
  html += '<div style="font-family:var(--mono);font-size:8px;color:var(--text-dim)">' + (totalVal > 0 ? fmtPct(recVal / totalVal * 100) : '0%') + ' do fat.</div>';
  html += '</div></div>';

  // Top novos
  var topNovos = Object.keys(novos).map(function(k) { return { nome: k, valor: novos[k] }; })
    .sort(function(a, b) { return b.valor - a.valor; }).slice(0, 5);
  if (topNovos.length > 0) {
    html += '<div style="font-family:var(--mono);font-size:7px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px">TOP NOVOS ' + YEAR + '</div>';
    html += '<div class="exec-table-list">';
    for (var i = 0; i < topNovos.length; i++) {
      html += '<div class="exec-table-row" style="grid-template-columns:1fr auto">';
      html += '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(topNovos[i].nome.slice(0, 28)) + '</span>';
      html += '<span style="text-align:right;font-weight:700;color:var(--blue)">' + fmtBRL(topNovos[i].valor) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }
  el.innerHTML = html;
}
