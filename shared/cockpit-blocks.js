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

/* ═══ SORTABLE STATE ═══ */
var _sortState = {};
function toggleSort(blockId, colKey) {
  if (!_sortState[blockId]) _sortState[blockId] = { col: colKey, dir: 'desc' };
  else if (_sortState[blockId].col === colKey) _sortState[blockId].dir = _sortState[blockId].dir === 'asc' ? 'desc' : 'asc';
  else _sortState[blockId] = { col: colKey, dir: 'desc' };
  if (window._lastCfg) renderAll(window._lastCfg);
}
function sortArrow(blockId, colKey) {
  var s = _sortState[blockId];
  if (!s || s.col !== colKey) return '';
  return s.dir === 'asc' ? ' ▲' : ' ▼';
}
function sortableHeader(blockId, colKey, label, style) {
  return '<span class="sortable-col" onclick="toggleSort(\'' + blockId + '\',\'' + colKey + '\')" style="cursor:pointer;user-select:none;' + (style || '') + '">' + label + sortArrow(blockId, colKey) + '</span>';
}
function applySortToList(blockId, list, colMap) {
  var s = _sortState[blockId];
  if (!s || !colMap[s.col]) return list;
  var fn = colMap[s.col];
  var dir = s.dir === 'asc' ? 1 : -1;
  return list.slice().sort(function(a, b) {
    var va = fn(a), vb = fn(b);
    if (typeof va === 'string') return dir * va.localeCompare(vb);
    return dir * (va - vb);
  });
}

/* ═══ DRAG & DROP CARDS ═══ */
var _dragSrc = null;
function initDragDrop() {
  var mosaics = document.querySelectorAll('.mosaic');
  for (var mi = 0; mi < mosaics.length; mi++) {
    var mosaic = mosaics[mi];
    var cards = mosaic.querySelectorAll('.card');
    for (var ci = 0; ci < cards.length; ci++) {
      var card = cards[ci];
      // Assign card ID from child .card-body id
      var body = card.querySelector('.card-body');
      if (body && body.id) card.setAttribute('data-card-id', body.id);
      card.setAttribute('draggable', 'true');
      // Add drag handle indicator
      if (!card.querySelector('.drag-handle')) {
        var handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '⋮⋮';
        card.appendChild(handle);
      }
      card.addEventListener('dragstart', _onDragStart);
      card.addEventListener('dragend', _onDragEnd);
      card.addEventListener('dragover', _onDragOver);
      card.addEventListener('dragenter', _onDragEnter);
      card.addEventListener('dragleave', _onDragLeave);
      card.addEventListener('drop', _onDrop);
    }
  }
  // Restore saved order
  _restoreCardOrder();
}

function _onDragStart(e) {
  _dragSrc = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.getAttribute('data-card-id') || '');
}
function _onDragEnd(e) {
  this.classList.remove('dragging');
  // Clean up all drag-over
  var all = document.querySelectorAll('.drag-over');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('drag-over');
  _dragSrc = null;
}
function _onDragOver(e) {
  if (!_dragSrc) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function _onDragEnter(e) {
  if (!_dragSrc) return;
  e.preventDefault();
  var card = _getCardEl(e.target);
  if (card && card !== _dragSrc) card.classList.add('drag-over');
}
function _onDragLeave(e) {
  var card = _getCardEl(e.target);
  if (card && !card.contains(e.relatedTarget)) card.classList.remove('drag-over');
}
function _onDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  var target = _getCardEl(e.target);
  if (!target || target === _dragSrc || !_dragSrc) return;
  target.classList.remove('drag-over');
  // Swap DOM positions within same mosaic
  var mosaic = _dragSrc.parentNode;
  if (mosaic !== target.parentNode) return;
  var allCards = Array.prototype.slice.call(mosaic.querySelectorAll('.card'));
  var srcIdx = allCards.indexOf(_dragSrc);
  var tgtIdx = allCards.indexOf(target);
  if (srcIdx < tgtIdx) {
    mosaic.insertBefore(_dragSrc, target.nextSibling);
  } else {
    mosaic.insertBefore(_dragSrc, target);
  }
  _saveCardOrder();
}
function _getCardEl(el) {
  while (el && !el.classList.contains('card')) el = el.parentElement;
  return el;
}
function _saveCardOrder() {
  var mosaics = document.querySelectorAll('.mosaic');
  var order = [];
  for (var mi = 0; mi < mosaics.length; mi++) {
    var cards = mosaics[mi].querySelectorAll('.card');
    var ids = [];
    for (var ci = 0; ci < cards.length; ci++) {
      ids.push(cards[ci].getAttribute('data-card-id') || '');
    }
    order.push(ids);
  }
  var page = document.title.replace(/[^A-Z]/g, '').slice(0, 8);
  localStorage.setItem('tv-card-order-' + page, JSON.stringify(order));
}
function _restoreCardOrder() {
  var page = document.title.replace(/[^A-Z]/g, '').slice(0, 8);
  var saved = localStorage.getItem('tv-card-order-' + page);
  if (!saved) return;
  try { var order = JSON.parse(saved); } catch(e) { return; }
  var mosaics = document.querySelectorAll('.mosaic');
  for (var mi = 0; mi < mosaics.length && mi < order.length; mi++) {
    var mosaic = mosaics[mi];
    var savedIds = order[mi];
    if (!savedIds || !savedIds.length) continue;
    var cardMap = {};
    var cards = mosaic.querySelectorAll('.card');
    for (var ci = 0; ci < cards.length; ci++) {
      var id = cards[ci].getAttribute('data-card-id') || '';
      if (id) cardMap[id] = cards[ci];
    }
    for (var si = 0; si < savedIds.length; si++) {
      var card = cardMap[savedIds[si]];
      if (card) mosaic.appendChild(card);
    }
  }
}
function resetCardOrder() {
  var page = document.title.replace(/[^A-Z]/g, '').slice(0, 8);
  localStorage.removeItem('tv-card-order-' + page);
  location.reload();
}

