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
    // Serviço agora vem da NFS-e (DATA.servico). Excluir NFs de SERVIÇO do movimento pra
    // não contar serviço 2x. Movimento = VENDA + DEVOLUÇÃO (produto). Alinha c/ consolidado CRM. 07/07.
    DATA.movimento = (d || []).filter(function(r) { return (r.operacao_gerencial || '') !== 'SERVIÇO'; }).map(function(r) {
      r.consultor = r.consultor_agrupado || r.representante || '';
      r.vendedor = r.representante || '';
      r._valor = safeNum(r.receita_liquida);
      r._frete = safeNum(r.frete_rateado);
      return r;
    });
    done();
  }).catch(function(){ done(); });

  // 4b. Movimento completo do MÊS — só usado no bloco "Faturamento Histórico Live" (precisa nota + num_pedido + produto detalhado, que _fiscal não tem).
  pending++;
  var mesStr = yearStr + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
  var _dN = new Date(); var _pM = _dN.getMonth() + 2, _pY = _dN.getFullYear(); if (_pM > 12) { _pM = 1; _pY++; } var _proxMes = _pY + '-' + String(_pM).padStart(2, '0') + '-01';
  sbFetch('vw_movimento_completo', 'entra_meta=eq.true&data_faturamento=gte.' + mesStr + '-01&data_faturamento=lt.' + _proxMes + '&order=data_faturamento.desc').then(function(d) {
    // Agregar por (nota, num_pedido) — uma linha por NF (não por item).
    var byNota = {};
    (d || []).forEach(function(r) {
      var key = (r.nota || '') + '|' + (r.num_pedido || '');
      if (!byNota[key]) {
        byNota[key] = {
          data_faturamento: r.data_faturamento, nota: r.nota, num_pedido: r.num_pedido,
          nome_cliente: r.nome_cliente, representante: r.representante,
          cidade: r.cidade, uf: r.uf, vertical: r.vertical,
          operacao_gerencial: r.operacao_gerencial, tipo_operacao: r.tipo_operacao,
          produtos: [], qtd_total: 0, valor_total: 0, frete_total: 0
        };
      }
      var b = byNota[key];
      b.produtos.push({ nome: r.produto_nome, qtd: parseFloat(r.quantidade) || 0 });
      b.qtd_total += parseFloat(r.quantidade) || 0;
      b.valor_total += (parseFloat(r.faturamento_sem_frete) || 0) + (parseFloat(r.frete_rateado) || 0);
      b.frete_total += parseFloat(r.frete_rateado) || 0;
    });
    DATA.movNFs = Object.values(byNota);
    done();
  }).catch(function(){ DATA.movNFs = []; done(); });

  // 5. Carteira
  pending++;
  // 12/05 fix: filtrar arquivado_legado=false (lixo migração Protheus, 11 ped R$ 368K). Sem isso inflava de 30→41 ped.
  sbFetch('vw_pedidos_lifecycle', 'etapa=in.(carteira,faturando)&arquivado_legado=eq.false').then(function(d) {
    DATA.carteira = (d || []).map(function(r) {
      r.consultor = r.representante || r.consultor || '';
      r.vendedor = r.representante || '';
      // saldo a virar NF (não vlr_total puro). É o número que importa pra "carteira aberta".
      r.saldo_carteira = Math.max(0, (parseFloat(r.vlr_total) || 0) - (parseFloat(r.vlr_faturado) || 0));
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

  // 8. Locação ÁGUA — NFS-e OFICIAL da prefeitura (vw_nfse_consultor_note, atribuída por
  // consultor), mesma fonte do CRM. Troca 07/07: antes vw_locacao_competencia (SE1 caixa).
  var _nfMapLoc = function(d){ return (d||[]).map(function(r){ return { id_tempo:r.id_tempo, dt_faturamento:(r.data_emissao||'').slice(0,10), cliente:r.cliente||'', vlr_liquido:parseFloat(r.valor)||0, profissional:r.consultor_nome||'', consultor_nome:r.consultor_nome||'', vertical:r.vertical, vertical_norm:r.vertical }; }); };
  pending++;
  sbFetch('vw_nfse_consultor_note', 'tipo=eq.LOCACAO&vertical=eq.AGUA&id_tempo=like.' + yearStr + '-*&select=id_tempo,data_emissao,cliente,valor,consultor_nome,vertical').then(function(d) { DATA.locacao = _nfMapLoc(d); done(); }).catch(function(){ done(); });

  // 8b. Locação água ano anterior (comparativo) — NFS-e prefeitura
  pending++;
  sbFetch('vw_nfse_consultor_note', 'tipo=eq.LOCACAO&vertical=eq.AGUA&id_tempo=like.' + String(YEAR - 1) + '-*&select=id_tempo,data_emissao,cliente,valor,consultor_nome,vertical').then(function(d) { DATA.locacaoPrev = _nfMapLoc(d); done(); }).catch(function(){ done(); });

  // 8c. Serviço — NFS-e OFICIAL da prefeitura (itens não-0301). Troca 07/07: antes vw_servico_norm (Protheus, incompleto — subcontava ~R$156k YTD).
  pending++;
  sbFetch('vw_nfse_consultor_note', 'tipo=eq.SERVICO&id_tempo=like.' + yearStr + '-*&select=id_tempo,data_emissao,cliente,valor,consultor_nome,consultor_id,vertical').then(function(d) { DATA.servico = (d||[]).map(function(r){ return { id_tempo:r.id_tempo, dt_faturamento:(r.data_emissao||'').slice(0,10), cliente:r.cliente||'', vlr_liquido:parseFloat(r.valor)||0, consultor_nome:r.consultor_nome||'', consultor_id:r.consultor_id, vertical_norm:r.vertical, vertical:r.vertical }; }); done(); }).catch(function(){ DATA.servico = []; done(); });

  // 8d. Locação TODAS (usada pra compostagem/AGRO no KPI e ranking) — NFS-e prefeitura, item 0301.
  pending++;
  sbFetch('vw_nfse_consultor_note', 'tipo=eq.LOCACAO&id_tempo=like.' + yearStr + '-*&select=id_tempo,data_emissao,cliente,valor,consultor_nome,vertical').then(function(d) { DATA.locacaoNorm = _nfMapLoc(d); done(); }).catch(function(){ DATA.locacaoNorm = []; done(); });

  // 8e/8f. Faturamento consolidado oficial + frete JV (pro total EMPRESA bater com o CRM s/ frete). 07/07.
  pending++;
  sbFetch('vw_faturamento_consolidado_mes', 'mes=like.' + yearStr + '-*&select=mes,total').then(function(d) { DATA.consolidado = d || []; done(); }).catch(function(){ DATA.consolidado = []; done(); });
  pending++;
  sbFetch('vw_frete_jv_competencia', 'mes=like.' + yearStr + '-*&select=mes,frete_jv').then(function(d) { DATA.freteJv = d || []; done(); }).catch(function(){ DATA.freteJv = []; done(); });

  // 9. Leads
  pending++;
  // 12/05: trocado de tabela `leads` (RLS bloqueia anon pós-hardening 07/05) pra `vw_leads_publico`.
  // View remove PII (nome, telefone) — usos a jusante (feed, mapa UF, top novos) fallback pra cidade/uf/consultor.
  sbFetch('vw_leads_publico', 'status=not.in.(Ganho,Perdido,Cancelado,Inativo)&select=id,produto,consultor_nome,consultor_id,etapa,status,temperatura,ai_temperatura,ai_score,data_entrada,ultimo_contato,bot_touched_at,cidade,uf,classificacao,created_at').then(function(d) {
    DATA.leads = d || [];
    done();
  }).catch(function(){ done(); });

  // 9b. Leads TODOS (pra matriz funil consultor x estado: fechou/perdeu/etc precisa de status=Ganho/Perdido tb).
  pending++;
  sbFetch('vw_leads_publico', 'select=id,consultor_nome,status,data_entrada,ultimo_contato,bot_touched_at,temperatura,ai_score').then(function(d) {
    DATA.leadsAll = d || [];
    done();
  }).catch(function(){ DATA.leadsAll = []; done(); });

  // 10. Atividades (30 dias)
  pending++;
  var d30 = new Date(); d30.setDate(d30.getDate() - 30);
  var d30str = d30.toISOString().slice(0, 10);
  sbFetch('atividades', 'data=gte.' + d30str + '&select=id,consultor_nome,tipo,data,hora,status,lead_nome,dados_checkin,notas').then(function(d) {
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

  // 12b. NF de Entrada (compras Protheus SF1/SD1, sync 16/07) — mes corrente, filial TECH.
  pending++;
  var nfeNextMonth = MONTH === 12 ? (YEAR + 1) + '-01-01' : YEAR + '-' + String(MONTH + 1).padStart(2, '0') + '-01';
  pending++;
  sbFetch('nf_produto_depara', 'select=produto_cod,grupo').then(function(d) {
    DATA.nfDepara = d || [];
    done();
  }).catch(function(){ DATA.nfDepara = []; done(); });
  sbFetch('nf_entrada', 'data_entrada=gte.' + YEAR + '-01-01&data_entrada=lt.' + nfeNextMonth + '&filial=like.00TECH*&select=filial,nota,serie,tipo,cfop,fornece_cod,loja,fornecedor_nome,produto_cod,produto_nome,quantidade,unidade,total_item,data_entrada').then(function(d) {
    DATA.nfEntrada = d || [];
    done();
  }).catch(function(){ DATA.nfEntrada = []; done(); });

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
  // Compostagem (AGRO nat 310111) no total — só se vertical null ou AGRO. Add 01/06.
  if (!vertFilter || vertFilter === 'AGRO') {
    (DATA.locacaoNorm || []).forEach(function(r) {
      if ((r.vertical || r.vertical_norm) !== 'AGRO') return;
      var v = safeNum(r.vlr_liquido);
      locAno += v;
      var lm = parseInt((r.id_tempo || '').split('-')[1]) || 0;
      if (lm <= MONTH) locYTD += v;
      if (lm === MONTH) locMonth += v;
    });
  }
  realMonth += locMonth;
  realYTD += locYTD;
  realAno += locAno;

  // Serviço/assistência técnica (vw_servico_norm, regime caixa por baixa) entra na régua
  // da vertical via vertical_norm — pedido Thiago 06/07: vertical = NF + locação + serviço,
  // mesma composição do consolidado do CRM.
  var servMonth = 0, servYTD = 0, servAno = 0;
  (DATA.servico || []).forEach(function(r) {
    if (vertFilter && normalizeVertical(r.vertical_norm || r.vertical || '') !== vertFilter) return;
    var v = safeNum(r.vlr_liquido);
    servAno += v;
    var sm = parseInt((r.id_tempo || '').split('-')[1]) || 0;
    if (sm <= MONTH) servYTD += v;
    if (sm === MONTH) servMonth += v;
  });
  realMonth += servMonth;
  realYTD += servYTD;
  realAno += servAno;

  // EMPRESA (sem filtro de vertical): usa o faturamento consolidado OFICIAL menos o frete
  // do JV (transportadora), EXATAMENTE como o CRM (régua "s/ frete"). Só assim TV = CRM.
  // Vertical filtrada mantém o cálculo por partes acima. 07/07.
  if (!vertFilter && DATA.consolidado && DATA.consolidado.length) {
    var _fjv = {};
    (DATA.freteJv || []).forEach(function(f) { _fjv[f.mes] = safeNum(f.frete_jv); });
    var _cons = {};
    DATA.consolidado.forEach(function(c) { _cons[c.mes] = safeNum(c.total) - (_fjv[c.mes] || 0); });
    realMonth = _cons[MONTH_STR] || 0;
    realYTD = 0; for (var _i = 1; _i <= MONTH; _i++) { realYTD += _cons[YEAR + '-' + String(_i).padStart(2, '0')] || 0; }
    realAno = 0; Object.keys(_cons).forEach(function(k) { if (k.indexOf(YEAR + '-') === 0) realAno += _cons[k]; });
  }

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
  // 12/05 fix: somar SALDO (vlr_total - vlr_faturado), não vlr_total puro. Pedido R$ 100K c/ R$ 80K já faturado tem só R$ 20K em carteira.
  var carteiraTotal = cart.reduce(function(s, c) { return s + safeNum(c.saldo_carteira != null ? c.saldo_carteira : (c.vlr_carteira || c.valor || c.vlr_total)); }, 0);
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
    servMonth: servMonth, servYTD: servYTD, servAno: servAno,
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
    function() { renderCarteiraCliente(kpis, cfg); },
    function() { renderClientes8020(cfg); },
    function() { renderAgendaCheckin(cfg); },
    function() { renderFreteMonitor(cfg); },
    function() { renderFarolCompost(cfg); },
    function() { renderNfEntrada(cfg); },
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

  // 12/05 polimento: 5 → 4 boxes. YTD + ANO fundidos num só "2026" com 2 % (proporcional + anual).
  // Eliminou redundância de realizado igual com 2 metas diferentes.
  var monthName = MONTH_NAMES[MONTH - 1];
  var anoGap = (kpis.metaAno || 0) - (kpis.realYTD || 0);
  var anoGapColor = anoGap <= 0 ? 'var(--green)' : 'var(--amber)';
  var cards = [
    { type: 'mes',  label: 'FATURAMENTO MÊS (' + monthName + ')', value: kpis.realMonth, meta: kpis.metaMonth, pct: kpis.atingMonth, proj: kpis.projecao, rate: kpis.rate, bizLeft: kpis.bizLeft },
    { type: 'ano',  label: YEAR + ' · acumulado vs ritmo', value: kpis.realYTD, ytdPct: kpis.atingYTD, anoPct: kpis.atingAno, metaYTD: kpis.metaYTD, metaAno: kpis.metaAno, gap: anoGap, gapColor: anoGapColor },
    { type: 'cart', label: 'CARTEIRA PEDIDOS', value: kpis.carteiraTotal, count: kpis.carteiraPedidos, metaPct: kpis.carteiraMetaPct },
    { type: 'pipe', label: 'PIPELINE LEADS', leads: kpis.leadsAtivos, quentes: kpis.leadsQuentes, novos: kpis.leadsNovos7d },
  ];

  var html = '';
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    var cls = c.type === 'mes' ? 'kpi-fat' : c.type === 'ano' ? 'kpi-fat' : c.type === 'cart' ? 'kpi-cart' : 'kpi-pipe';
    html += '<div class="kpi-box ' + cls + '">';
    html += '<div class="kpi-label">' + c.label + '</div>';

    if (c.type === 'mes') {
      html += '<div class="kpi-value">' + fmtBRL(c.value) + '</div>';
      html += '<div class="kpi-sub">Meta <span class="meta-val">' + fmtBRL(c.meta) + '</span></div>';
      html += '<div class="kpi-pct" style="color:' + pctColor(c.pct) + '">' + fmtPct(c.pct) + '</div>';
      html += '<div class="kpi-progress"><div class="kpi-progress-fill" style="width:' + Math.min(c.pct, 100) + '%;background:' + pctColor(c.pct) + '"></div></div>';
      var mProjColor = c.proj >= c.meta ? 'var(--green)' : 'var(--amber)';
      html += '<div class="kpi-proj">Projeção <span class="proj-val" style="color:' + mProjColor + '">' + fmtBRL(c.proj) + '</span> · ' + fmtBRL(c.rate) + '/dia · ' + c.bizLeft + ' dias úteis restam · + carteira <span class="proj-val">' + fmtBRL(kpis.carteiraTotal || 0) + '</span> a faturar</div>';
    } else if (c.type === 'ano') {
      html += '<div class="kpi-value">' + fmtBRL(c.value) + '</div>';
      html += '<div class="kpi-sub">faltam <span class="meta-val" style="color:' + c.gapColor + '">' + fmtBRL(c.gap) + '</span> pra meta ano</div>';
      // Bloco 2-percentuais lado a lado: proporcional (esperado até hoje) + anual (do ano todo)
      html += '<div style="display:flex;gap:10px;margin-top:6px;font-family:var(--mono)">';
      html += '<div style="flex:1"><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px">vs esperado (YTD)</div><div style="font-size:20px;font-weight:800;color:' + pctColor(c.ytdPct) + ';letter-spacing:-.02em">' + fmtPct(c.ytdPct) + '</div><div class="kpi-progress" style="margin-top:3px"><div class="kpi-progress-fill" style="width:' + Math.min(c.ytdPct, 100) + '%;background:' + pctColor(c.ytdPct) + '"></div></div></div>';
      html += '<div style="flex:1"><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px">do ano todo</div><div style="font-size:20px;font-weight:800;color:var(--text);letter-spacing:-.02em">' + fmtPct(c.anoPct) + '</div><div class="kpi-progress" style="margin-top:3px"><div class="kpi-progress-fill" style="width:' + Math.min(c.anoPct, 100) + '%;background:var(--accent)"></div></div></div>';
      html += '</div>';
    } else if (c.type === 'cart') {
      html += '<div class="kpi-value">' + fmtBRL(c.value) + '</div>';
      html += '<div class="kpi-sub">' + c.count + ' pedidos abertos</div>';
      var cpct = c.metaPct;
      var cStatus = cpct >= 15 ? 'Bom' : cpct >= 8 ? 'Moderado' : 'Crítico';
      var cColor = cpct >= 15 ? 'var(--green)' : cpct >= 8 ? 'var(--amber)' : 'var(--red)';
      html += '<div class="kpi-pct" style="color:' + cColor + '">' + fmtPct(cpct) + ' da meta — ' + cStatus + '</div>';
    } else if (c.type === 'pipe') {
      html += '<div class="kpi-value">' + c.leads + ' <span style="font-size:12px;color:var(--text-dim)">leads</span></div>';
      html += '<div class="kpi-sub"><span style="color:var(--red)">' + c.quentes + ' quentes</span> · ' + c.novos + ' novos (7d)</div>';
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
  var serv = DATA.servico || [];
  var incluiLoc = !vertFilter || vertFilter === 'AGUA';

  // Group by month
  var months = {};
  for (var i = 1; i <= 12; i++) {
    var key = YEAR + '-' + String(i).padStart(2, '0');
    months[key] = { mov: 0, loc: 0, serv: 0, nfs: 0 };
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

  serv.forEach(function(r) {
    var t = r.id_tempo || '';
    if (months[t]) months[t].serv += safeNum(r.vlr_liquido);
  });

  var GRID = '32px 1fr 1fr 1fr 1fr';
  var mNames = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  var html = '<div style="font-family:var(--mono);font-size:8px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px;padding-bottom:4px;border-bottom:1px solid var(--border);margin-bottom:4px;display:flex;align-items:center;gap:6px"><span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--accent)"></span> FATURAMENTO POR MÊS</div>';
  html += '<div style="display:grid;grid-template-columns:' + GRID + ';gap:2px 6px;font-family:var(--mono);font-size:8px;padding:2px 0">';
  html += '<span style="color:var(--text-dim);font-weight:700">MÊS</span>';
  html += '<span style="color:var(--text-dim);font-weight:700;text-align:right">NFs</span>';
  if (incluiLoc) {
    html += '<span style="color:var(--text-dim);font-weight:700;text-align:right">LOCAÇÃO</span>';
  } else {
    html += '<span style="color:var(--text-dim);font-weight:700;text-align:right">FRETE</span>';
  }
  html += '<span style="color:#a855f7;font-weight:700;text-align:right">SERVIÇO</span>';
  html += '<span style="color:var(--text-dim);font-weight:700;text-align:right">TOTAL</span>';
  html += '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:1px;overflow-y:auto;flex:1;min-height:0">';

  var acum = 0;
  var keys = Object.keys(months).sort();
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var d = months[key];
    var col2 = incluiLoc ? d.loc : mov.filter(function(m) { return m.id_tempo === key; }).reduce(function(s, m) { return s + m._frete; }, 0);
    var total = d.mov + (incluiLoc ? d.loc : 0) + d.serv;
    acum += total;
    var mIdx = parseInt(key.slice(5, 7)) - 1;
    var isCurrent = (mIdx + 1) === MONTH;
    var isFuture = (mIdx + 1) > MONTH;
    var rowColor = isCurrent ? 'color:var(--accent);font-weight:700' : isFuture ? 'color:var(--text-dim);opacity:.4' : 'color:var(--text-muted)';

    html += '<div style="display:grid;grid-template-columns:' + GRID + ';gap:2px 6px;font-family:var(--mono);font-size:9px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.03);' + rowColor + '">';
    html += '<span>' + mNames[mIdx] + '</span>';
    html += '<span style="text-align:right">' + (d.mov > 0 ? fmtBRL(d.mov) : '—') + '</span>';
    html += '<span style="text-align:right">' + (col2 > 0 ? fmtBRL(col2) : '—') + '</span>';
    html += '<span style="text-align:right;color:#a855f7">' + (d.serv > 0 ? fmtBRL(d.serv) : '—') + '</span>';
    html += '<span style="text-align:right;font-weight:700">' + (total > 0 ? fmtBRL(total) : '—') + '</span>';
    html += '</div>';
  }
  html += '</div>';

  // Totals
  var totalMov = mov.reduce(function(s, m) { return s + m._valor; }, 0);
  var totalLoc = incluiLoc ? loc.reduce(function(s, r) { return s + safeNum(r.vlr_liquido); }, 0) : 0;
  var totalServ = serv.reduce(function(s, r) { return s + safeNum(r.vlr_liquido); }, 0);
  html += '<div style="display:grid;grid-template-columns:' + GRID + ';gap:2px 6px;font-family:var(--mono);font-size:9px;font-weight:700;padding:4px 0;border-top:2px solid var(--accent);margin-top:4px">';
  html += '<span style="color:var(--text-dim)">ANO</span>';
  html += '<span style="text-align:right;color:var(--text)">' + fmtBRL(totalMov) + '</span>';
  html += '<span style="text-align:right;color:var(--text)">' + fmtBRL(totalLoc) + '</span>';
  html += '<span style="text-align:right;color:#a855f7">' + fmtBRL(totalServ) + '</span>';
  html += '<span style="text-align:right;color:var(--accent)">' + fmtBRL(totalMov + totalLoc + totalServ) + '</span>';
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
// 12/05: usa DATA.movNFs (agregado por NF, com nota+num_pedido+produto detalhado) ao invés de DATA.movimento (granular por item).
// Mantém locação + serviço como antes.
function renderFaturamentoDia(cfg) {
  var el = document.getElementById('fat-dia');
  if (!el) return;

  // Helper consolida produtos múltiplos numa NF: "TOP COMPOST +2"
  function fmtProdutos_(arr) {
    if (!arr || !arr.length) return '—';
    var primeiro = arr[0].nome || '';
    if (arr.length === 1) return primeiro;
    return primeiro + ' +' + (arr.length - 1);
  }

  var nfs = DATA.movNFs || [];
  if (cfg.vertical) {
    nfs = nfs.filter(function(m) { return normalizeVertical(m.vertical || '') === cfg.vertical; });
  }

  var mesAtual = TODAY_STR.slice(0, 7);
  var mesMov = nfs.filter(function(m) { return (m.data_faturamento || '').slice(0, 7) === mesAtual; })
    .map(function(m) {
      // Normalizar campos pra reaproveitar lógica antiga
      m._valor = m.valor_total;
      m._frete = m.frete_total;
      m._qtd = m.qtd_total;
      m._produtoLbl = fmtProdutos_(m.produtos);
      m._cidadeLbl = (m.cidade ? (m.cidade.charAt(0).toUpperCase() + m.cidade.slice(1).toLowerCase()) : '') + (m.uf ? '/' + m.uf : '');
      return m;
    });

  if (DATA.locacao && (!cfg.vertical || cfg.vertical === 'AGUA')) {
    DATA.locacao.forEach(function(r) {
      var dt = r.dt_faturamento || '';
      if (dt.slice(0, 7) === mesAtual) {
        mesMov.push({
          data_faturamento: dt,
          nome_cliente: r.cliente || r.nome_produto || 'LOCAÇÃO',
          representante: r.consultor_nome || '',
          nota: '', num_pedido: '',
          _produtoLbl: r.nome_produto || 'LOCAÇÃO', _cidadeLbl: '', _qtd: 0,
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
      var dt = r.dt_faturamento || r.baixa || '';
      if (dt.slice(0, 7) === mesAtual) {
        mesMov.push({
          data_faturamento: dt,
          nome_cliente: r.cliente || r.nome_produto || 'SERVIÇO',
          representante: r.consultor_nome || '',
          nota: '', num_pedido: '',
          _produtoLbl: r.natureza || 'SERVIÇO', _cidadeLbl: '', _qtd: 0,
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
  html += '<span class="fat-col-cons-h">CONSULTOR</span>';
  html += '<span class="fat-col-nf-h">NF</span>';
  html += '<span class="fat-col-ped-h">PEDIDO</span>';
  html += '<span class="fat-col-prod-h">PRODUTO</span>';
  html += '<span class="fat-col-cid-h">CIDADE</span>';
  html += '<span class="fat-col-vol-h" style="text-align:right">VOL</span>';
  html += sortableHeader('fat-dia', 'valor', 'VALOR', 'text-align:right');
  html += '<span style="text-align:right">ACUM</span>';
  html += '</div>';
  html += '<div class="fat-dia-list">';

  for (var di = 0; di < dayOrder.length; di++) {
    var dayStr = dayOrder[di];
    var items = dayGroups[dayStr];
    var dayTotal = items.reduce(function(s, m) { return s + (m._valor || 0); }, 0);
    var dayCount = items.length;
    var isToday = dayStr === TODAY_STR;
    var dtFmt = dayStr.slice(8, 10) + '/' + dayStr.slice(5, 7);
    var dayAcum = acumMap[dayStr] || 0;

    // Linha total do dia (agrupadora — antes das NFs do dia)
    html += '<div class="fat-dia-row fat-dia-day-total"' + (isToday ? ' style="background:rgba(0,212,170,.08)"' : '') + '>';
    html += '<span style="color:' + (isToday ? 'var(--green)' : 'var(--text)') + ';font-weight:800">' + dtFmt + (isToday ? ' · HOJE' : '') + '</span>';
    html += '<span style="color:var(--text-dim);font-size:7px">' + dayCount + ' NFs</span>';
    html += '<span style="color:var(--text-dim);grid-column:span 6"></span>';
    html += '<span style="text-align:right;color:var(--text-dim);font-size:7px">TOTAL DIA</span>';
    html += '<span style="text-align:right;font-weight:800;color:' + (isToday ? 'var(--green)' : 'var(--accent)') + '">' + fmtBRL(dayTotal) + '</span>';
    html += '<span style="text-align:right;color:var(--text-dim);font-size:9px">' + fmtBRL(dayAcum) + '</span>';
    html += '</div>';

    // NFs individuais do dia
    for (var i = 0; i < items.length; i++) {
      var m = items[i];
      var newCls = (isToday && i === 0 && isNew) ? ' new-entry' : '';
      var tipo = m._isLocacao ? 'LOCAÇÃO' : (m._isServico ? 'SERVIÇO' : (m.operacao_gerencial || m.tipo_operacao || 'VENDA'));
      var tipoColor = tipo === 'DEVOLUÇÃO' ? 'var(--red)' : tipo === 'LOCAÇÃO' ? 'var(--blue)' : tipo === 'SERVIÇO' ? '#a855f7' : 'var(--text-dim)';
      var vol = m._qtd || 0;
      var nf = m.nota || '';
      var ped = m.num_pedido || '';
      var prod = m._produtoLbl || '';
      var cid = m._cidadeLbl || '';
      html += '<div class="fat-dia-row' + newCls + '">';
      html += '<span style="color:' + (isToday ? 'var(--green)' : 'var(--text-dim)') + '">' + dtFmt + '</span>';
      html += '<span style="color:' + tipoColor + ';font-size:7px;font-weight:700;white-space:nowrap">' + escHtml(tipo.slice(0, 8)) + '</span>';
      html += '<span title="' + escHtml(m.nome_cliente || '') + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml((m.nome_cliente || '').slice(0, 30)) + '</span>';
      html += '<span class="fat-col-cons" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-dim)">' + escHtml((m.representante || '').split(' ').slice(0, 2).join(' ')) + '</span>';
      html += '<span class="fat-col-nf" style="color:var(--text-dim);font-size:8px">' + escHtml(nf ? String(nf).replace(/^0+/, '') : '—') + '</span>';
      html += '<span class="fat-col-ped" style="color:var(--text-dim);font-size:8px">' + escHtml(ped || '—') + '</span>';
      html += '<span class="fat-col-prod" title="' + escHtml(prod) + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">' + escHtml(prod) + '</span>';
      html += '<span class="fat-col-cid" title="' + escHtml(cid) + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-dim);font-size:8px">' + escHtml(cid || '—') + '</span>';
      html += '<span class="fat-col-vol" style="text-align:right;color:var(--text-dim);font-variant-numeric:tabular-nums">' + (vol > 0 ? (vol % 1 === 0 ? vol : vol.toFixed(1)) : '—') + '</span>';
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
  // Compostagem (AGRO nat 310111) no realizado do consultor — só AGRO ou sem filtro. Add 01/06.
  if (!cfg.vertical || cfg.vertical === 'AGRO') (DATA.locacaoNorm || []).forEach(function(r) {
    if ((r.vertical || r.vertical_norm) !== 'AGRO') return;
    var prof = r.profissional || r.consultor_nome || '';
    var key = Object.keys(map).find(function(k) { return matchPlanName(k, prof) || matchPlanName(prof, k); });
    if (!key) return;
    var v = safeNum(r.vlr_liquido);
    var m = parseInt((r.id_tempo || '').split('-')[1]) || 0;
    map[key].realAno += v;
    if (m === MONTH) map[key].realMes += v;
    if (m === MONTH - 1 || (MONTH === 1 && m === 12)) map[key].realPrevMes += v;
  });
  // Serviço/assistência técnica no realizado do consultor (vw_servico_norm, por baixa).
  // Mesma régua do total: vertical = NF + locação + serviço. Add 06/07.
  (DATA.servico || []).forEach(function(r) {
    if (cfg.vertical && normalizeVertical(r.vertical_norm || r.vertical || '') !== cfg.vertical) return;
    var prof = r.consultor_nome || '';
    var key = Object.keys(map).find(function(k) { return matchPlanName(k, prof) || matchPlanName(prof, k); });
    if (!key) return;
    var v = safeNum(r.vlr_liquido);
    var m = parseInt((r.id_tempo || '').split('-')[1]) || 0;
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

/* ═══ BLOCK 5.5: LOCAÇÃO RECENTE + SERVIÇO RECENTE — regime caixa ═══
   12/05: 2 blocos novos no exec.html replicando exec2. Locação = vw_locacao_completa (campo profissional, sem natureza).
   Serviço = vw_servico_norm (com baixa, natureza). Tabela com linha agrupadora por dia (cor teal/roxa). */
// Feed nota-a-nota (estilo Histórico Live): data · cliente · categoria · consultor · valor. 07/07.
function _catLabel(kind, v) {
  v = (v || '').toUpperCase();
  if (v === 'AGUA') return { t: '💧 Água', c: '#5EEAD4' };
  if (v === 'AGRO') return kind === 'loc' ? { t: '🌱 Compost.', c: '#A3E635' } : { t: '🌱 Agro', c: '#A3E635' };
  if (v === 'CORPORATIVO') return { t: 'Corp.', c: '#94A3B8' };
  return { t: '—', c: '#94A3B8' };
}
function _renderNfseFeed(elId, src, accent, kind) {
  var el = document.getElementById(elId);
  if (!el) return;
  var rows = (src || []).slice().filter(function(r){ return r.dt_faturamento; }).sort(function(a, b){ return (b.dt_faturamento || '').localeCompare(a.dt_faturamento || ''); });
  if (!rows.length) { el.innerHTML = '<div style="text-align:center;padding:16px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">sem nota no período</div>'; return; }
  var totalAll = 0, mesTot = 0;
  rows.forEach(function(r){ var v = safeNum(r.vlr_liquido); totalAll += v; if ((r.dt_faturamento || '').slice(0, 7) === MONTH_STR) mesTot += v; });
  var shown = rows.slice(0, 60);
  var mesLbl = MONTH_NAMES[MONTH - 1] + '/' + String(YEAR).slice(2);
  var html = '<div class="srv-table-wrap"><table class="srv-table">';
  // Resumo no topo: MÊS + YTD
  html += '<thead><tr class="srv-summary" style="color:'+accent+'"><th colspan="2" style="text-align:left">📅 '+mesLbl+': '+fmtBRLFull(mesTot)+'</th><th colspan="2" style="text-align:right">YTD '+fmtBRLFull(totalAll)+'</th></tr>';
  html += '<tr><th>DATA</th><th>CLIENTE</th><th>CATEG.</th><th style="text-align:right">VALOR</th></tr></thead><tbody>';
  var curDay = null, dayRows = [], dayVal = 0, dayCount = 0;
  function flush(){ if (!curDay) return; var dt = curDay.slice(8,10)+'/'+curDay.slice(5,7); html += '<tr class="srv-day-total" style="color:'+accent+'"><td colspan="3">▸ '+dt+' · '+dayCount+' nota'+(dayCount!==1?'s':'')+'</td><td style="text-align:right">'+fmtBRL(dayVal)+'</td></tr>' + dayRows.join(''); }
  shown.forEach(function(r){
    var d = r.dt_faturamento;
    if (d !== curDay) { flush(); curDay = d; dayRows = []; dayVal = 0; dayCount = 0; }
    var val = safeNum(r.vlr_liquido); dayVal += val; dayCount++;
    var cli = (r.cliente || '').slice(0, 26);
    var cons = (r.consultor_nome || r.profissional || '').split(' ').slice(0, 2).join(' ');
    var cat = _catLabel(kind, r.vertical || r.vertical_norm);
    dayRows.push('<tr><td>'+(d.slice(8,10)+'/'+d.slice(5,7))+'</td>'+
      '<td title="'+escHtml((r.cliente||'')+' · '+cons)+'">'+escHtml(cli)+'</td>'+
      '<td style="color:'+cat.c+';font-size:9px;white-space:nowrap">'+cat.t+'</td>'+
      '<td style="text-align:right;font-weight:700">'+fmtBRL(val)+'</td></tr>');
  });
  flush();
  html += '<tr class="srv-grand-total"><td colspan="3">'+rows.length+' notas'+(rows.length>shown.length?' (mostrando '+shown.length+')':'')+'</td><td style="text-align:right">'+fmtBRLFull(totalAll)+'</td></tr>';
  html += '</tbody></table></div>';
  el.innerHTML = html;
}
function renderLocacaoBloco(cfg) { _renderNfseFeed('locacao-recente', DATA.locacaoNorm, '#5EEAD4', 'loc'); }
function renderServicoBloco(cfg) { _renderNfseFeed('servico-recente', DATA.servico, '#8B5CF6', 'serv'); }

// 12/05: injeta DOM dos 2 cards via JS (HTML do executivo.html é root-only).
// 03/07: movidos do último mosaic pro de FATURAMENTO — são receita (locação NF + serviço NFS-e) e preenchem o vão da 2a linha.
function ensureLocServicoCards() {
  if (document.getElementById('locacao-recente')) return;
  var mosaics = document.querySelectorAll('.mosaic');
  if (!mosaics.length) return;
  var lastMosaic = mosaics[0];
  function makeCard(id, title, accentColor) {
    var card = document.createElement('div'); card.className = 'card loc-srv-card';
    card.style.cssText = 'flex:1 1 0;min-width:0;max-height:340px;min-height:160px;overflow:hidden;display:flex;flex-direction:column';
    card.innerHTML = '<div class="card-header" style="color:'+accentColor+'">'+title+'</div>'+
      '<div class="card-body" style="overflow-y:auto;overflow-x:hidden;flex:1;min-height:0"><div id="'+id+'"><div style="text-align:center;padding:16px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">carregando…</div></div></div>';
    return card;
  }
  var wrap = document.createElement('div');
  wrap.className = 'loc-srv-wrap';
  wrap.style.cssText = 'grid-column:1/-1;display:flex!important;flex-direction:row!important;flex-wrap:nowrap;gap:6px;width:100%';
  wrap.appendChild(makeCard('locacao-recente', 'LOCAÇÃO — NFS-e (ÁGUA + COMPOSTAGEM)', '#5EEAD4'));
  wrap.appendChild(makeCard('servico-recente', 'SERVIÇO — NFS-e (CONSULTORIA + ASSIST.)', '#8B5CF6'));
  lastMosaic.appendChild(wrap);
}

/* ═══ BLOCK 6: PEDIDOS — CARTEIRA ABERTA ═══ */
// 12/05: helpers pra extrair produto/volume/local pra mostrar na lista.
function _pedidoProduto(p) {
  // produtos_resumo já vem agregado da view (ex: "ULEXITA +3"). Fallback pra primeiro_produto / produto_nome.
  return (p.produtos_resumo || p.primeiro_produto || p.produto_nome || '').trim();
}
function _pedidoVolume(p) {
  // volume_total agregado pela view. Quando 0/null, somar qtd dos itens (unidade-agnóstico).
  var v = parseFloat(p.volume_total) || 0;
  if (v > 0) return v;
  var itens = Array.isArray(p.itens) ? p.itens : (Array.isArray(p.produtos) ? p.produtos : []);
  var soma = 0;
  for (var i = 0; i < itens.length; i++) {
    var q = parseFloat(itens[i].qtd || itens[i].quantidade || 0) || 0;
    soma += q;
  }
  return soma;
}
function _pedidoLocal(p) {
  var cid = (p.cliente_cidade || '').trim();
  var uf = (p.uf || '').trim();
  if (cid && uf) return titleCaseLite_(cid) + '/' + uf;
  if (uf) return uf;
  if (cid) return titleCaseLite_(cid);
  return '—';
}
function titleCaseLite_(s) {
  if (!s) return '';
  return s.toLowerCase().split(/\s+/).map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' ');
}

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
    produto: function(c) { return _pedidoProduto(c).toUpperCase(); },
    volume: function(c) { return _pedidoVolume(c); },
    local: function(c) { return _pedidoLocal(c); },
    valor: function(c) { return safeNum(c.saldo_carteira != null ? c.saldo_carteira : (c.vlr_carteira || c.vlr_total)); }
  };
  cart = cart.filter(function(c) { var v = safeNum(c.saldo_carteira != null ? c.saldo_carteira : (c.vlr_carteira || c.vlr_total)); return v > 0; });
  var sorted;
  if (_sortState['pedidos']) {
    sorted = applySortToList('pedidos', cart, pedSortCols);
  } else {
    sorted = cart.slice().sort(function(a, b) {
      return (b.dt_pedido || b.created_at || '').localeCompare(a.dt_pedido || a.created_at || '');
    });
  }

  var totalCarteira = sorted.reduce(function(s, c) { return s + safeNum(c.saldo_carteira != null ? c.saldo_carteira : (c.vlr_carteira || c.vlr_total)); }, 0);

  var html = '<div class="pedido-header">';
  html += sortableHeader('pedidos', 'data', 'DATA', '');
  html += sortableHeader('pedidos', 'cliente', 'CLIENTE', '');
  html += sortableHeader('pedidos', 'consultor', 'CONSULTOR', '');
  html += '<span class="pedido-col-vol-h" style="text-align:right">VOL</span>';
  html += '<span class="pedido-col-prod-h">PRODUTO</span>';
  html += '<span class="pedido-col-loc-h">LOCAL</span>';
  html += sortableHeader('pedidos', 'valor', 'SALDO', 'text-align:right');
  html += '</div>';
  html += '<div class="pedidos-list">';

  var shown = Math.min(sorted.length, 30);
  for (var i = 0; i < shown; i++) {
    var p = sorted[i];
    var data = (p.dt_pedido || p.created_at || '').slice(0, 10);
    var isToday = data === TODAY_STR;
    var prod = _pedidoProduto(p);
    var vol = _pedidoVolume(p);
    var loc = _pedidoLocal(p);

    html += '<div class="pedido-row' + (isToday ? ' today' : '') + '">';
    html += '<span>' + (data ? data.slice(8, 10) + '/' + data.slice(5, 7) : '—') + '</span>';
    html += '<span title="' + escHtml(p.nome_cliente || '') + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml((p.nome_cliente || '').slice(0, 40)) + '</span>';
    html += '<span style="color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml((p.representante || p.consultor || '').split(' ').slice(0, 2).join(' ')) + '</span>';
    html += '<span class="pedido-col-vol">' + (vol > 0 ? (vol % 1 === 0 ? vol : vol.toFixed(1)) : '—') + '</span>';
    html += '<span class="pedido-col-prod" title="' + escHtml(prod) + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(prod || '—') + '</span>';
    html += '<span class="pedido-col-loc" title="' + escHtml(loc) + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(loc) + '</span>';
    html += '<span style="text-align:right;font-weight:700">' + fmtBRL(safeNum(p.saldo_carteira != null ? p.saldo_carteira : (p.vlr_carteira || p.vlr_total))) + '</span>';
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
    byConsultor[nome].valor += safeNum(c.saldo_carteira != null ? c.saldo_carteira : (c.vlr_carteira || c.valor || c.vlr_total));
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

/* ═══ BLOCK 8b: CARTEIRA POR CLIENTE (05/08) ═══
   Agrega o saldo em carteira por CLIENTE (o bloco acima agrega por consultor, e
   "CARTEIRA DE PEDIDOS — ABERTA" lista pedido a pedido). Clicar no nome expande
   in-place os pedidos daquele cliente.

   Valor = saldo_carteira (vlr_total - vlr_faturado), mesmo campo do card por
   consultor e do ticker. NÃO usar vlr_carteira/vlr_total puro aqui: infla o
   número com o que já virou NF e o bloco deixa de fechar com o resto da tela. */
var _cartCliExpanded = {};
// _cartCliKeys é reescrito a cada render: o onclick passa o ÍNDICE da linha, não
// o nome. Nome de cliente interpolado em atributo HTML é armadilha — escHtml()
// não escapa aspas (tv-base.js:144), então FAZENDA "BOA VISTA" quebraria o
// onclick. Índice não precisa de escaping nenhum.
var _cartCliKeys = [];
function toggleCartCliente(idx) {
  var nome = _cartCliKeys[idx];
  if (nome == null) return;
  _cartCliExpanded[nome] = !_cartCliExpanded[nome];
  _rerenderCockpit();
}
// renderAll (cockpits por vertical) x renderAllExec (executivo) — o toggle
// precisa reentrar pelo caminho certo, senão o executivo re-renderiza incompleto.
function _rerenderCockpit() {
  var cfg = window._lastCfg || {};
  if (cfg.isExec && typeof renderAllExec === 'function') renderAllExec(cfg);
  else if (typeof renderAll === 'function') renderAll(cfg);
}

function _cartSaldo(c) {
  return safeNum(c.saldo_carteira != null ? c.saldo_carteira : (c.vlr_carteira || c.vlr_total));
}

function renderCarteiraCliente(kpis, cfg) {
  var el = document.getElementById('carteira-cliente');
  if (!el) return;

  var cart = kpis.cart || [];
  var byCliente = {};
  cart.forEach(function(c) {
    var nome = (c.nome_cliente || c.cliente || 'SEM CLIENTE').trim();
    var val = _cartSaldo(c);
    if (val <= 0) return;
    if (!byCliente[nome]) byCliente[nome] = { pedidos: [], valor: 0, consultores: {} };
    byCliente[nome].pedidos.push(c);
    byCliente[nome].valor += val;
    // Chave em UPPER: o mesmo consultor vem com caixas diferentes na origem
    // ("Adriano Camargo" e "ADRIANO CAMARGO" sao a mesma pessoa). Sem isso o
    // cliente aparecia como "2 consult." sendo um so. Guarda o 1o rotulo visto.
    var rep = (c.representante || c.consultor || '').trim();
    if (rep && !byCliente[nome].consultores[rep.toUpperCase()]) {
      byCliente[nome].consultores[rep.toUpperCase()] = rep;
    }
  });

  var total = 0;
  var list = Object.keys(byCliente).map(function(k) {
    total += byCliente[k].valor;
    var reps = Object.keys(byCliente[k].consultores).map(function(u) { return byCliente[k].consultores[u]; });
    return {
      nome: k,
      pedidos: byCliente[k].pedidos.length,
      valor: byCliente[k].valor,
      consultor: reps.length === 1 ? reps[0] : (reps.length > 1 ? reps.length + ' consult.' : '—'),
      itens: byCliente[k].pedidos
    };
  });

  var cartCliSortCols = {
    nome: function(r) { return r.nome.toUpperCase(); },
    consultor: function(r) { return (r.consultor || '').toUpperCase(); },
    pedidos: function(r) { return r.pedidos; },
    valor: function(r) { return r.valor; }
  };
  if (!list.length) { el.innerHTML = '<div style="text-align:center;padding:20px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem carteira aberta</div>'; return; }

  // O recorte TOP 25 e SEMPRE por saldo — o titulo do card promete os 25 maiores.
  // Ordenar antes do slice trocaria QUAIS clientes aparecem (ordenar por nome
  // mostraria os 25 primeiros do alfabeto). A ordenacao escolhida so reordena
  // os 25 ja selecionados.
  var TOP = 25;
  list.sort(function(a, b) { return b.valor - a.valor; });
  var shown = list.slice(0, TOP);
  var restoQtd = list.length - shown.length;
  var restoVal = list.slice(TOP).reduce(function(s, r) { return s + r.valor; }, 0);
  if (_sortState['cart-cli']) shown = applySortToList('cart-cli', shown, cartCliSortCols);

  var html = '<table class="cart-table"><thead><tr>';
  html += '<th>' + sortableHeader('cart-cli', 'nome', 'Cliente', '') + '</th>';
  html += '<th>' + sortableHeader('cart-cli', 'consultor', 'Consultor', '') + '</th>';
  html += '<th style="text-align:center">' + sortableHeader('cart-cli', 'pedidos', 'Ped', 'text-align:center') + '</th>';
  html += '<th style="text-align:right">' + sortableHeader('cart-cli', 'valor', 'Saldo', 'text-align:right') + '</th>';
  html += '<th style="text-align:right">%</th>';
  html += '</tr></thead><tbody>';

  // Hoje as 00:00: entrega prevista PARA hoje nao e atraso.
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  _cartCliKeys = shown.map(function(r) { return r.nome; });
  shown.forEach(function(r, idx) {
    var pct = total > 0 ? r.valor / total * 100 : 0;
    var aberto = !!_cartCliExpanded[r.nome];
    html += '<tr style="cursor:pointer" onclick="toggleCartCliente(' + idx + ')">';
    html += '<td><span class="cart-name">' + (aberto ? '▾ ' : '▸ ') + escHtml(r.nome) + '</span></td>';
    html += '<td style="color:var(--text-muted)">' + escHtml(r.consultor.split(' ').slice(0, 2).join(' ')) + '</td>';
    html += '<td class="cart-count">' + r.pedidos + '</td>';
    html += '<td class="cart-val">' + fmtBRL(r.valor) + '</td>';
    html += '<td style="text-align:right;color:var(--text-muted)">' + fmtPct(pct) + '</td>';
    html += '</tr>';

    if (aberto) {
      var itens = r.itens.slice().sort(function(a, b) { return _cartSaldo(b) - _cartSaldo(a); });
      itens.forEach(function(c) {
        // Entrega vencida em vermelho — mesmo critério da carteira aberta.
        var atrasado = c.dt_previsao_entrega && new Date(c.dt_previsao_entrega + 'T00:00:00') < hoje;
        var dp = (c.dt_previsao_entrega || '').split('-');
        var dtTxt = dp.length === 3 ? dp[2] + '/' + dp[1] : '—';
        html += '<tr style="background:rgba(255,255,255,.03);font-size:10px' + (atrasado ? ';color:var(--red)' : '') + '">';
        html += '<td style="padding-left:14px;color:var(--text-muted)">' + escHtml(_pedidoProduto(c) || '(s/ produto)') + '</td>';
        html += '<td style="color:var(--text-muted)">' + escHtml(_pedidoLocal(c)) + '</td>';
        html += '<td class="cart-count">' + dtTxt + '</td>';
        html += '<td class="cart-val"' + (atrasado ? ' style="color:var(--red)"' : '') + '>' + fmtBRL(_cartSaldo(c)) + '</td>';
        html += '<td></td>';
        html += '</tr>';
      });
    }
  });

  if (restoQtd > 0) {
    html += '<tr style="color:var(--text-muted)"><td>+ ' + restoQtd + ' clientes</td><td></td><td></td>';
    html += '<td class="cart-val">' + fmtBRL(restoVal) + '</td><td></td></tr>';
  }

  html += '<tr style="border-top:2px solid var(--accent);font-weight:700">';
  // cart.length inclui linhas de saldo zero, que o bloco descarta — contar os agregados.
  var pedTotal = list.reduce(function(s, r) { return s + r.pedidos; }, 0);
  html += '<td>TOTAL — ' + list.length + ' clientes</td><td></td><td class="cart-count">' + pedTotal + '</td>';
  html += '<td class="cart-val">' + fmtBRL(total) + '</td><td></td></tr>';
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
    html += '<span>' + escHtml((a.consultor_nome || '').split(' ').slice(0, 2).join(' ')) + (a.notas ? ' — ' + escHtml(String(a.notas).slice(0, 35)) : '') + (hasCI ? ' ✓CI' : '') + tipoTag + '</span>';
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

  // 12/05 polimento: injeção de CSS (cockpit-blocks.css é root-only, JS é rw-rw-rw)
  if (!document.getElementById('vert-polish-css')) {
    var s = document.createElement('style'); s.id = 'vert-polish-css';
    s.textContent = '.vert-cards{display:grid !important;grid-template-columns:repeat(4,1fr) !important;gap:6px}'+
      /* 12/05: Locação + Serviço (regime caixa) */
      '.loc-srv-card{grid-column:span 2}'+
      '.mosaic .card:has(#servico-recente){grid-column:1/-1}'+
      '.mosaic .card:has(#locacao-recente){grid-column:span 3}'+
      '.mosaic .card:has(#clientes-novos-rec){grid-column:span 2}'+
      '.mosaic .card:has(#mapa-uf){grid-column:span 3}'+
      /* 10/07 EQUIPE EM CAMPO — AO VIVO */
      '.cockpit-grid:has(#campo-mapa){padding-bottom:72px}'+
      '.mosaic .card:has(#campo-mapa){grid-column:span 2}'+
      '.mosaic .card:has(#campo-lista){grid-column:span 1}'+
      '@media (max-width:1200px){.mosaic .card:has(#campo-mapa),.mosaic .card:has(#campo-lista){grid-column:span 1}}'+
      '#campo-mapa{height:360px;position:relative;padding:0!important}'+
      '#campo-mapa .leaflet-container{width:100%;height:100%;background:#0b1418;border-radius:6px}'+
      '.campo-tip{background:#13242b;border:1px solid #1e3a44;color:#e6eef0;font-family:var(--mono);font-size:10px;padding:3px 6px;border-radius:4px}'+
      '.campo-count{display:flex;gap:10px;font-family:var(--mono);font-size:10px;color:var(--text-dim);padding:2px 4px 6px}'+
      '.campo-count b{color:var(--text);font-weight:800}'+
      '.campo-row{display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;font-family:var(--mono);font-size:12px;padding:5px 6px;border-radius:4px;border-bottom:1px solid rgba(255,255,255,.03)}'+
      '.campo-row:nth-child(odd){background:rgba(255,255,255,.015)}'+
      '.campo-nome{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);font-weight:700}'+
      '.campo-placa{margin-left:7px;font-size:9px;font-weight:600;color:var(--text-dim);letter-spacing:.4px;text-transform:uppercase}'+
      '.campo-sub{font-size:9px;color:var(--text-dim);font-weight:500}'+
      '.campo-badges{display:flex;gap:5px;font-size:10px}'+
      '.campo-badge{font-family:var(--mono);font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap}'+
      '.campo-b-run{color:#0b1418;background:#00d4aa}'+
      '.campo-b-stop{color:#94a3b8;background:rgba(148,163,184,.12)}'+
      '.campo-b-ci{color:#16a34a;background:rgba(22,163,74,.12)}'+
      '.campo-b-ag{color:#38bdf8;background:rgba(56,189,248,.12)}'+
      '.campo-b-stale{color:#d97706;background:rgba(217,119,6,.12)}'+
      '.campo-empty{text-align:center;padding:16px;font-family:var(--mono);font-size:10px;color:var(--text-dim)}'+
      '.loc-table-wrap,.srv-table-wrap{overflow-x:auto;overflow-y:auto;max-height:340px}'+
      '.loc-table,.srv-table{width:100%;font-family:var(--mono);font-size:9px;border-collapse:collapse}'+
      '.loc-table th,.srv-table th{font-size:7px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.6px;padding:4px 6px;border-bottom:1px solid var(--border);text-align:left;background:var(--bg-card);position:sticky;top:0;z-index:2}'+
      '.loc-table td,.srv-table td{padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.02);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}'+
      '.loc-table tr:hover,.srv-table tr:hover{background:rgba(255,255,255,.02)}'+
      '.loc-day-total td{background:rgba(94,234,212,.06);border-top:1px solid rgba(94,234,212,.25) !important;border-bottom:1px solid rgba(94,234,212,.15) !important;font-weight:700;color:#5EEAD4;font-family:var(--sans);text-transform:uppercase;letter-spacing:1.2px;font-size:9px;padding:6px 8px !important}'+
      '.srv-day-total td{background:rgba(139,92,246,.08);border-top:1px solid rgba(139,92,246,.25) !important;border-bottom:1px solid rgba(139,92,246,.15) !important;font-weight:700;color:#8B5CF6;font-family:var(--sans);text-transform:uppercase;letter-spacing:1.2px;font-size:9px;padding:6px 8px !important}'+
      '.loc-grand-total td,.srv-grand-total td{background:var(--bg-ticker);border-top:2px solid var(--accent) !important;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1.2px;font-size:9px;padding:6px 8px !important;font-family:var(--sans)}'+
      '@media (max-width:1200px){.loc-srv-card{grid-column:span 1}}'+
      /* 12/05: funil-leads matriz consultor × estado */
      '.funil-mat{display:flex;flex-direction:column;gap:1px}'+
      '.funil-mat-head,.funil-mat-row{display:grid;grid-template-columns:minmax(90px,2fr) repeat(5,minmax(36px,1fr));gap:4px;align-items:center;font-family:var(--mono);font-size:11px;padding:3px 6px;border-radius:3px}'+
      '.funil-mat-head{font-size:9px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid var(--border)}'+
      '.funil-mat-head>span:not(:first-child){text-align:center;cursor:help}'+
      '.funil-mat-row>span:not(:first-child):not(:last-child){text-align:center}'+
      '.funil-mat-row:nth-child(odd){background:rgba(255,255,255,.015)}'+
      '.funil-mat-row-crit{box-shadow:inset 3px 0 0 var(--red);padding-left:9px !important}'+
      '.funil-mat-row-warn{box-shadow:inset 3px 0 0 #ff8a4c;padding-left:9px !important}'+
      '.funil-mat-cons{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}'+
      '.funil-mat-total{border-top:2px solid var(--accent);margin-top:3px;background:rgba(0,212,170,.04);font-weight:700}'+
      /* 12/05: separar KPI strip dos vert-cards (estavam visualmente colados) */
      '#vert-cards{margin-bottom:14px !important;padding-bottom:14px !important;border-bottom:1px solid var(--border)}'+
      '.kpi-strip{grid-template-columns:repeat(4,1fr) !important;gap:6px;margin-top:6px !important}'+
      '@media (max-width:900px){.kpi-strip{grid-template-columns:repeat(2,1fr) !important}}'+
      /* 12/05 carteira: card ocupa 2 colunas do mosaic (precisa de espaço pras 7 cols nova) */
      '.mosaic .card:has(#pedidos-recentes){grid-column:span 2}'+
      '#pedidos-recentes .pedido-header,#pedidos-recentes .pedido-row{grid-template-columns:34px 1.4fr 0.9fr 70px 1.3fr 90px 80px !important}'+
      '#pedidos-recentes .pedido-col-prod{color:var(--text);font-weight:500}'+
      '#pedidos-recentes .pedido-col-vol{color:var(--text-dim);font-variant-numeric:tabular-nums;text-align:right}'+
      '#pedidos-recentes .pedido-col-loc{color:var(--text-dim);font-size:8px}'+
      '#pedidos-recentes .pedido-col-prod-h,#pedidos-recentes .pedido-col-vol-h,#pedidos-recentes .pedido-col-loc-h{font-family:var(--mono);font-size:7px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.6px}'+
      '@media (max-width:1200px){.mosaic .card:has(#pedidos-recentes){grid-column:span 1}#pedidos-recentes .pedido-header,#pedidos-recentes .pedido-row{grid-template-columns:30px 1fr 1fr auto !important}#pedidos-recentes .pedido-col-prod,#pedidos-recentes .pedido-col-vol,#pedidos-recentes .pedido-col-loc,#pedidos-recentes .pedido-col-prod-h,#pedidos-recentes .pedido-col-vol-h,#pedidos-recentes .pedido-col-loc-h{display:none}}'+
      /* 12/05 fat-dia: card span 2 + 11 colunas (DATA, TIPO, CLIENTE, CONSULTOR, NF, PEDIDO, PRODUTO, CIDADE, VOL, VALOR, ACUM) */
      '.mosaic .card:has(#fat-dia){grid-column:span 2}'+
      '#fat-dia .fat-dia-header,#fat-dia .fat-dia-row{grid-template-columns:36px 52px 1.3fr 0.9fr 60px 60px 1.3fr 0.9fr 50px 75px 70px !important;gap:4px !important;font-size:9px}'+
      '#fat-dia .fat-col-cons-h,#fat-dia .fat-col-nf-h,#fat-dia .fat-col-ped-h,#fat-dia .fat-col-prod-h,#fat-dia .fat-col-cid-h,#fat-dia .fat-col-vol-h{font-family:var(--mono);font-size:7px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.6px}'+
      '#fat-dia .fat-dia-day-total{background:rgba(255,255,255,.025);border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:9px;padding:4px 6px;margin-top:2px}'+
      '@media (max-width:1200px){.mosaic .card:has(#fat-dia){grid-column:span 1}#fat-dia .fat-dia-header,#fat-dia .fat-dia-row{grid-template-columns:36px 50px 1fr 80px 80px !important}#fat-dia .fat-col-cons,#fat-dia .fat-col-cons-h,#fat-dia .fat-col-nf,#fat-dia .fat-col-nf-h,#fat-dia .fat-col-ped,#fat-dia .fat-col-ped-h,#fat-dia .fat-col-prod,#fat-dia .fat-col-prod-h,#fat-dia .fat-col-cid,#fat-dia .fat-col-cid-h,#fat-dia .fat-col-vol,#fat-dia .fat-col-vol-h{display:none}#fat-dia .fat-dia-day-total span:nth-child(3){grid-column:span 2 !important}}'+
      '.vert-block{padding:8px 0 6px;border-top:1px solid var(--border)}'+
      '.vert-block:first-of-type{border-top:none}'+
      '.vert-block-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}'+
      '.vert-block-lbl{font-family:var(--mono);font-size:9px;font-weight:800;letter-spacing:1.4px;color:var(--text-dim);text-transform:uppercase}'+
      '.vert-block-pct{font-family:var(--mono);font-size:13px;font-weight:800;letter-spacing:-.02em}'+
      '.vert-block-val{font-family:var(--mono);font-size:18px;font-weight:800;color:var(--text);letter-spacing:-.025em;line-height:1;margin:2px 0 3px;font-variant-numeric:tabular-nums}'+
      '.vert-block-sub{font-family:var(--mono);font-size:9px;color:var(--text-dim);margin-bottom:4px}'+
      '.vert-bar{height:4px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden}'+
      '.vert-bar-fill{height:100%;border-radius:2px;transition:width .5s ease}'+
      '.vert-foot{margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);font-family:var(--mono)}'+
      '.vert-foot-row{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:baseline;font-size:9px;padding:2px 0}'+
      '.vert-foot-lbl{color:var(--text-dim);font-weight:700;letter-spacing:1px;text-transform:uppercase}'+
      '.vert-foot-val{font-weight:700;text-align:right;font-variant-numeric:tabular-nums}'+
      '.vert-foot-pct{font-weight:700;text-align:right;font-size:11px}'+
      '.vert-foot-leads{display:flex;justify-content:space-between;font-size:9px;color:var(--text-dim);margin-top:4px;padding-top:4px;border-top:1px solid var(--border)}';
    document.head.appendChild(s);
  }

  // 12/05 polimento: 4 cards mantidos (CORPORATIVO entra pra fechar total YTD com KPI strip — R$ 332K YTD).
  // Card corp ganha estilo mais discreto (cor roxa neutra) pra dar peso menor que AGRO/ÁGUA/FLORESTAS.
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

    // 31/07 fix: NAO somar locacao aqui. O `realizado` de vw_plan_vs_real_vertical ja
    // traz a vw_nfse_consultor_note inteira (locacao 0301 + servico) no UNION ALL, entao
    // este bloco contava a locacao da AGUA duas vezes (R$ 2,37 mi no YTD de 2026).

    var pctMes = metaMes > 0 ? realMes / metaMes * 100 : 0;
    var pctYTD = metaYTD > 0 ? realYTD / metaYTD * 100 : 0;
    var pctAno = metaAno > 0 ? realAno / metaAno * 100 : 0;

    var vLeads = leads.filter(function(l) {
      if (v === 'AGUA') return (l.produto || '').toUpperCase().indexOf('AGUA') >= 0 || (l.produto || '').toUpperCase().indexOf('GUA') >= 0;
      return isVertConsultor(l.consultor_nome, v);
    });
    var vLeadsQuentes = vLeads.filter(function(l) { return safeNum(l.temperatura) >= 5; }).length;

    // 12/05 polimento v2: tirei projeção fim ano (info redundante c/ MÊS+YTD, poluía cards).
    html += '<div class="vert-card vert-' + v.toLowerCase() + '">';
    html += '<div class="vert-card-title ' + v.toLowerCase() + '">' + vertLabels[v] + '</div>';

    // MÊS — destaque do dia-a-dia
    html += '<div class="vert-block">';
    html += '<div class="vert-block-head"><span class="vert-block-lbl">MÊS</span><span class="vert-block-pct" style="color:' + pctColor(pctMes) + '">' + fmtPct(pctMes) + '</span></div>';
    html += '<div class="vert-block-val">' + fmtBRL(realMes) + '</div>';
    html += '<div class="vert-block-sub">meta ' + fmtBRL(metaMes) + '</div>';
    html += '<div class="vert-bar"><div class="vert-bar-fill" style="width:' + Math.min(100, pctMes) + '%;background:' + pctColor(pctMes) + '"></div></div>';
    html += '</div>';

    // YTD — ritmo acumulado
    html += '<div class="vert-block">';
    html += '<div class="vert-block-head"><span class="vert-block-lbl">YTD</span><span class="vert-block-pct" style="color:' + pctColor(pctYTD) + '">' + fmtPct(pctYTD) + '</span></div>';
    html += '<div class="vert-block-val">' + fmtBRL(realYTD) + '</div>';
    html += '<div class="vert-block-sub">esperado ' + fmtBRL(metaYTD) + '</div>';
    html += '<div class="vert-bar"><div class="vert-bar-fill" style="width:' + Math.min(100, pctYTD) + '%;background:' + pctColor(pctYTD) + '"></div></div>';
    html += '</div>';

    // Footer leads/quentes
    html += '<div class="vert-foot">';
    html += '<div class="vert-foot-leads"><span>' + vLeads.length + ' leads</span><span style="color:var(--red)">' + vLeadsQuentes + ' quentes</span></div>';
    html += '</div>';

    html += '</div>';
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
      msg: 'Lead' + (l.cidade || l.uf ? ' ' + (l.cidade || l.uf) : '') + (l.consultor_nome ? ' (' + l.consultor_nome.split(' ').slice(0, 2).join(' ') + ')' : ''),
      ts: l.data_entrada || ''
    });
  });

  // Today's orders from carteira
  cart.filter(function(c) { return (c.data_emissao || c.created_at || '').startsWith(TODAY_STR); }).forEach(function(c) {
    items.push({
      time: (c.created_at || '').slice(11, 16) || '—',
      type: 'pedido',
      msg: fmtBRL(safeNum(c.saldo_carteira != null ? c.saldo_carteira : (c.vlr_carteira || c.valor || c.vlr_total))) + ' — ' + (c.nome_cliente || c.cliente || '').slice(0, 25),
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
/* ═══════════════════════════════════════════════════════════
   EQUIPE EM CAMPO — AO VIVO (10/07)
   Frota (Mobi7) + celular (Traccar) no mapa + check-in/agenda de hoje
   Fontes: frota_mobi7_posicao, posicoes_equipe, frota_veiculos, atividades
   ═══════════════════════════════════════════════════════════ */
var _campoMapa = null;
function _campoPrimeiroUltimo(nome) {
  var p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0];
}
function _campoMinAtras(iso) {
  if (!iso) return null;
  return Math.max(0, Math.round((NOW.getTime() - new Date(iso).getTime()) / 60000));
}
function _campoQuando(min) {
  if (min == null) return '—';
  if (min < 1) return 'agora';
  if (min < 60) return 'há ' + min + ' min';
  var h = Math.floor(min / 60);
  return 'há ' + h + 'h' + (min % 60 ? String(min % 60).padStart(2, '0') : '');
}
function renderEquipeCampoVivo(cfg) {
  var mapEl = document.getElementById('campo-mapa');
  var listEl = document.getElementById('campo-lista');
  if (!mapEl && !listEl) return;
  Promise.all([
    sbFetch('frota_mobi7_posicao', 'select=placa,motorista,apelido,cidade,estado,lat,lng,velocidade,ignicao,data_posicao'),
    sbFetch('posicoes_equipe', 'select=consultor_nome,lat,lng,speed_kmh,battery_pct,fixed_at'),
    sbFetch('frota_veiculos', 'select=placa,responsavel,modelo,marca'),
    sbFetch('atividades', 'data=eq.' + TODAY_STR + '&select=consultor_nome,tipo,dados_checkin')
  ]).then(function(res) {
    var carros = (res[0] || []).filter(function(c) { return c.lat != null && c.lng != null; });
    var cels = (res[1] || []).filter(function(c) { return c.lat != null && c.lng != null; });
    var veic = res[2] || [];
    var ats = res[3] || [];
    // placa -> cadastro (responsável, modelo, marca)
    var placaInfo = {};
    veic.forEach(function(v) { if (v.placa) placaInfo[String(v.placa).toUpperCase().trim()] = v; });
    carros.forEach(function(c) {
      var info = placaInfo[String(c.placa || '').toUpperCase().trim()] || {};
      c._resp = (c.motorista && c.motorista.trim()) || info.responsavel || c.apelido || c.placa;
      c._modelo = info.modelo || '';
      c._min = _campoMinAtras(c.data_posicao);
      c._rodando = c.ignicao === true && (c.velocidade || 0) > 3;
    });
    cels.forEach(function(c) { c._min = _campoMinAtras(c.fixed_at); });
    // check-in / agenda de hoje por consultor (chave = primeiro+último nome, minúsculo)
    var porCons = {};
    function ent(nome) {
      var k = _campoPrimeiroUltimo(nome).toLowerCase();
      if (!porCons[k]) porCons[k] = { checkins: 0, visitas: 0 };
      return porCons[k];
    }
    ats.forEach(function(a) {
      var e = ent(a.consultor_nome);
      if (a.dados_checkin) e.checkins++;
      if ((a.tipo || '').toLowerCase().indexOf('visita') >= 0) e.visitas++;
    });
    _renderCampoMapa(mapEl, carros, cels);
    _renderCampoLista(listEl, carros, cels, porCons);
  }).catch(function(e) {
    console.error('[COCKPIT] renderEquipeCampoVivo error:', e);
    if (listEl) listEl.innerHTML = '<div class="campo-empty">Sem dados de posição no momento.</div>';
  });
}
function _renderCampoMapa(el, carros, cels) {
  if (!el || typeof L === 'undefined') return;
  if (_campoMapa) { try { _campoMapa.remove(); } catch (e) {} _campoMapa = null; }
  var map = L.map(el, { zoomControl: false, attributionControl: false }).setView([-16, -49], 4);
  _campoMapa = map;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
  var pts = [];
  // Carros (frota) — verde se rodando, cinza se parado
  carros.forEach(function(c) {
    var cor = c._rodando ? '#00d4aa' : '#64748b';
    var ll = [c.lat, c.lng];
    pts.push(ll);
    L.circleMarker(ll, { radius: 6, fillColor: cor, fillOpacity: 0.9, color: '#0b1418', weight: 1.5 })
      .bindTooltip('🚗 ' + escHtml(_campoPrimeiroUltimo(c._resp)) +
        (c.placa ? ' · ' + escHtml(c.placa) : '') + (c._modelo ? ' ' + escHtml(c._modelo) : '') +
        ' · ' + escHtml(c.cidade || '?') +
        (c._rodando ? ' · ' + (c.velocidade || 0) + ' km/h' : ' · parado') +
        ' · ' + _campoQuando(c._min), { className: 'campo-tip' }).addTo(map);
  });
  // Celulares (Traccar) — azul pulsante
  cels.forEach(function(c) {
    var ll = [c.lat, c.lng];
    pts.push(ll);
    var icon = L.divIcon({ className: 'mapa-lead-pulse', iconSize: [16, 16],
      html: '<div style="width:9px;height:9px;background:rgba(56,189,248,.95);border-radius:50%;box-shadow:0 0 8px rgba(56,189,248,.7),0 0 16px rgba(56,189,248,.35)"></div>' });
    L.marker(ll, { icon: icon })
      .bindTooltip('📱 ' + escHtml(_campoPrimeiroUltimo(c.consultor_nome)) +
        (c.speed_kmh != null ? ' · ' + Math.round(c.speed_kmh) + ' km/h' : '') +
        ' · ' + _campoQuando(c._min), { className: 'campo-tip' }).addTo(map);
  });
  if (pts.length) {
    try { map.fitBounds(pts, { padding: [30, 30], maxZoom: 9 }); } catch (e) {}
  }
  setTimeout(function() { try { map.invalidateSize(); } catch (e) {} }, 200);
}
function _renderCampoLista(el, carros, cels, porCons) {
  if (!el) return;
  var celFresco = cels.filter(function(c) { return c._min != null && c._min <= 20; }).length;
  var html = '<div class="campo-count"><span>🚗 <b>' + carros.length + '</b> carros</span>' +
    '<span>📱 <b>' + celFresco + '</b> celulares ativos</span></div>';
  // ordena: rodando primeiro, depois mais recente
  var lista = carros.slice().sort(function(a, b) {
    if (a._rodando !== b._rodando) return a._rodando ? -1 : 1;
    return (a._min || 9999) - (b._min || 9999);
  });
  if (!lista.length) {
    html += '<div class="campo-empty">Nenhum carro reportando posição agora.</div>';
    el.innerHTML = html;
    return;
  }
  lista.forEach(function(c) {
    var nome = _campoPrimeiroUltimo(c._resp);
    var e = porCons[nome.toLowerCase()] || { checkins: 0, visitas: 0 };
    var stale = c._min != null && c._min > 30;
    html += '<div class="campo-row">';
    var carro = [c.placa, c._modelo].filter(Boolean).join(' · ');
    html += '<div><div class="campo-nome">' + escHtml(nome) +
      (carro ? '<span class="campo-placa">' + escHtml(carro) + '</span>' : '') + '</div>' +
      '<div class="campo-sub">' + escHtml(c.cidade || '?') + (c.estado ? ' · ' + escHtml(c.estado) : '') + ' · ' + _campoQuando(c._min) + '</div></div>';
    html += '<div class="campo-badges">';
    html += c._rodando
      ? '<span class="campo-badge campo-b-run">▶ ' + (c.velocidade || 0) + ' km/h</span>'
      : '<span class="campo-badge ' + (stale ? 'campo-b-stale' : 'campo-b-stop') + '">■ parado</span>';
    html += '</div>';
    html += '<div class="campo-badges">' +
      '<span class="campo-badge campo-b-ci" title="check-ins hoje">✓ ' + e.checkins + '</span>' +
      '<span class="campo-badge campo-b-ag" title="visitas na agenda hoje">📅 ' + e.visitas + '</span></div>';
    html += '</div>';
  });
  el.innerHTML = html;
}

/* ═══ COMPRAS — NF DE ENTRADA (mês) ═══ */
/* nf_entrada tem TODA entrada — classifica por CFOP: x905/x906 = retorno de armazém (Multitrans,
   mercadoria NOSSA, nao e compra); x9xx = remessas/retornos (exceto x922 = compra entrega futura);
   x117 = recebimento entrega futura (ja contado no x922); tipo D = devolucao de VENDA;
   servico/despesa (nao gera estoque) = 9999, x933, x35x (frete), x253 (energia), x556 (uso e
   consumo), x551 (ativo). Mesma regra do EntradasNF.tsx do portal — manter em sincronia.
   v5: painel de GESTAO (card largo): classificacao do mes + tendencia ano + preco vs media ano. */
function nfeCategoria(tipo, cfop) {
  var c = String(cfop || '').trim();
  var suf = parseInt(c.slice(1), 10);
  if (suf === 905 || suf === 906 || suf === 907) return 'armazem';
  if (c === '9999' || suf === 933 || suf === 352 || suf === 353 || suf === 253 || suf === 556 || suf === 551) return 'servico';
  if (suf >= 900 && suf <= 949 && suf !== 922) return 'remessa';
  if (tipo === 'D') return 'dev_venda';
  if (suf === 117) return 'remessa';
  return 'compra';
}
function renderNfEntrada(cfg) {
  var el = document.getElementById('nf-entrada');
  if (!el) return;
  var rows = DATA.nfEntrada || [];
  var mes = MONTH_STR;
  var mMerc = {}, cur = { merc: 0, serv: 0, mov: 0, dev: 0 };
  var nfsMerc = {}, porForn = {}, prodMes = {}, prodAno = {};
  var ytd = 0, ytdServ = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var m = (r.data_entrada || '').slice(0, 7);
    var v = safeNum(r.total_item);
    var cat = nfeCategoria(r.tipo, r.cfop);
    if (cat === 'compra') {
      mMerc[m] = (mMerc[m] || 0) + v;
      ytd += v;
      var pk = r.produto_cod || r.produto_nome || '?';
      if (window._nfDeparaMap === undefined || window._nfDeparaLen !== (DATA.nfDepara || []).length) {
        window._nfDeparaMap = {};
        var dp = DATA.nfDepara || [];
        for (var di = 0; di < dp.length; di++) window._nfDeparaMap[dp[di].produto_cod] = dp[di].grupo;
        window._nfDeparaLen = dp.length;
      }
      var grp = window._nfDeparaMap[pk];
      if (grp) pk = 'g:' + grp;
      /* media do ano POR UNIDADE — mesmo codigo comprado em KG e TL nao pode misturar */
      var ak = pk + '|' + (r.unidade || '');
      if (!prodAno[ak]) prodAno[ak] = { qtd: 0, val: 0 };
      prodAno[ak].qtd += safeNum(r.quantidade);
      prodAno[ak].val += v;
      if (m === mes) {
        cur.merc += v;
        nfsMerc[(r.filial || '') + '|' + r.nota + '|' + (r.serie || '') + '|' + r.fornece_cod + '|' + (r.loja || '')] = 1;
        porForn[r.fornecedor_nome || ''] = (porForn[r.fornecedor_nome || ''] || 0) + v;
        if (!prodMes[pk]) prodMes[pk] = { nome: grp || r.produto_nome || pk, un: r.unidade || '', qtd: 0, val: 0 };
        prodMes[pk].qtd += safeNum(r.quantidade);
        prodMes[pk].val += v;
        if (!prodMes[pk].un && r.unidade) prodMes[pk].un = r.unidade;
      }
    } else {
      if (cat === 'servico') ytdServ += v;
      if (m === mes) {
        if (cat === 'servico') cur.serv += v;
        else if (cat === 'dev_venda') cur.dev += v;
        else cur.mov += v;
      }
    }
  }
  var y = parseInt(mes.slice(0, 4), 10), mo = parseInt(mes.slice(5), 10);
  var prevKey = mo === 1 ? (y - 1) + '-12' : y + '-' + String(mo - 1).padStart(2, '0');
  var prevVal = mMerc[prevKey] || 0;
  var delta = prevVal > 0 ? ((cur.merc - prevVal) / prevVal) * 100 : null;

  /* ── coluna esquerda: classificacao + tendencia ── */
  var html = '<div style="display:flex;gap:12px;align-items:stretch">';
  html += '<div style="width:196px;flex-shrink:0;border-right:1px solid var(--border);padding-right:10px">';
  html += '<div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);padding:2px 0">MERCADORIA (ESTOQUE) \u2014 M\u00caS</div>';
  html += '<div style="font-size:22px;font-weight:800;color:var(--green);line-height:1">' + fmtBRL(cur.merc) + '</div>';
  if (delta !== null) {
    var up = delta >= 0;
    html += '<div style="font-family:var(--mono);font-size:9px;margin-top:2px;color:' + (up ? 'var(--amber)' : 'var(--green)') + '">' + (up ? '\u25b2 +' : '\u25bc ') + delta.toFixed(0) + '% vs m\u00eas anterior (' + fmtBRL(prevVal) + ')</div>';
  }
  html += '<div style="font-family:var(--mono);font-size:9px;color:var(--text-muted);margin-top:2px">' + Object.keys(nfsMerc).length + ' NFs \u00b7 YTD ' + fmtBRL(ytd) + '</div>';
  html += '<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px">';
  var cls = [
    ['SERVI\u00c7OS/DESPESAS', cur.serv, 'var(--blue,#5b9dd9)'],
    ['ARMAZ\u00c9M/REMESSAS', cur.mov, 'var(--amber)'],
    ['DEVOLU\u00c7\u00c3O VENDA', cur.dev, 'var(--red)']
  ];
  for (var c1 = 0; c1 < cls.length; c1++) {
    html += '<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;padding:2px 0"><span style="color:var(--text-dim)">' + cls[c1][0] + '</span><span style="font-weight:700;color:' + cls[c1][2] + '">' + fmtBRL(cls[c1][1]) + '</span></div>';
  }
  html += '</div>';
  /* barras por mes (mercadoria) */
  var maxM = 0, mk;
  for (mk in mMerc) if (mMerc[mk] > maxM) maxM = mMerc[mk];
  if (maxM > 0) {
    html += '<div style="display:flex;gap:3px;align-items:flex-end;height:34px;margin-top:8px">';
    for (var mi = 1; mi <= mo; mi++) {
      var key = y + '-' + String(mi).padStart(2, '0');
      var val = mMerc[key] || 0;
      var h = Math.max(2, Math.round((val / maxM) * 30));
      html += '<div title="' + key + ': ' + fmtBRL(val) + '" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:1px">';
      html += '<div style="width:100%;height:' + h + 'px;border-radius:2px 2px 0 0;background:' + (mi === mo ? 'var(--green)' : 'var(--text-dim)') + ';opacity:' + (mi === mo ? '1' : '.45') + '"></div>';
      html += '<span style="font-family:var(--mono);font-size:7px;color:var(--text-dim)">' + 'JFMAMJJASOND'.charAt(mi - 1) + '</span></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  /* ── coluna direita: top produtos com preco vs media do ano ── */
  var prods = Object.keys(prodMes).map(function(k) { var p = prodMes[k]; p._k = k; return p; })
    .sort(function(a, b) { return b.val - a.val; });
  html += '<div style="flex:1;min-width:0">';
  html += '<div style="display:flex;gap:8px;padding:2px 4px;font-family:var(--mono);font-size:8px;color:var(--text-dim)">';
  html += '<span style="flex:1">PRODUTO \u2014 M\u00caS</span><span style="width:74px;text-align:right">VOLUME</span><span style="width:58px;text-align:right">VALOR</span><span style="width:34px;text-align:right">%M\u00caS</span><span style="width:86px;text-align:right">PRE\u00c7O vs ANO</span></div>';
  var shown = Math.min(prods.length, 10);
  for (var i2 = 0; i2 < shown; i2++) {
    var p = prods[i2];
    var qtdTxt = p.qtd > 0 ? p.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + (p.un ? '\u00a0' + p.un : '') : '\u2014';
    var pct = cur.merc > 0 ? (p.val / cur.merc) * 100 : 0;
    var pa = prodAno[p._k + '|' + (p.un || '')];
    var precoTxt = '<span style="color:var(--text-dim)">\u2014</span>';
    if (p.qtd > 0 && pa && pa.qtd > 0) {
      var pNow = p.val / p.qtd, pAno = pa.val / pa.qtd;
      var dp = pAno > 0 ? ((pNow - pAno) / pAno) * 100 : 0;
      if (dp > 5) precoTxt = '<span style="color:var(--red);font-weight:700">\u25b2 +' + dp.toFixed(0) + '%</span>';
      else if (dp < -5) precoTxt = '<span style="color:var(--green);font-weight:700">\u25bc ' + dp.toFixed(0) + '%</span>';
      else precoTxt = '<span style="color:var(--text-muted)">= m\u00e9dia</span>';
    }
    html += '<div style="display:flex;gap:8px;align-items:center;padding:2px 4px;border-bottom:1px solid var(--border);font-size:10px">';
    html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(p.nome) + '">' + escHtml(p.nome.slice(0, 42)) + '</span>';
    html += '<span style="font-family:var(--mono);color:var(--text-muted);width:74px;text-align:right;flex-shrink:0">' + qtdTxt + '</span>';
    html += '<span style="font-weight:700;width:58px;text-align:right;flex-shrink:0">' + fmtBRL(p.val) + '</span>';
    html += '<span style="font-family:var(--mono);color:var(--text-dim);width:34px;text-align:right;flex-shrink:0">' + pct.toFixed(0) + '%</span>';
    html += '<span style="font-family:var(--mono);font-size:9px;width:86px;text-align:right;flex-shrink:0">' + precoTxt + '</span>';
    html += '</div>';
  }
  if (prods.length === 0) html += '<div style="text-align:center;padding:16px;font-family:var(--mono);font-size:10px;color:var(--text-dim)">Sem compras de mercadoria no m\u00eas</div>';
  if (prods.length > shown) html += '<div style="padding:2px 4px;font-family:var(--mono);font-size:9px;color:var(--text-dim)">+' + (prods.length - shown) + ' produtos no m\u00eas</div>';

  var top = Object.keys(porForn).map(function(f) { return [f, porForn[f]]; }).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 3);
  if (top.length) {
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;padding:4px;border-top:1px solid var(--border);font-family:var(--mono);font-size:9px;color:var(--text-muted);margin-top:2px">';
    html += '<span style="color:var(--text-dim)">FORNECEDORES:</span>';
    for (var i3 = 0; i3 < top.length; i3++) html += '<span>' + (i3 + 1) + '. ' + escHtml(String(top[i3][0]).slice(0, 20)) + ' <span style="color:var(--text);font-weight:700">' + fmtBRL(top[i3][1]) + '</span></span>';
    html += '</div>';
  }
  html += '</div></div>';
  el.innerHTML = html;
}

function renderAllExec(cfg) {
  window._lastCfg = cfg;
  var kpis = computeAllKPIs(cfg);
  ensureLocServicoCards();
  var blocks = [
    function() { renderKPIs(kpis, cfg); },
    function() { renderMemoriaCalculo(kpis, cfg); },
    function() { renderVerticalCards(); },
    function() { renderDailyTable(kpis, cfg); },
    function() { renderFaturamentoDia(cfg); },
    function() { renderRanking(kpis, cfg); },
    function() { renderPedidos(cfg); },
    function() { renderLocacaoBloco(cfg); },
    function() { renderServicoBloco(cfg); },
    function() { renderMonthlyVision(cfg); },
    function() { renderCarteiraDetalhada(kpis, cfg); },
    function() { renderCarteiraCliente(kpis, cfg); },
    function() { renderClientes8020(cfg); },
    function() { renderAgendaCheckin(cfg); },
    function() { renderFreteMonitor(cfg); },
    function() { renderFarolCompost(cfg); },
    function() { renderNfEntrada(cfg); },
    function() { renderMapaPontos(cfg); },
    function() { renderEquipeCampoVivo(cfg); },
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
  // Compostagem (AGRO) no comparativo mensal — só se vertical null ou AGRO. Add 01/06.
  if (!vertFilter || vertFilter === 'AGRO') {
    (DATA.locacaoNorm || []).forEach(function(r) {
      if ((r.vertical || r.vertical_norm) !== 'AGRO') return;
      var t = r.id_tempo || '';
      locByMonth[t] = (locByMonth[t] || 0) + safeNum(r.vlr_liquido);
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
    if (isFuture && v2 === 0) { varColor = 'var(--text-dim)'; varArrow = ''; }
    html += '<span class="comp3-col-var" style="color:' + varColor + '">' + ((isFuture && v2 === 0) || !(v1 > 0 || v2 > 0) ? '—' : varArrow + fmtPct(Math.abs(varPct))) + '</span>';
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
    // 12/05: removido fallback ufFromDDD — vw_leads_publico não expõe telefone (PII).
    // Lead sem uf válido cai fora do mapa (era ~1-2% antes).
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
// 12/05 v3: 4 números objetivos por consultor. Sem quente/temperatura/perdido — só fato.
// SEM MEXER = leads ativos sem registro de toque há >14d ou nunca. MEXEU = leads com toque ≤14d.
// CONVERTEU = status=Ganho. TOTAL = todos leads do consultor. CONV% = CONVERTEU/TOTAL.
function renderFunilLeads(cfg) {
  var el = document.getElementById('funil-leads');
  if (!el) return;

  var leads = DATA.leadsAll && DATA.leadsAll.length ? DATA.leadsAll : (DATA.leads || []);
  var vertFilter = cfg.vertical || null;
  if (vertFilter) leads = leads.filter(function(l) { return isVertConsultor(l.consultor_nome, vertFilter); });

  var d14 = new Date(); d14.setDate(d14.getDate() - 14);
  var d14str = d14.toISOString().slice(0, 10);

  function lastTouch_(l) { return l.ultimo_contato || l.bot_touched_at || ''; }
  function isFechado_(l) { return (l.status || '') === 'Ganho'; }
  function isAtivo_(l) {
    var s = l.status || '';
    return s !== 'Ganho' && s !== 'Perdido' && s !== 'Cancelado' && s !== 'Inativo';
  }

  // Agrupa por consultor
  var byCons = {};
  leads.forEach(function(l) {
    var cn = (l.consultor_nome || '').trim() || '— sem consultor —';
    if (!byCons[cn]) byCons[cn] = { semMexer:0, mexeu:0, converteu:0, total:0 };
    var b = byCons[cn];
    b.total++;
    if (isFechado_(l)) b.converteu++;
    if (isAtivo_(l)) {
      var lt = lastTouch_(l);
      if (lt && lt.slice(0, 10) >= d14str) b.mexeu++;
      else b.semMexer++;
    }
  });

  var rows = Object.keys(byCons).map(function(cn) {
    var b = byCons[cn]; b.consultor = cn; return b;
  }).filter(function(b) {
    var nm = b.consultor.toUpperCase();
    if (nm === 'AIRA' || nm === 'BOT' || nm === '— SEM CONSULTOR —') return false;
    return b.total > 0;
  });
  rows.sort(function(a, b) { return b.semMexer - a.semMexer || b.total - a.total; });

  var tot = rows.reduce(function(t, r) {
    t.semMexer += r.semMexer; t.mexeu += r.mexeu; t.converteu += r.converteu; t.total += r.total; return t;
  }, { semMexer:0, mexeu:0, converteu:0, total:0 });

  function cell_(n, color) {
    if (!n) return '<span style="color:var(--text-mute);font-size:9px">—</span>';
    return '<span style="color:' + color + ';font-weight:700">' + n + '</span>';
  }
  function pctConv_(c, t) { return t > 0 ? (c / t * 100).toFixed(1) + '%' : '—'; }

  var html = '<div class="funil-mat">';
  html += '<div class="funil-mat-head">';
  html += '<span>CONSULTOR</span>';
  html += '<span style="color:var(--red)" title="leads ativos sem toque há mais de 14 dias">SEM MEXER</span>';
  html += '<span style="color:var(--green)" title="leads ativos com último contato nos últimos 14 dias">MEXEU</span>';
  html += '<span style="color:var(--accent)" title="leads com status=Ganho (fechou venda)">CONVERTEU</span>';
  html += '<span style="text-align:right">TOTAL</span>';
  html += '<span style="text-align:right" title="taxa de conversão sobre base total">CONV%</span>';
  html += '</div>';

  var shown = Math.min(rows.length, 12);
  for (var i = 0; i < shown; i++) {
    var r = rows[i];
    var alertCls = (r.semMexer >= 5 && r.mexeu === 0) ? ' funil-mat-row-crit' : '';
    html += '<div class="funil-mat-row' + alertCls + '">';
    html += '<span class="funil-mat-cons" title="' + escHtml(r.consultor) + '">' + escHtml(r.consultor) + '</span>';
    html += cell_(r.semMexer, 'var(--red)');
    html += cell_(r.mexeu, 'var(--green)');
    html += cell_(r.converteu, 'var(--accent)');
    html += '<span style="text-align:right;color:var(--text-dim);font-weight:700">' + r.total + '</span>';
    html += '<span style="text-align:right;color:var(--text-dim);font-size:9px">' + pctConv_(r.converteu, r.total) + '</span>';
    html += '</div>';
  }

  html += '<div class="funil-mat-row funil-mat-total">';
  html += '<span class="funil-mat-cons">TOTAL ' + rows.length + ' cons</span>';
  html += '<span style="color:var(--red);font-weight:700">' + tot.semMexer + '</span>';
  html += '<span style="color:var(--green);font-weight:700">' + tot.mexeu + '</span>';
  html += '<span style="color:var(--accent);font-weight:700">' + tot.converteu + '</span>';
  html += '<span style="text-align:right;font-weight:700">' + tot.total + '</span>';
  html += '<span style="text-align:right;font-weight:700">' + pctConv_(tot.converteu, tot.total) + '</span>';
  html += '</div>';
  html += '</div>';

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
  html += '<div class="loc-kpi"><span class="loc-kpi-label">Faturado no mês</span><span class="loc-kpi-val">' + fmtBRL(mrmVal) + '</span></div>';
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

/* ═══════════════════════════════════════════
   PAINEL LEADS — render functions
   ═══════════════════════════════════════════ */

function leadsNormalizeVertical(produto) {
  if (!produto) return 'Outro';
  var p = produto.toUpperCase();
  if (p.indexOf('COMPOST') >= 0) return 'Compostagem';
  if (p.indexOf('ULEXITA') >= 0 || p.indexOf('KCL') >= 0 || p.indexOf('FERTILIZ') >= 0) return 'Agro';
  if (p.indexOf('AGUA') >= 0 || p.indexOf('ÁGUA') >= 0 || p.indexOf('ETA') >= 0 || p.indexOf('ETE') >= 0 || p.indexOf('FILTRO') >= 0 || p.indexOf('BOMBA') >= 0 || p.indexOf('TEFEN') >= 0) return 'Agua';
  return 'Outro';
}

function leadsCalcDias(lead) {
  var d = lead.created_at || lead.data_entrada;
  if (!d) return 999;
  var ms = NOW.getTime() - new Date(d).getTime();
  return Math.floor(ms / 86400000);
}

function leadsCalcSemContato(lead) {
  if (!lead.ultimo_contato) return leadsCalcDias(lead);
  var ms = NOW.getTime() - new Date(lead.ultimo_contato).getTime();
  return Math.floor(ms / 86400000);
}

function renderLeadsKPIs(cfg) {
  var el = document.getElementById('leads-kpi-strip');
  if (!el) return;
  var leads = DATA.leads || [];
  var total = leads.length;
  var naoContatado = leads.filter(function(l) { return l.status === 'Não Contatado'; }).length;
  var quentes = leads.filter(function(l) { return l.ai_temperatura === 'quente'; }).length;
  var quentesParados = leads.filter(function(l) {
    return l.ai_temperatura === 'quente' && leadsCalcSemContato(l) > 7;
  }).length;
  var d7 = new Date(); d7.setDate(d7.getDate() - 7);
  var novos7d = leads.filter(function(l) { return (l.created_at || '') >= d7.toISOString(); }).length;
  var emConversa = leads.filter(function(l) { return l.status === 'Em Conversa' || l.status === 'Aguardando Retorno'; }).length;

  var cards = [
    { label: 'TOTAL ATIVOS', val: total, sub: '', color: 'var(--text)' },
    { label: 'NÃO CONTATADOS', val: naoContatado, sub: fmtPct(total > 0 ? naoContatado/total*100 : 0) + ' do total', color: naoContatado > total*0.4 ? 'var(--red)' : 'var(--amber)' },
    { label: 'QUENTES PARADOS >7d', val: quentesParados, sub: 'de ' + quentes + ' quentes', color: quentesParados > 0 ? 'var(--red)' : 'var(--green)' },
    { label: 'NOVOS (7d)', val: novos7d, sub: '', color: 'var(--blue)' },
    { label: 'EM CONVERSA', val: emConversa, sub: '', color: 'var(--green)' },
  ];

  var html = '';
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    html += '<div class="kpi-box kpi-pipe">';
    html += '<div class="kpi-label">' + c.label + '</div>';
    html += '<div class="kpi-value" style="color:' + c.color + '">' + c.val + '</div>';
    if (c.sub) html += '<div class="kpi-sub">' + c.sub + '</div>';
    html += '</div>';
  }
  el.innerHTML = html;
}

function renderLeadsSLA(cfg) {
  var el = document.getElementById('leads-sla');
  if (!el) return;
  var leads = DATA.leads || [];
  var byConsultor = {};
  leads.forEach(function(l) {
    var key = l.consultor_id || l.consultor_nome || 'Sem consultor';
    var nome = l.consultor_nome || 'Sem consultor';
    if (!byConsultor[key]) byConsultor[key] = { nome: nome, verde: 0, amarelo: 0, vermelho: 0, total: 0 };
    var dias = leadsCalcSemContato(l);
    if (l.status !== 'Não Contatado' && dias <= 3) byConsultor[key].verde++;
    else if (dias <= 14) byConsultor[key].amarelo++;
    else byConsultor[key].vermelho++;
    byConsultor[key].total++;
  });
  var list = Object.keys(byConsultor).map(function(k) { return byConsultor[k]; });
  list.sort(function(a, b) { return b.vermelho - a.vermelho || b.total - a.total; });
  list = list.filter(function(c) {
    var n = c.nome.toUpperCase();
    return n.indexOf('NÃO QUALIFICADO') < 0 && n.indexOf('NAO_ATRIBUIDO') < 0 && n.indexOf('TELEFONE NAO') < 0;
  });

  var html = '<div style="display:grid;grid-template-columns:1.5fr 3fr 0.5fr;gap:4px;font-size:9px;padding-bottom:6px;border-bottom:1px solid var(--border);font-weight:700;color:var(--text-dim)">';
  html += '<span>CONSULTOR</span><span>SLA CONTATO</span><span style="text-align:right">QTD</span></div>';
  for (var i = 0; i < Math.min(list.length, 15); i++) {
    var c = list[i];
    var pctV = c.total > 0 ? c.verde / c.total * 100 : 0;
    var pctA = c.total > 0 ? c.amarelo / c.total * 100 : 0;
    var pctR = c.total > 0 ? c.vermelho / c.total * 100 : 0;
    var nome = (c.nome || '').split(' ').slice(0, 2).join(' ');
    html += '<div style="display:grid;grid-template-columns:1.5fr 3fr 0.5fr;gap:4px;padding:5px 0;border-bottom:1px solid var(--border-accent);align-items:center;font-size:8px">';
    html += '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + escHtml(c.nome) + '">' + escHtml(nome) + '</span>';
    html += '<div style="display:flex;height:14px;border-radius:3px;overflow:hidden;background:var(--bg)">';
    if (pctV > 0) html += '<div style="width:' + pctV + '%;background:var(--green);min-width:2px" title="OK: ' + c.verde + '"></div>';
    if (pctA > 0) html += '<div style="width:' + pctA + '%;background:var(--amber);min-width:2px" title="3-14d: ' + c.amarelo + '"></div>';
    if (pctR > 0) html += '<div style="width:' + pctR + '%;background:var(--red);min-width:2px" title=">14d: ' + c.vermelho + '"></div>';
    html += '</div>';
    html += '<span style="text-align:right;font-weight:700">' + c.total + '</span></div>';
  }
  html += '<div style="display:flex;gap:12px;margin-top:8px;font-size:7px;color:var(--text-dim)">';
  html += '<span><span style="display:inline-block;width:8px;height:8px;background:var(--green);border-radius:2px;margin-right:3px"></span>&le;3d</span>';
  html += '<span><span style="display:inline-block;width:8px;height:8px;background:var(--amber);border-radius:2px;margin-right:3px"></span>3-14d</span>';
  html += '<span><span style="display:inline-block;width:8px;height:8px;background:var(--red);border-radius:2px;margin-right:3px"></span>&gt;14d</span></div>';
  el.innerHTML = html;
}

function renderLeadsFunil(cfg) {
  var el = document.getElementById('leads-funil');
  if (!el) return;
  var leads = DATA.leads || [];
  var etapaOrder = ['Novo Lead', 'Prospecção', 'Qualificação', 'Diagnóstico', 'Proposta', 'Negociação', 'Pedido', 'Retorno'];
  var byEtapa = {};
  leads.forEach(function(l) {
    var etapa = l.etapa || 'Sem Etapa';
    if (!byEtapa[etapa]) byEtapa[etapa] = { count: 0, quentes: 0, naoContatado: 0 };
    byEtapa[etapa].count++;
    if (l.ai_temperatura === 'quente') byEtapa[etapa].quentes++;
    if (l.status === 'Não Contatado') byEtapa[etapa].naoContatado++;
  });
  var shown = [];
  etapaOrder.forEach(function(e) { if (byEtapa[e]) shown.push(e); });
  Object.keys(byEtapa).forEach(function(e) { if (shown.indexOf(e) < 0) shown.push(e); });
  var total = leads.length;
  var html = '';
  for (var i = 0; i < shown.length; i++) {
    var etapa = shown[i];
    var d = byEtapa[etapa];
    var pct = total > 0 ? d.count / total * 100 : 0;
    var barWidth = Math.max(pct, 5);
    var passRate = '';
    if (i > 0) {
      var prev = byEtapa[shown[i - 1]];
      if (prev && prev.count > 0) passRate = ' (' + fmtPct(d.count / prev.count * 100) + ')';
    }
    html += '<div style="display:grid;grid-template-columns:100px 1fr 80px;gap:6px;padding:4px 0;align-items:center;font-size:8px">';
    html += '<span style="color:var(--text-dim);text-align:right;white-space:nowrap">' + escHtml(etapa) + '</span>';
    html += '<div style="position:relative;height:18px;background:var(--bg);border-radius:3px;overflow:hidden">';
    html += '<div style="width:' + barWidth + '%;height:100%;background:var(--accent);opacity:' + (1 - i * 0.08) + ';border-radius:3px"></div>';
    if (d.naoContatado > 0) {
      var redWidth = d.count > 0 ? d.naoContatado / d.count * barWidth : 0;
      html += '<div style="position:absolute;top:0;left:0;width:' + redWidth + '%;height:100%;background:var(--red);opacity:0.4;border-radius:3px 0 0 3px"></div>';
    }
    html += '</div>';
    html += '<span style="font-weight:700">' + d.count + '<span style="font-weight:400;color:var(--text-dim);font-size:7px">' + passRate + '</span>';
    if (d.quentes > 0) html += ' <span style="color:var(--red);font-size:7px">' + d.quentes + 'q</span>';
    html += '</span></div>';
  }
  html += '<div style="display:flex;gap:12px;margin-top:6px;font-size:7px;color:var(--text-dim)">';
  html += '<span><span style="display:inline-block;width:8px;height:8px;background:var(--accent);border-radius:2px;margin-right:3px;opacity:0.7"></span>Contatados</span>';
  html += '<span><span style="display:inline-block;width:8px;height:8px;background:var(--red);border-radius:2px;margin-right:3px;opacity:0.4"></span>Não contatados</span></div>';
  el.innerHTML = html;
}

function renderLeadsTemperatura(cfg) {
  var el = document.getElementById('leads-temp');
  if (!el) return;
  var leads = DATA.leads || [];
  var temps = ['quente', 'morno', 'frio'];
  var statusOrder = ['Não Contatado', 'Tentando Contato', 'Em Conversa', 'Aguardando Retorno', 'Não Respondeu', 'Qualificado', 'Sem Perfil'];
  var matrix = {};
  temps.forEach(function(t) { matrix[t] = {}; statusOrder.forEach(function(s) { matrix[t][s] = 0; }); });
  leads.forEach(function(l) {
    var t = l.ai_temperatura || 'morno';
    var s = l.status || 'Não Contatado';
    if (!matrix[t]) matrix[t] = {};
    if (!matrix[t][s]) matrix[t][s] = 0;
    matrix[t][s]++;
  });
  var usedStatus = statusOrder.filter(function(s) { return temps.some(function(t) { return (matrix[t][s] || 0) > 0; }); });
  var tempColors = { quente: 'var(--red)', morno: 'var(--amber)', frio: 'var(--blue)' };
  var tempLabels = { quente: 'QUENTE', morno: 'MORNO', frio: 'FRIO' };
  var maxVal = 0;
  temps.forEach(function(t) { usedStatus.forEach(function(s) { maxVal = Math.max(maxVal, matrix[t][s] || 0); }); });
  var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:8px">';
  html += '<tr><th style="text-align:left;padding:3px;color:var(--text-dim);font-size:7px"></th>';
  for (var i = 0; i < usedStatus.length; i++) {
    html += '<th style="text-align:center;padding:3px;color:var(--text-dim);font-size:7px;white-space:nowrap">' + usedStatus[i].replace('Não Contatado','S/Contato').replace('Tentando Contato','Tentando').replace('Aguardando Retorno','Ag.Retorno').replace('Não Respondeu','S/Resp') + '</th>';
  }
  html += '</tr>';
  for (var ti = 0; ti < temps.length; ti++) {
    var t = temps[ti];
    html += '<tr><td style="padding:4px;font-weight:700;color:' + tempColors[t] + ';white-space:nowrap">' + tempLabels[t] + '</td>';
    for (var si = 0; si < usedStatus.length; si++) {
      var v = matrix[t][usedStatus[si]] || 0;
      var intensity = maxVal > 0 ? v / maxVal : 0;
      var bg = v > 0 ? 'rgba(255,' + (t === 'quente' ? '100,100' : t === 'morno' ? '180,50' : '100,200') + ',' + (0.1 + intensity * 0.5) + ')' : 'transparent';
      html += '<td style="text-align:center;padding:4px;background:' + bg + ';border-radius:3px;font-weight:' + (v > 50 ? '700' : '400') + '">' + (v > 0 ? v : '') + '</td>';
    }
    html += '</tr>';
  }
  html += '</table></div>';
  el.innerHTML = html;
}

function renderLeadsVertical(cfg) {
  var el = document.getElementById('leads-vertical');
  if (!el) return;
  var leads = DATA.leads || [];
  var byVert = {};
  leads.forEach(function(l) {
    var v = leadsNormalizeVertical(l.produto);
    if (!byVert[v]) byVert[v] = { total: 0, quentes: 0, contatados: 0 };
    byVert[v].total++;
    if (l.ai_temperatura === 'quente') byVert[v].quentes++;
    if (l.status !== 'Não Contatado') byVert[v].contatados++;
  });
  var vertColors = { 'Compostagem': 'var(--green)', 'Agro': 'var(--accent-agro)', 'Agua': 'var(--blue)', 'Outro': 'var(--text-dim)' };
  var total = leads.length;
  var list = Object.keys(byVert).sort(function(a, b) { return byVert[b].total - byVert[a].total; });
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    var d = byVert[v];
    var pct = total > 0 ? d.total / total * 100 : 0;
    var contatPct = d.total > 0 ? d.contatados / d.total * 100 : 0;
    html += '<div style="margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:3px">';
    html += '<span style="font-weight:700;color:' + (vertColors[v] || 'var(--text)') + '">' + v + '</span>';
    html += '<span style="color:var(--text-dim)">' + d.total + ' leads (' + fmtPct(pct) + ')</span></div>';
    html += '<div style="height:16px;background:var(--bg);border-radius:3px;overflow:hidden">';
    html += '<div style="width:' + Math.max(pct, 3) + '%;height:100%;background:' + (vertColors[v] || 'var(--text-dim)') + ';opacity:0.6;border-radius:3px"></div></div>';
    html += '<div style="display:flex;gap:12px;font-size:7px;color:var(--text-dim);margin-top:2px">';
    html += '<span>Contatados: ' + fmtPct(contatPct) + '</span>';
    html += '<span style="color:var(--red)">' + d.quentes + ' quentes</span></div></div>';
  }
  el.innerHTML = html;
}

function renderLeadsUF(cfg) {
  var el = document.getElementById('leads-uf');
  if (!el) return;
  var leads = DATA.leads || [];
  var byUF = {};
  leads.forEach(function(l) {
    var uf = (l.uf || '').toUpperCase().trim();
    if (!uf || uf.length !== 2) uf = 'S/UF';
    if (!byUF[uf]) byUF[uf] = { total: 0, quentes: 0 };
    byUF[uf].total++;
    if (l.ai_temperatura === 'quente') byUF[uf].quentes++;
  });
  var list = Object.keys(byUF).sort(function(a, b) { return byUF[b].total - byUF[a].total; });
  var max = list.length > 0 ? byUF[list[0]].total : 1;
  var html = '<div style="display:grid;grid-template-columns:40px 1fr 50px;gap:3px;font-size:8px">';
  html += '<span style="color:var(--text-dim);font-weight:700">UF</span><span></span><span style="text-align:right;color:var(--text-dim);font-weight:700">QTD</span>';
  for (var i = 0; i < Math.min(list.length, 15); i++) {
    var uf = list[i];
    var d = byUF[uf];
    var barW = d.total / max * 100;
    html += '<span style="font-weight:600">' + uf + '</span>';
    html += '<div style="height:12px;background:var(--bg);border-radius:2px;overflow:hidden"><div style="width:' + barW + '%;height:100%;background:var(--blue);opacity:0.6;border-radius:2px"></div></div>';
    html += '<span style="text-align:right">' + d.total + (d.quentes > 0 ? ' <span style="color:var(--red);font-size:7px">' + d.quentes + 'q</span>' : '') + '</span>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderLeadsApodrecendo(cfg) {
  var el = document.getElementById('leads-apodrecendo');
  if (!el) return;
  var leads = DATA.leads || [];
  var quentes = leads.filter(function(l) { return l.ai_temperatura === 'quente' && leadsCalcSemContato(l) > 7; });
  quentes.sort(function(a, b) { return leadsCalcSemContato(b) - leadsCalcSemContato(a); });
  if (quentes.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:20px;font-size:10px;color:var(--green)">Nenhum lead quente parado &gt;7d</div>';
    return;
  }
  var html = '<div style="display:grid;grid-template-columns:2fr 1.2fr 0.8fr 0.6fr 0.6fr;gap:4px;font-size:8px;padding-bottom:5px;border-bottom:1px solid var(--border);font-weight:700;color:var(--text-dim)">';
  html += '<span>LEAD</span><span>CONSULTOR</span><span>PRODUTO</span><span>SCORE</span><span style="text-align:right">DIAS</span></div>';
  for (var i = 0; i < Math.min(quentes.length, 20); i++) {
    var l = quentes[i];
    var dias = leadsCalcSemContato(l);
    var diasColor = dias > 30 ? 'var(--red)' : dias > 14 ? 'var(--amber)' : 'var(--text)';
    var nome = (l.consultor_nome || 'N/A').split(' ').slice(0, 2).join(' ');
    var produto = leadsNormalizeVertical(l.produto);
    html += '<div style="display:grid;grid-template-columns:2fr 1.2fr 0.8fr 0.6fr 0.6fr;gap:4px;padding:4px 0;border-bottom:1px solid var(--border-accent);font-size:8px;align-items:center">';
    // 12/05: vw_leads_publico não expõe nome/telefone — mostrar cidade/UF como identificador anônimo.
    var leadLbl = (l.cidade ? l.cidade : '') + (l.uf ? '/' + l.uf : '');
    if (!leadLbl) leadLbl = 'Lead #' + l.id;
    html += '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + escHtml(leadLbl) + '">' + escHtml(leadLbl.slice(0, 25)) + '</span>';
    html += '<span style="color:var(--text-dim)">' + escHtml(nome) + '</span>';
    html += '<span style="color:var(--text-dim)">' + produto + '</span>';
    html += '<span>' + (l.ai_score || 0) + '</span>';
    html += '<span style="text-align:right;font-weight:700;color:' + diasColor + '">' + dias + 'd</span></div>';
  }
  html += '<div style="margin-top:6px;padding:6px;background:var(--bg-elevated,var(--bg));border-radius:4px;font-size:8px;color:var(--text-dim)">';
  html += '<strong style="color:var(--red)">' + quentes.length + ' leads quentes</strong> parados &gt;7 dias sem contato</div>';
  el.innerHTML = html;
}

/* FAROL COMPOSTAGEM (recuperado do build de 22/jul) */
function renderFarolCompost(cfg) {
  var el = document.getElementById('farol-compost');
  if (!el) return;
  sbFetch('vw_composta_farol', 'select=fazenda,consultor,status,cor,motivo,dias_sem_leitura,pico&order=status.asc,fazenda.asc').then(function(rows) {
    rows = rows || [];
    var ordem = { vermelho: 0, amarelo: 1, verde: 2, cinza: 3 };
    rows.sort(function(a, b) { return (ordem[a.cor] - ordem[b.cor]) || String(a.fazenda).localeCompare(b.fazenda); });
    var cores = { verde: '#2f9e8f', amarelo: '#e8a13b', vermelho: '#e05252', cinza: '#666' };
    var n = { verde: 0, amarelo: 0, vermelho: 0 };
    rows.forEach(function(r) { if (n[r.cor] !== undefined) n[r.cor]++; });
    var html = '<div style="display:flex;gap:14px;margin-bottom:8px;font-size:12px;font-weight:700">' +
      '<span style="color:#2f9e8f">● ' + n.verde + ' em dia</span>' +
      '<span style="color:#e8a13b">● ' + n.amarelo + ' atenção</span>' +
      '<span style="color:#e05252">● ' + n.vermelho + ' crítico</span></div>';
    html += '<table class="data-table" style="width:100%"><thead><tr><th></th><th>FAZENDA</th><th>CONSULTOR</th><th>FASE</th><th>SITUAÇÃO</th></tr></thead><tbody>';
    rows.forEach(function(r) {
      var faz = String(r.fazenda || '').replace(/compostagem/ig, '').trim().slice(0, 26) || r.fazenda;
      html += '<tr><td><span style="color:' + (cores[r.cor] || '#666') + '">●</span></td>' +
        '<td>' + faz + '</td><td>' + (r.consultor || '·') + '</td>' +
        '<td style="text-transform:capitalize">' + (r.status || '') + '</td>' +
        '<td style="color:' + (cores[r.cor] || '#666') + '">' + (r.motivo || '') + '</td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }).catch(function(e) { el.innerHTML = '<div style="color:#666;padding:12px">farol indisponível</div>'; });
}