/* ═══ FAT-DIA EXPAND STATE ═══ */
var _fatDiaExpanded = {};
function toggleFatDiaDay(dateStr) {
  _fatDiaExpanded[dateStr] = !_fatDiaExpanded[dateStr];
  if (window._lastCfg) renderAll(window._lastCfg);
}

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
    var c = VERT_CONSULTORES[i];
    var cn = c.nome_agrupado || c.nome || '';
    var cv = normalizeVertical(c.vertical || '');
    if (cv !== vertFilter) continue;
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
  // vertical filter removed — JS normalizeVertical handles it
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

  // 8b. Locação ano anterior (comparativo)
  pending++;
  sbFetch('vw_locacao_completa', 'id_tempo=like.' + String(YEAR - 1) + '-*').then(function(d) { DATA.locacaoPrev = d || []; done(); }).catch(function(){ done(); });

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

  // Locação (só incluir se vertical AGUA ou sem filtro — nunca no AGRO/FLORESTAS/CORPORATIVO)
  var incluiLoc = !vertFilter || vertFilter === 'AGUA';
  var locMonth = 0, locYTD = 0, locAno = 0;
  if (incluiLoc) {
    (DATA.locacao || []).forEach(function(r) {
      var v = safeNum(r.vlr_liquido);
      locAno += v;
      var parts = (r.id_tempo || '').split('-');
      var lMonth = parseInt(parts[1]) || 0;
      if (lMonth <= MONTH) locYTD += v;
      if (lMonth === MONTH) locMonth += v;
    });
  }
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
  window._lastCfg = cfg;
  var kpis = computeAllKPIs(cfg);
  console.log('[DEBUG] KPIs:', JSON.stringify({realMonth:kpis.realMonth,metaMonth:kpis.metaMonth,realYTD:kpis.realYTD,carteiraTotal:kpis.carteiraTotal,leadsAtivos:kpis.leadsAtivos}));
  console.log('[DEBUG] DATA sizes:', JSON.stringify({movimento:(DATA.movimento||[]).length,planVertical:(DATA.planVertical||[]).length,planConsultor:(DATA.planConsultor||[]).length,planCliente:(DATA.planCliente||[]).length,planProduto:(DATA.planProduto||[]).length,carteira:(DATA.carteira||[]).length,leads:(DATA.leads||[]).length}));
  var blocks = [
    function() { renderKPIs(kpis, cfg); },
    function() { renderMemoriaCalculo(kpis, cfg); },
    function() { renderDailyTable(kpis, cfg); },
    function() { renderFaturamentoDia(cfg); },
    function() { renderRanking(kpis, cfg); },
    function() { renderPedidos(cfg); },
    function() { renderMonthlyVision(cfg); },
    function() { renderCarteiraDetalhada(kpis, cfg); },
    function() { renderClientes8020(cfg); },
    function() { renderAgendaCheckin(cfg); },
    function() { renderFreteMonitor(cfg); },
    function() { renderMapaPontos(cfg); },
    function() { renderProdutosTop(cfg); },
    function() { renderComparativoAnual(cfg); },
    function() { renderMapaUF(cfg); },
    function() { renderFunilLeads(cfg); },
    function() { renderLocacoesAtivas(cfg); },
    function() { renderClientesNovosRecorrentes(cfg); },
    function() { renderFeed(cfg); },
  ];
  for (var i = 0; i < blocks.length; i++) {
    try { blocks[i](); } catch(e) { console.error('[COCKPIT] Block ' + i + ' error:', e); }
  }

  // Ticker
  var monthName = MONTH_NAMES_FULL[MONTH - 1];
  var tkTitle = document.getElementById('tk-title');
  if (tkTitle) tkTitle.textContent = (cfg.title || 'COCKPIT') + ' — ' + monthName.toUpperCase() + ' ' + YEAR;
  renderTicker(kpis.atingMonth, kpis.atingYTD, kpis.carteiraTotal, kpis.bizLeft);
  initDragDrop();
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

    if (DATA.locacao && (!cfg.vertical || cfg.vertical === 'AGUA')) {
      DATA.locacao.forEach(function(r) {
        if ((r.dt_faturamento || r.id_tempo || '').startsWith(dayStr)) val += safeNum(r.vlr_liquido);
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

  var mesAtual = TODAY_STR.slice(0, 7);
  var mesMov = mov.filter(function(m) { return (m.data_faturamento || '').slice(0, 7) === mesAtual; });

  if (DATA.locacao && (!cfg.vertical || cfg.vertical === 'AGUA')) {
    DATA.locacao.forEach(function(r) {
      var dt = r.dt_faturamento || '';
      if (dt.slice(0, 7) === mesAtual) {
        mesMov.push({
          data_faturamento: dt,
          nome_cliente: r.cliente || r.nome_produto || 'LOCAÇÃO',
          _valor: safeNum(r.vlr_liquido),
          _frete: 0,
          _isLocacao: true
        });
      }
    });
  }

  // Serviço (SE1 nat-servico regime caixa) — bate Q1 +1,8% vs controladoria
  if (DATA.servico) {
    DATA.servico.forEach(function(r) {
      var dt = r.dt_faturamento || '';
      if (dt.slice(0, 7) === mesAtual) {
        mesMov.push({
          data_faturamento: dt,
          nome_cliente: r.cliente || r.nome_produto || 'SERVIÇO',
          _valor: safeNum(r.vlr_liquido),
          _frete: 0,
          _isServico: true
        });
      }
    });
  }

  // Sort and apply user sort if any
  var sortCols = {
    data: function(m) { return m.data_faturamento || ''; },
    valor: function(m) { return m._valor || 0; },
    cliente: function(m) { return (m.nome_cliente || '').toUpperCase(); }
  };
  mesMov = applySortToList('fat-dia', mesMov, sortCols);
  if (!_sortState['fat-dia']) {
    mesMov.sort(function(a, b) { return (a.data_faturamento || '').localeCompare(b.data_faturamento || ''); });
  }

  // Compute accumulated (always by date order)
  var byDateOrder = mesMov.slice().sort(function(a, b) { return (a.data_faturamento || '').localeCompare(b.data_faturamento || ''); });
  var acum = 0;
  var acumMap = {};
  for (var k = 0; k < byDateOrder.length; k++) {
    acum += byDateOrder[k]._valor || 0;
    if (!acumMap[byDateOrder[k].data_faturamento]) acumMap[byDateOrder[k].data_faturamento] = 0;
    acumMap[byDateOrder[k].data_faturamento] = acum;
  }
  var totalMes = acum;

  // Group by day
  var dayGroups = {};
  var dayOrder = [];
  for (var k = 0; k < mesMov.length; k++) {
    var d = (mesMov[k].data_faturamento || '').slice(0, 10);
    if (!dayGroups[d]) { dayGroups[d] = []; dayOrder.push(d); }
    dayGroups[d].push(mesMov[k]);
  }
  // If no custom sort, reverse day order (most recent first)
  if (!_sortState['fat-dia']) dayOrder.reverse();

  // Sound on new NF today
  var todayItems = dayGroups[TODAY_STR] || [];
  var todayCount = todayItems.length;
  var isNew = todayCount > _prevFatDiaCount && _prevFatDiaCount > 0;
  if (isNew) playSoundNF();
  _prevFatDiaCount = todayCount;

  var html = '<div class="fat-dia-header">';
  html += sortableHeader('fat-dia', 'data', 'DATA', '');
  html += '<span>TIPO</span>';
  html += sortableHeader('fat-dia', 'cliente', 'CLIENTE', '');
  html += sortableHeader('fat-dia', 'valor', 'VALOR', 'text-align:right');
  html += '<span style="text-align:right">ACUM</span>';
  html += '</div>';
  html += '<div class="fat-dia-list">';

  for (var di = 0; di < dayOrder.length; di++) {
    var dayStr = dayOrder[di];
    var items = dayGroups[dayStr];
    var dayTotal = items.reduce(function(s, m) { return s + (m._valor || 0); }, 0);
    var isToday = dayStr === TODAY_STR;
    var dtFmt = dayStr.slice(8, 10) + '/' + dayStr.slice(5, 7);
    var dayAcum = acumMap[dayStr] || 0;

    // Always show individual rows (no collapse)
    for (var i = 0; i < items.length; i++) {
      var m = items[i];
      var newCls = (isToday && i === 0 && isNew) ? ' new-entry' : '';
      var tipo = m._isLocacao ? 'LOCAÇÃO' : (m._isServico ? 'SERVIÇO' : (m.operacao_gerencial || 'VENDA'));
      var tipoColor = tipo === 'DEVOLUÇÃO' ? 'var(--red)' : tipo === 'LOCAÇÃO' ? 'var(--blue)' : tipo === 'SERVIÇO' ? '#a855f7' : 'var(--text-dim)';
      html += '<div class="fat-dia-row' + newCls + '">';
      html += '<span style="color:' + (isToday ? 'var(--green)' : 'var(--text-dim)') + '">' + dtFmt + '</span>';
      html += '<span style="color:' + tipoColor + ';font-size:7px;font-weight:700;white-space:nowrap">' + escHtml(tipo.slice(0, 8)) + '</span>';
      html += '<span title="' + escHtml(m.nome_cliente || '') + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml((m.nome_cliente || '').slice(0, 35)) + '</span>';
      html += '<span style="text-align:right;font-weight:700;' + (isToday ? 'color:var(--green)' : '') + '">' + fmtBRL(m._valor) + '</span>';
      html += '<span style="text-align:right;color:var(--text-dim)">' + (i === items.length - 1 ? fmtBRL(dayAcum) : '') + '</span>';
      html += '</div>';
    }
  }

  if (mesMov.length === 0) {
    html += '<div style="text-align:center;padding:20px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem faturamento no mês</div>';
  }

  html += '</div>';

  // Total row
  html += '<div style="display:flex;justify-content:space-between;padding:4px 6px;border-top:2px solid var(--accent);font-family:var(--mono);font-size:10px;font-weight:700;margin-top:4px">';
  html += '<span style="color:var(--text-dim)">' + mesMov.length + ' NFs mês · ' + todayCount + ' hoje · ' + dayOrder.length + ' dias</span>';
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
  var RANKING_PERFIS = ['consultor', 'gerente', 'diretor'];
  var source = cfg.isExec ? COLAB.filter(function(c) { var v = normalizeVertical(c.vertical); return (v === 'AGRO' || v === 'AGUA' || v === 'FLORESTAS' || v === 'CORPORATIVO') && RANKING_PERFIS.indexOf((c.perfil || '').toLowerCase()) >= 0; }) : VERT_CONSULTORES.filter(function(c) { return RANKING_PERFIS.indexOf((c.perfil || '').toLowerCase()) >= 0; });

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

  // Somar locação no realizado (só ÁGUA ou sem filtro vertical)
  if (!cfg.vertical || cfg.vertical === 'AGUA') (DATA.locacao || []).forEach(function(r) {
    var prof = r.profissional || '';
    var key = Object.keys(map).find(function(k) { return matchPlanName(k, prof) || matchPlanName(prof, k); });
    if (!key) return;
    var v = safeNum(r.vlr_liquido);
    var parts = (r.id_tempo || '').split('-');
    var m = parseInt(parts[1]) || 0;
    map[key].realAno += v;
    if (m === MONTH) map[key].realMes += v;
    if (m === MONTH - 1 || (MONTH === 1 && m === 12)) map[key].realPrevMes += v;
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

  var rankSortCols = {
    nome: function(r) { return r.nome.toUpperCase(); },
    real: function(r) { return r.realAno; },
    pct: function(r) { return r.pct; },
    meta: function(r) { return r.metaAno; }
  };
  if (_sortState['ranking']) {
    list = applySortToList('ranking', list, rankSortCols);
  } else {
    list.sort(function(a, b) { return b.pct - a.pct; });
  }

  var html = '<div class="rank-header">';
  html += '<span>#</span><span></span>';
  html += sortableHeader('ranking', 'nome', 'CONSULTOR', '');
  html += sortableHeader('ranking', 'real', 'META × REAL', '');
  html += sortableHeader('ranking', 'pct', '%', '');
  html += '<span></span>';
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

  var pedSortCols = {
    data: function(c) { return c.dt_pedido || c.created_at || ''; },
    cliente: function(c) { return (c.nome_cliente || '').toUpperCase(); },
    consultor: function(c) { return (c.representante || c.consultor || '').toUpperCase(); },
    valor: function(c) { return safeNum(c.vlr_carteira || c.vlr_total); }
  };
  var sorted;
  if (_sortState['pedidos']) {
    sorted = applySortToList('pedidos', cart, pedSortCols);
  } else {
    sorted = cart.slice().sort(function(a, b) {
      return (b.dt_pedido || b.created_at || '').localeCompare(a.dt_pedido || a.created_at || '');
    });
  }

  var totalCarteira = sorted.reduce(function(s, c) { return s + safeNum(c.vlr_carteira || c.vlr_total); }, 0);

  var html = '<div class="pedido-header">';
  html += sortableHeader('pedidos', 'data', 'DATA', '');
  html += sortableHeader('pedidos', 'cliente', 'CLIENTE', '');
  html += sortableHeader('pedidos', 'consultor', 'CONSULTOR', '');
  html += sortableHeader('pedidos', 'valor', 'VALOR', 'text-align:right');
  html += '</div>';
  html += '<div class="pedidos-list">';

  var shown = Math.min(sorted.length, 30);
  for (var i = 0; i < shown; i++) {
    var p = sorted[i];
    var data = (p.dt_pedido || p.created_at || '').slice(0, 10);
    var isToday = data === TODAY_STR;

    html += '<div class="pedido-row' + (isToday ? ' today' : '') + '">';
    html += '<span>' + (data ? data.slice(8, 10) + '/' + data.slice(5, 7) : '—') + '</span>';
    html += '<span title="' + escHtml(p.nome_cliente || '') + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml((p.nome_cliente || '').slice(0, 40)) + '</span>';
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
  var plan = vertFilter ? planAll.filter(function(p) { return normalizeVertical(p.vertical || '') === vertFilter; }) : planAll;

  var html = '<div class="month-mosaic">';
  for (var m = 1; m <= 12; m++) {
    var mStr = YEAR + '-' + String(m).padStart(2, '0');
    var isCurrent = m === MONTH;
    var isFuture = m > MONTH;

    var monthPlan = plan.filter(function(p) { return p.id_tempo === mStr; });
    var meta = monthPlan.reduce(function(s, p) { return s + safeNum(p.meta); }, 0);
    var real = monthPlan.reduce(function(s, p) { return s + safeNum(p.realizado); }, 0);

    // Add locação for AGUA or executive (no vertical filter)
    if (DATA.locacao && (!vertFilter || vertFilter === 'AGUA')) {
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
    var raw = c.consultor || 'OUTROS';
    // Normalizar pelo colaboradores
    var nome = raw;
    for (var i = 0; i < COLAB.length; i++) {
      var cn = COLAB[i].nome_agrupado || COLAB[i].nome || '';
      if (cn && matchPlanName(raw, cn)) { nome = cn; break; }
    }
    if (!byConsultor[nome]) byConsultor[nome] = { pedidos: 0, clientes: new Set(), valor: 0 };
    byConsultor[nome].pedidos++;
    byConsultor[nome].clientes.add(c.nome_cliente || c.cliente || '');
    byConsultor[nome].valor += safeNum(c.valor || c.vlr_total);
  });

  var total = kpis.carteiraTotal || 1;
  var list = Object.keys(byConsultor).map(function(k) {
    return { nome: k, pedidos: byConsultor[k].pedidos, clientes: byConsultor[k].clientes.size, valor: byConsultor[k].valor };
  });
  var cartDetSortCols = {
    nome: function(r) { return r.nome.toUpperCase(); },
    pedidos: function(r) { return r.pedidos; },
    clientes: function(r) { return r.clientes; },
    valor: function(r) { return r.valor; }
  };
  if (_sortState['cart-det']) {
    list = applySortToList('cart-det', list, cartDetSortCols);
  } else {
    list.sort(function(a, b) { return b.valor - a.valor; });
  }

  var html = '<table class="cart-table"><thead><tr>';
  html += '<th>' + sortableHeader('cart-det', 'nome', 'Consultor', '') + '</th>';
  html += '<th style="text-align:center">' + sortableHeader('cart-det', 'pedidos', 'Pedidos', 'text-align:center') + '</th>';
  html += '<th style="text-align:center">' + sortableHeader('cart-det', 'clientes', 'Clientes', 'text-align:center') + '</th>';
  html += '<th style="text-align:right">' + sortableHeader('cart-det', 'valor', 'Valor', 'text-align:right') + '</th>';
  html += '<th style="text-align:right">%</th>';
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
  var cli8020SortCols = {
    cliente: function(r) { return (r.cliente || '').toUpperCase(); },
    meta: function(r) { return safeNum(r.meta); },
    real: function(r) { return safeNum(r.realizado); }
  };
  var sorted;
  if (_sortState['cli8020']) {
    sorted = applySortToList('cli8020', data, cli8020SortCols);
  } else {
    sorted = data.slice().sort(function(a, b) { return safeNum(b.realizado) - safeNum(a.realizado); });
  }
  var totalReal = sorted.reduce(function(s, r) { return s + safeNum(r.realizado); }, 0) || 1;

  var html = '<table class="detail-table"><thead><tr>';
  html += '<th>' + sortableHeader('cli8020', 'cliente', 'Cliente', '') + '</th>';
  html += '<th class="right">' + sortableHeader('cli8020', 'meta', 'Meta', 'text-align:right') + '</th>';
  html += '<th class="right">' + sortableHeader('cli8020', 'real', 'Real', 'text-align:right') + '</th>';
  html += '<th class="right">%</th><th class="right">Acum</th>';
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
    html += '<td><span class="dt-name">' + escHtml((c.cliente || '').slice(0, 45)) + '</span></td>';
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

  var agendaSortCols = {
    hora: function(a) { return a.hora || ''; },
    consultor: function(a) { return (a.consultor_nome || '').toUpperCase(); },
    status: function(a) { return a.status === 'realizada' ? 0 : 1; }
  };
  if (_sortState['agenda']) {
    todayActs = applySortToList('agenda', todayActs, agendaSortCols);
  } else {
    todayActs.sort(function(a, b) { return (a.hora || '').localeCompare(b.hora || ''); });
  }

  var done = todayActs.filter(function(a) { return a.status === 'realizada'; }).length;
  var pending = todayActs.filter(function(a) { return a.status !== 'realizada'; }).length;
  var hasCheckin = todayActs.filter(function(a) { return a.dados_checkin; }).length;

  // Sound on new check-in
  if (hasCheckin > 0 && hasCheckin > (window._prevCheckinCount || 0)) {
    playSoundCheckin();
  }
  window._prevCheckinCount = hasCheckin;

  var html = '<div class="agenda-header">';
  html += sortableHeader('agenda', 'hora', 'HORA', '');
  html += sortableHeader('agenda', 'status', 'ST', '');
  html += sortableHeader('agenda', 'consultor', 'CONSULTOR / ATIVIDADE', '');
  html += '<span>LEAD/CLIENTE</span>';
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
    html += '<span>' + escHtml((a.consultor_nome || '').split(' ').slice(0, 2).join(' ')) + (a.descricao ? ' — ' + escHtml(a.descricao.slice(0, 35)) : '') + (hasCI ? ' ✓CI' : '') + tipoTag + '</span>';
    html += '<span style="color:var(--text-dim)">' + escHtml((a.lead_nome || '').slice(0, 35)) + '</span>';
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
  // Primeiro: fretes em andamento (não fechados/entregues/cancelados)
  var emAndamento = fretes.filter(function(f) {
    var st = (f.status || '').toUpperCase();
    return st !== 'ENTREGUE' && st !== 'CANCELADO' && st !== 'FECHADO';
  });
  // Se não há em andamento, mostrar os últimos fechados do mês
  var active;
  if (emAndamento.length > 0) {
    active = emAndamento;
  } else {
    active = fretes.filter(function(f) {
      return (f.created_at || '').slice(0, 7) === MONTH_STR.slice(0, 7);
    });
  }
  var freteSortCols = {
    status: function(f) { return (f.status || '').toUpperCase(); },
    cliente: function(f) { return (f.cliente || '').toUpperCase(); },
    transportadora: function(f) { return (f.transportadora || '').toUpperCase(); },
    valor: function(f) { return safeNum(f.valor_cobrado); }
  };
  if (_sortState['fretes']) {
    active = applySortToList('fretes', active, freteSortCols);
  } else {
    active.sort(function(a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
  }

  var html = '<div class="frete-header">';
  html += sortableHeader('fretes', 'status', 'STATUS', '');
  html += sortableHeader('fretes', 'cliente', 'CLIENTE', '');
  html += sortableHeader('fretes', 'transportadora', 'TRANSPORT.', '');
  html += sortableHeader('fretes', 'valor', 'VALOR', 'text-align:right');
  html += '</div>';
  html += '<div class="frete-list">';

  var shown = Math.min(active.length, 10);
  for (var i = 0; i < shown; i++) {
    var f = active[i];
    var st = (f.status || '').toUpperCase();
    var stCot = (f.status_cotacao || '').toUpperCase();
    var statusCls = 'cotando';
    var statusLabel = 'ABERTO';
    if (stCot === 'APROVADO') { statusCls = 'aprovado'; statusLabel = 'APROVADO'; }
    if (st === 'FECHADO') { statusCls = 'enviado'; statusLabel = 'FECHADO'; }
    if (f.data_saida) { statusCls = 'enviado'; statusLabel = 'ENVIADO'; }
    if (f.codigo_rastreio) { statusCls = 'enviado'; statusLabel = 'RASTREIO'; }
    var prev = f.previsao_entrega ? f.previsao_entrega.slice(8, 10) + '/' + f.previsao_entrega.slice(5, 7) : '';

    html += '<div class="frete-row">';
    html += '<span class="frete-status ' + statusCls + '">' + statusLabel + '</span>';
    html += '<span title="' + escHtml(f.cliente || '') + '">' + escHtml((f.cliente || '').slice(0, 40)) + '</span>';
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
      msg: (a.consultor_nome || '').split(' ').slice(0, 2).join(' ') + ' — ' + (a.lead_nome || '').slice(0, 35),
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
  window._lastCfg = cfg;
  var kpis = computeAllKPIs(cfg);
  var blocks = [
    function() { renderKPIs(kpis, cfg); },
    function() { renderMemoriaCalculo(kpis, cfg); },
    function() { renderVerticalCards(); },
    function() { renderDailyTable(kpis, cfg); },
    function() { renderFaturamentoDia(cfg); },
    function() { renderRanking(kpis, cfg); },
    function() { renderPedidos(cfg); },
    function() { renderMonthlyVision(cfg); },
    function() { renderCarteiraDetalhada(kpis, cfg); },
    function() { renderClientes8020(cfg); },
    function() { renderAgendaCheckin(cfg); },
    function() { renderFreteMonitor(cfg); },
    function() { renderMapaPontos(cfg); },
    function() { renderFeed(cfg); },
    function() { renderProdutosTop(cfg); },
    function() { renderComparativoAnual(cfg); },
    function() { renderMapaUF(cfg); },
    function() { renderFunilLeads(cfg); },
    function() { renderLocacoesAtivas(cfg); },
    function() { renderClientesNovosRecorrentes(cfg); },
  ];
  for (var i = 0; i < blocks.length; i++) {
    try { blocks[i](); } catch(e) { console.error('[COCKPIT] Block ' + i + ' error:', e); }
  }

  var monthName = MONTH_NAMES_FULL[MONTH - 1];
  var tkTitle = document.getElementById('tk-title');
  if (tkTitle) tkTitle.textContent = 'EXECUTIVO — ' + monthName.toUpperCase() + ' ' + YEAR;
  renderTicker(kpis.atingMonth, kpis.atingYTD, kpis.carteiraTotal, kpis.bizLeft);
  initDragDrop();
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
  }).filter(function(r) { return r.real > 0 || r.meta > 0; });
  var prodSortCols = {
    produto: function(r) { return r.nome; },
    real: function(r) { return r.real; }
  };
  if (_sortState['produtos']) {
    list = applySortToList('produtos', list, prodSortCols);
  } else {
    list.sort(function(a, b) { return b.real - a.real; });
  }
  list = list.slice(0, 10);

  var totalReal = list.reduce(function(s, r) { return s + r.real; }, 0);

  var html = '<div class="exec-table-header"><span>#</span>' + sortableHeader('produtos', 'produto', 'PRODUTO', '') + sortableHeader('produtos', 'real', 'REAL', 'text-align:right') + '<span style="text-align:right">%</span></div>';
  html += '<div class="exec-table-list">';
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var pct = totalReal > 0 ? r.real / totalReal * 100 : 0;
    html += '<div class="exec-table-row">';
    html += '<span style="color:var(--text-dim)">' + (i + 1) + '</span>';
    html += '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + escHtml(r.nome) + '">' + escHtml(r.nome.slice(0, 40)) + '</span>';
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

  // Locação por mês (só soma se vertical null ou AGUA)
  var incluiLoc = !vertFilter || vertFilter === 'AGUA';
  var locByMonth = {}, locPrevByMonth = {};
  if (incluiLoc) {
    (DATA.locacao || []).forEach(function(r) {
      var t = r.id_tempo || '';
      locByMonth[t] = (locByMonth[t] || 0) + safeNum(r.vlr_liquido);
    });
    (DATA.locacaoPrev || []).forEach(function(r) {
      var t = r.id_tempo || '';
      locPrevByMonth[t] = (locPrevByMonth[t] || 0) + safeNum(r.vlr_liquido);
    });
  }

  var t0 = 0, t1 = 0, t2 = 0;
  for (var m = 1; m <= 12; m++) {
    var key = String(m).padStart(2, '0');
    var v0 = sumMonth(movPrev2, y0 + '-' + key);
    var v1 = sumMonth(movPrev, y1 + '-' + key) + (locPrevByMonth[y1 + '-' + key] || 0);
    var v2 = sumMonth(movAtual, y2 + '-' + key) + (locByMonth[y2 + '-' + key] || 0);
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

/* ═══ MAPA DE PONTOS — VENDAS · META · LEADS ═══ */
var _mapaInstance = null;
function renderMapaPontos(cfg) {
  var el = document.getElementById('mapa-pontos');
  if (!el || typeof L === 'undefined') return;

  // Lat/Lng capitais UF + raio dispersão em graus
  var UF_LL = {
    'AC':[-9.97,-67.81,1.5],'AL':[-9.66,-35.74,0.5],'AM':[-3.12,-60.02,3],'AP':[0.03,-51.06,1],
    'BA':[-12.97,-38.51,2.5],'CE':[-3.72,-38.52,1],'DF':[-15.78,-47.93,0.3],'ES':[-20.32,-40.34,0.6],
    'GO':[-16.68,-49.26,1.5],'MA':[-2.53,-44.28,1.5],'MG':[-19.92,-43.94,2],'MS':[-20.44,-54.65,1.5],
    'MT':[-15.60,-56.10,2.5],'PA':[-1.46,-48.50,2.5],'PB':[-7.12,-34.86,0.5],'PE':[-8.05,-34.87,0.8],
    'PI':[-5.09,-42.80,1.2],'PR':[-25.43,-49.27,1.2],'RJ':[-22.91,-43.17,0.6],'RN':[-5.79,-35.21,0.5],
    'RO':[-8.76,-63.90,1.5],'RR':[2.82,-60.67,1],'RS':[-30.03,-51.23,1.5],'SC':[-27.59,-48.55,0.8],
    'SE':[-10.91,-37.07,0.4],'SP':[-23.55,-46.63,1.5],'TO':[-10.18,-48.33,1.5]
  };

  // Hash para dispersão
  function cHash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
  function cityLL(cidade, uf) {
    var b = UF_LL[uf];
    if (!b) return null;
    var h = cHash(cidade + uf);
    var a = (Math.abs(h) % 360) * Math.PI / 180;
    var d = (Math.abs(h >> 8) % 100) / 100 * b[2];
    return [b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d];
  }

  // DDD → UF
  var DDD_UF = {
    '11':'SP','12':'SP','13':'SP','14':'SP','15':'SP','16':'SP','17':'SP','18':'SP','19':'SP',
    '21':'RJ','22':'RJ','24':'RJ','27':'ES','28':'ES',
    '31':'MG','32':'MG','33':'MG','34':'MG','35':'MG','37':'MG','38':'MG',
    '41':'PR','42':'PR','43':'PR','44':'PR','45':'PR','46':'PR',
    '47':'SC','48':'SC','49':'SC','51':'RS','53':'RS','54':'RS','55':'RS',
    '61':'DF','62':'GO','64':'GO','63':'TO','65':'MT','66':'MT','67':'MS','68':'AC','69':'RO',
    '71':'BA','73':'BA','74':'BA','75':'BA','77':'BA','79':'SE',
    '81':'PE','87':'PE','82':'AL','83':'PB','84':'RN',
    '85':'CE','88':'CE','86':'PI','89':'PI',
    '91':'PA','93':'PA','94':'PA','92':'AM','97':'AM','95':'RR','96':'AP',
    '98':'MA','99':'MA'
  };
  function ufFromDDD(tel) {
    var digits = (tel || '').replace(/\D/g, '');
    if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
    if (digits.length >= 10) return DDD_UF[digits.slice(0, 2)] || '';
    return '';
  }

  var mov = DATA.movimento || [];
  var leads = DATA.leads || [];
  var vertFilter = cfg.vertical || null;
  if (vertFilter) {
    mov = mov.filter(function(m) { return normalizeVertical(m.vertical || '') === vertFilter; });
  }

  // Vendas por município
  var vendasPontos = {};
  mov.forEach(function(m) {
    var cidade = (m.cidade || '').toUpperCase().trim();
    var uf = (m.uf || '').toUpperCase().trim();
    if (!cidade || !uf || !UF_LL[uf]) return;
    var key = cidade + '|' + uf;
    if (!vendasPontos[key]) vendasPontos[key] = { cidade: cidade, uf: uf, valor: 0 };
    vendasPontos[key].valor += m._valor;
  });
  var incluiLoc = !vertFilter || vertFilter === 'AGUA';
  if (incluiLoc) {
    (DATA.locacao || []).forEach(function(r) {
      var cidade = (r.cidade || '').toUpperCase().trim();
      var uf = (r.uf || '').toUpperCase().trim();
      if (!cidade || !uf || !UF_LL[uf]) return;
      var key = cidade + '|' + uf;
      if (!vendasPontos[key]) vendasPontos[key] = { cidade: cidade, uf: uf, valor: 0 };
      vendasPontos[key].valor += safeNum(r.vlr_liquido);
    });
  }

  // Leads por município — só mês atual
  var leadsPontos = {};
  leads.forEach(function(l) {
    if ((l.data_entrada || '').slice(0, 7) !== MONTH_STR.slice(0, 7)) return;
    var cidade = (l.cidade || '').toUpperCase().trim();
    var uf = (l.uf || '').toUpperCase().trim();
    if (!uf || !UF_LL[uf]) uf = ufFromDDD(l.telefone);
    if (!uf || !UF_LL[uf]) return;
    if (!cidade) cidade = 'DDD_' + uf;
    var key = cidade + '|' + uf;
    if (!leadsPontos[key]) leadsPontos[key] = { cidade: cidade, uf: uf, count: 0 };
    leadsPontos[key].count++;
  });

  // Setup Leaflet map
  var mapDiv = el;
  mapDiv.style.height = '320px';
  mapDiv.style.position = 'relative';

  if (_mapaInstance) { _mapaInstance.remove(); _mapaInstance = null; }
  var map = L.map(mapDiv, { zoomControl: false, attributionControl: false }).setView([-14, -52], 4);
  _mapaInstance = map;

  // Tile dark
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 18
  }).addTo(map);

  // Vendas (azul petróleo sólido)
  var vKeys = Object.keys(vendasPontos);
  var totalVendas = 0;
  for (var j = 0; j < vKeys.length; j++) {
    var vp = vendasPontos[vKeys[j]];
    totalVendas += vp.valor;
    var vll = cityLL(vp.cidade, vp.uf);
    if (!vll) continue;
    L.circleMarker(vll, {
      radius: 5, fillColor: '#0090b4', fillOpacity: 0.7, color: '#00a0cc', weight: 1.5
    }).bindTooltip(vp.cidade + ' — ' + fmtBRL(vp.valor), { className: 'mapa-tip' }).addTo(map);
  }

  // Leads (azul claro, pulsante via CSS)
  var lKeys = Object.keys(leadsPontos);
  var totalLeadsCt = 0;
  for (var k = 0; k < lKeys.length; k++) {
    var lp = leadsPontos[lKeys[k]];
    totalLeadsCt += lp.count;
    var lll = cityLL(lp.cidade, lp.uf);
    if (!lll) continue;
    var pulseIcon = L.divIcon({
      className: 'mapa-lead-pulse',
      iconSize: [16, 16],
      html: '<div style="width:8px;height:8px;background:rgba(0,210,250,0.9);border-radius:50%;box-shadow:0 0 8px rgba(0,210,250,0.6),0 0 16px rgba(0,210,250,0.3);animation:mapaPulse 2s ease-in-out infinite"></div>'
    });
    L.marker(lll, { icon: pulseIcon }).bindTooltip(lp.cidade + ' — ' + lp.count + ' leads', { className: 'mapa-tip' }).addTo(map);
  }

  // Inject pulse CSS once
  if (!document.getElementById('mapa-lead-css')) {
    var style = document.createElement('style');
    style.id = 'mapa-lead-css';
    style.textContent = '@keyframes mapaPulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.8);opacity:0.4}100%{transform:scale(1);opacity:1}}.mapa-lead-pulse{background:none!important;border:none!important}.mapa-tip{font-family:var(--mono,monospace);font-size:10px;background:rgba(0,30,50,0.9);color:#0cf;border:1px solid rgba(0,200,240,0.3);border-radius:4px}';
    document.head.appendChild(style);
  }

  // Legenda overlay
  var legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    var div = L.DomUtil.create('div');
    div.style.cssText = 'background:rgba(0,20,35,0.85);padding:6px 10px;border-radius:4px;font-family:var(--mono,monospace);font-size:8px;color:#aaa;border:1px solid rgba(0,100,130,0.3)';
    div.innerHTML = '<span style="color:#0090b4">●</span> VENDAS ' + vKeys.length + ' cidades · ' + fmtBRL(totalVendas) +
      '&nbsp;&nbsp;<span style="color:#00d2fa">●</span> LEADS ' + totalLeadsCt + ' em ' + lKeys.length + ' cidades';
    return div;
  };
  legend.addTo(map);
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

  // Locações são exclusivas da vertical ÁGUA — esconder para outras verticais
  if (cfg.vertical && cfg.vertical !== 'AGUA') {
    el.closest('.card').style.display = 'none';
    return;
  }

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
  });
  var locSortCols = {
    cliente: function(r) { return r.nome.toUpperCase(); },
    valor: function(r) { return r.valor; }
  };
  if (_sortState['locacoes']) {
    topCli = applySortToList('locacoes', topCli, locSortCols);
  } else {
    topCli.sort(function(a, b) { return b.valor - a.valor; });
  }
  topCli = topCli.slice(0, 8);

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">';
  html += '<div class="loc-kpi"><span class="loc-kpi-label">MRR (mensal)</span><span class="loc-kpi-val">' + fmtBRL(mrmVal) + '</span></div>';
  html += '<div class="loc-kpi"><span class="loc-kpi-label">Acum. ' + YEAR + '</span><span class="loc-kpi-val">' + fmtBRL(totalAno) + '</span></div>';
  html += '<div class="loc-kpi"><span class="loc-kpi-label">Clientes</span><span class="loc-kpi-val">' + contratos + '</span></div>';
  html += '</div>';

  html += '<div class="exec-table-header">' + sortableHeader('locacoes', 'cliente', 'CLIENTE', '') + sortableHeader('locacoes', 'valor', 'VALOR ANO', 'text-align:right') + '</div>';
  html += '<div class="exec-table-list">';
  for (var i = 0; i < topCli.length; i++) {
    html += '<div class="exec-table-row" style="grid-template-columns:1fr auto">';
    html += '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(topCli[i].nome.slice(0, 45)) + '</span>';
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

  // Incluir locação
  var incluiLoc = !vertFilter || vertFilter === 'AGUA';
  var locAtual = incluiLoc ? (DATA.locacao || []) : [];
  var locPrev = incluiLoc ? (DATA.locacaoPrev || []) : [];

  // Clients who bought in previous year
  var prevClientes = new Set();
  movPrev.forEach(function(m) { if (m.nome_cliente) prevClientes.add(m.nome_cliente.toUpperCase().trim()); });
  locPrev.forEach(function(r) { if (r.cliente) prevClientes.add(r.cliente.toUpperCase().trim()); });

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
  locAtual.forEach(function(r) {
    var cli = (r.cliente || '').toUpperCase().trim();
    if (!cli) return;
    var isNovo = !prevClientes.has(cli);
    var bucket = isNovo ? novos : recorrentes;
    if (!bucket[cli]) bucket[cli] = 0;
    bucket[cli] += safeNum(r.vlr_liquido);
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
