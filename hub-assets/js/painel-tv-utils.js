// ============================================================
// PAINEL TV UTILS — Bloomberg Terminal Style
// ============================================================
(function() {
    var PTV = window.PainelTV = {};

    // --- Constants ---
    var MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    var DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
    var VERTICAL_COLORS = { AGRO: '#2ecc71', AGUA: '#3498db', CORPORATIVO: '#9b59b6', FLORESTAS: '#e67e22' };

    // --- Data fetching ---
    PTV.fetchAllData = async function(verticalFilter) {
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var currentPeriod = year + '-' + month;
        var prevYear = year - 1;

        var queries = [
            fetchSupabase('vw_movimento_norm', 'select=*,consultor_nome,vertical_norm&order=data_faturamento.desc&limit=10000'),
            fetchSupabase('vw_plano_norm', 'select=consultor_nome,cliente,chave_cliente,vertical,tipo,valor,id_tempo&ano=eq.' + year + '&tipo=eq.RECEITA&limit=60000'),
            fetchSupabase('vw_pedidos_lifecycle', 'select=num_pedido,etapa,dt_pedido,vertical,vlr_total,vlr_faturado,representante,consultor_nome,arquivado_legado&etapa=in.(carteira,faturando)&arquivado_legado=is.false&order=dt_pedido.desc&limit=2000'),
            fetchSupabase('colaboradores', 'select=nome,nome_agrupado,vertical,ativo'),
            fetchSupabase('operacao', 'select=cfop,operacao_gerencial,descricao,entra_meta')
        ];

        if (!verticalFilter || verticalFilter === 'AGUA') {
            queries.push(fetchSupabase('vw_locacao_norm', 'select=*,consultor_nome,vertical_norm&limit=2000'));
        }

        var results = await Promise.all(queries);

        var mov = results[0] || [];
        var plan = results[1] || [];
        var carteira = results[2] || [];
        var profs = results[3] || [];
        var operacoes = results[4] || [];
        var locacao = results[5] || [];

        var cfopMap = {};
        operacoes.forEach(function(op) { cfopMap[String(op.cfop)] = op; });

        var profMap = {};
        var profVerticalMap = {};
        profs.forEach(function(p) {
            if (p.nome_agrupado) profMap[p.nome] = p.nome_agrupado;
            if (p.vertical) {
                profVerticalMap[p.nome] = p.vertical;
                if (p.nome_agrupado) profVerticalMap[p.nome_agrupado] = p.vertical;
            }
        });

        mov.forEach(function(m) {
            // Use normalized consultor_nome from view, fallback to representante
            m.representante = m.consultor_nome || m.representante || '';
            if (m.vertical_norm) m.vertical = m.vertical_norm;
            if (!m.vertical && m.representante) m.vertical = profVerticalMap[m.representante] || '';
            m._valor = parseFloat(m.total_produto) || 0;
            m._frete = parseFloat(m.valor_frete_item) || 0;
            m._valorSemFrete = m._valor - m._frete;
            // Normalize vertical: FLORESTAL -> FLORESTAS (DB inconsistency)
            if (m.vertical && m.vertical.toUpperCase() === 'FLORESTAL') m.vertical = 'FLORESTAS';
        });

        carteira.forEach(function(c) {
            c.representante = c.consultor_nome || c.representante || '';
            if (!c.vertical && c.representante) {
                c.vertical = profVerticalMap[c.representante] || '';
            }
            if (c.vertical && c.vertical.toUpperCase() === 'FLORESTAL') c.vertical = 'FLORESTAS';
            // Saldo aberto = a faturar (mesma regra do portal Pedidos & Faturamento)
            var bruto = parseFloat(c.vlr_total) || 0;
            var fat = parseFloat(c.vlr_faturado) || 0;
            c._saldo_aberto = Math.max(bruto - fat, 0);
        });

        var movMeta = mov.filter(function(m) {
            var op = cfopMap[String(m.cfop)];
            return op ? op.entra_meta : true;
        });

        if (verticalFilter) {
            movMeta = movMeta.filter(function(m) { return (m.vertical || '').toUpperCase() === verticalFilter.toUpperCase(); });
            plan = plan.filter(function(p) { return (p.vertical || '').toUpperCase() === verticalFilter.toUpperCase(); });
            carteira = carteira.filter(function(c) { return (c.vertical || '').toUpperCase() === verticalFilter.toUpperCase(); });
            if (verticalFilter !== 'AGUA') locacao = [];
        }

        var movCurrent = movMeta.filter(function(m) { return (m.id_tempo || '').startsWith(String(year)); });
        var movPrev = movMeta.filter(function(m) { return (m.id_tempo || '').startsWith(String(prevYear)); });

        // Separate locacao by year
        var locCurrent = locacao.filter(function(r) { return (r.id_tempo || '').startsWith(String(year)); });
        var locPrev = locacao.filter(function(r) { return (r.id_tempo || '').startsWith(String(prevYear)); });

        return {
            mov: movCurrent, movAll: movMeta, movPrev: movPrev,
            plan: plan, carteira: carteira, profs: profs, profMap: profMap,
            locacao: locCurrent, locacaoPrev: locPrev, operacoes: operacoes, cfopMap: cfopMap,
            year: year, month: month, currentPeriod: currentPeriod
        };
    };

    // --- Helpers ---
    function sum(arr, field) { return arr.reduce(function(s, r) { return s + (parseFloat(r[field]) || 0); }, 0); }
    function sumVal(arr) { return arr.reduce(function(s, r) { return s + (r._valor || 0); }, 0); }
    function fmtBRL(val) {
        if (val === null || val === undefined || isNaN(val)) return '-';
        if (Math.abs(val) >= 1000000) return 'R$ ' + (val / 1000000).toFixed(2).replace('.', ',') + 'M';
        if (Math.abs(val) >= 1000) return 'R$ ' + Math.round(val).toLocaleString('pt-BR');
        return 'R$ ' + Math.round(val).toLocaleString('pt-BR');
    }
    function fmtBRLFull(val) {
        if (val === null || val === undefined || isNaN(val)) return '-';
        return 'R$ ' + Math.round(val).toLocaleString('pt-BR');
    }
    function fmtPct(val) {
        if (val === null || val === undefined || isNaN(val)) return '-';
        return val.toFixed(1).replace('.', ',') + '%';
    }
    function pctClass(val, good, warn) {
        good = good || 80; warn = warn || 50;
        if (val >= good) return 'ptv-metric-good';
        if (val >= warn) return 'ptv-metric-warning';
        return 'ptv-metric-bad';
    }
    function verticalClass(v) { return (v || '').toLowerCase().replace(/[^a-z]/g, ''); }
    function isYTD(idTempo, year, month) {
        if (!idTempo) return false;
        var parts = idTempo.split('-');
        return parseInt(parts[0]) === year && parseInt(parts[1]) <= parseInt(month);
    }
    function isCurrentMonth(idTempo, year, month) { return idTempo === (year + '-' + month); }
    function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    PTV.sum = sum; PTV.sumVal = sumVal; PTV.fmtBRL = fmtBRL; PTV.fmtBRLFull = fmtBRLFull;
    PTV.fmtPct = fmtPct; PTV.pctClass = pctClass; PTV.MONTHS = MONTHS; PTV.DAYS = DAYS;
    PTV.VERTICAL_COLORS = VERTICAL_COLORS;

    // --- Block wrapper (always expanded, no toggle) ---
    var _blockId = 0;
    function block(title, content, opts) {
        opts = opts || {};
        var id = 'ptv-blk-' + (++_blockId);
        var fullClass = opts.full ? ' ptv-grid-full' : '';
        return '<div class="ptv-block' + fullClass + '">' +
            '<div class="ptv-block-header">' +
            '<span class="ptv-block-title">' + title + '</span>' +
            '</div>' +
            '<div class="ptv-block-scroll scrolled-bottom">' +
            '<div class="ptv-block-body expanded" id="' + id + '">' + content + '</div>' +
            '</div></div>';
    }

    // Scroll fade indicator logic
    PTV._updateScrollFade = function(blockEl) {
        var wrapper = blockEl.querySelector('.ptv-block-scroll');
        var body = blockEl.querySelector('.ptv-block-body');
        if (!wrapper || !body) return;
        var atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 8;
        var noOverflow = body.scrollHeight <= body.clientHeight + 2;
        if (atBottom || noOverflow || body.classList.contains('expanded')) {
            wrapper.classList.add('scrolled-bottom');
        } else {
            wrapper.classList.remove('scrolled-bottom');
        }
    };
    PTV._initScrollFades = function(container) {
        var bodies = container.querySelectorAll('.ptv-block-body');
        bodies.forEach(function(body) {
            var wrapper = body.parentElement;
            body.addEventListener('scroll', function() {
                var atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 8;
                if (atBottom) wrapper.classList.add('scrolled-bottom');
                else wrapper.classList.remove('scrolled-bottom');
            });
            // Initial check
            setTimeout(function() {
                var noOverflow = body.scrollHeight <= body.clientHeight + 2;
                if (noOverflow || body.classList.contains('expanded')) wrapper.classList.add('scrolled-bottom');
            }, 100);
        });
    };

    // --- Compute KPIs ---
    PTV.computeKPIs = function(data) {
        var year = data.year, month = data.month, currentPeriod = data.currentPeriod;
        var prevYear = year - 1;

        var movMonth = data.mov.filter(function(m) { return isCurrentMonth(m.id_tempo, year, month); });
        var movYTD = data.mov.filter(function(m) { return isYTD(m.id_tempo, year, month); });
        var movPrevMonth = data.movPrev.filter(function(m) { return isCurrentMonth(m.id_tempo, prevYear, month); });
        var movPrevYTD = data.movPrev.filter(function(m) { return isYTD(m.id_tempo, prevYear, month); });

        var planMonth = data.plan.filter(function(p) { return p.id_tempo === currentPeriod; });
        var planYTD = data.plan.filter(function(p) { return isYTD(p.id_tempo, year, month); });
        var planYear = data.plan;

        var metaMonth = sum(planMonth, 'valor');
        var metaYTD = sum(planYTD, 'valor');
        var metaYear = sum(planYear, 'valor');
        var realMonth = sumVal(movMonth);
        var realYTD = sumVal(movYTD);
        var realPrevMonth = sumVal(movPrevMonth);
        var realPrevYTD = sumVal(movPrevYTD);
        var carteiraTotal = sum(data.carteira, '_saldo_aberto');

        // Add locacao (AGUA rental revenue) to totals when available
        (data.locacao || []).forEach(function(r) {
            var v = parseFloat(r.vlr_liquido) || 0;
            if (isCurrentMonth(r.id_tempo, year, month)) realMonth += v;
            if (isYTD(r.id_tempo, year, month)) realYTD += v;
        });

        return {
            metaMonth: metaMonth, metaYTD: metaYTD, metaYear: metaYear,
            realMonth: realMonth, realYTD: realYTD, realYear: realYTD,
            realPrevMonth: realPrevMonth, realPrevYTD: realPrevYTD,
            atingMonth: metaMonth > 0 ? (realMonth / metaMonth * 100) : 0,
            atingYTD: metaYTD > 0 ? (realYTD / metaYTD * 100) : 0,
            atingYear: metaYear > 0 ? (realYTD / metaYear * 100) : 0,
            varVsPrevMonth: realPrevMonth > 0 ? ((realMonth - realPrevMonth) / realPrevMonth * 100) : 0,
            varVsPrevYTD: realPrevYTD > 0 ? ((realYTD - realPrevYTD) / realPrevYTD * 100) : 0,
            carteiraTotal: carteiraTotal,
            carteiraPctMeta: metaMonth > 0 ? (carteiraTotal / metaMonth * 100) : 0,
            movMonth: movMonth, movYTD: movYTD
        };
    };

    // --- Render KPI Strip ---
    PTV.renderKPIs = function(kpis) {
        var varMS = kpis.varVsPrevMonth >= 0 ? '+' : '';
        var varYS = kpis.varVsPrevYTD >= 0 ? '+' : '';

        function kpiCard(title, value, rows) {
            var h = '<div class="ptv-kpi-card"><div class="ptv-kpi-title">' + title + '</div>';
            h += '<div class="ptv-kpi-value">' + value + '</div>';
            rows.forEach(function(r) {
                h += '<div class="ptv-kpi-row"><span class="ptv-kpi-label">' + r[0] + '</span><span class="ptv-kpi-number ' + (r[2] || '') + '">' + r[1] + '</span></div>';
            });
            h += '<div class="ptv-progress"><div class="ptv-progress-fill" style="width:' + Math.min(rows[0] && rows[0][3] || 0, 100) + '%"></div></div>';
            h += '</div>';
            return h;
        }

        return '<div class="ptv-kpi-grid">' +
            kpiCard('Mes Atual', fmtBRLFull(kpis.realMonth), [
                ['Meta', fmtBRLFull(kpis.metaMonth), '', kpis.atingMonth],
                ['Atingimento', fmtPct(kpis.atingMonth), pctClass(kpis.atingMonth)],
                ['vs ' + ((kpis.year || 2026) - 1), varMS + fmtPct(kpis.varVsPrevMonth), kpis.varVsPrevMonth >= 0 ? 'positive' : 'negative']
            ]) +
            kpiCard('YTD Acumulado', fmtBRLFull(kpis.realYTD), [
                ['Meta YTD', fmtBRLFull(kpis.metaYTD), '', kpis.atingYTD],
                ['Atingimento', fmtPct(kpis.atingYTD), pctClass(kpis.atingYTD)],
                ['vs ' + ((kpis.year || 2026) - 1), varYS + fmtPct(kpis.varVsPrevYTD), kpis.varVsPrevYTD >= 0 ? 'positive' : 'negative']
            ]) +
            kpiCard('Meta Anual', fmtBRLFull(kpis.realYear), [
                ['Meta Total', fmtBRLFull(kpis.metaYear), '', kpis.atingYear],
                ['Progresso', fmtPct(kpis.atingYear), pctClass(kpis.atingYear, 25, 10)]
            ]) +
            kpiCard('Carteira', fmtBRLFull(kpis.carteiraTotal), [
                ['% Meta Mes', fmtPct(kpis.carteiraPctMeta), '', Math.min(kpis.carteiraPctMeta, 100)]
            ]) +
        '</div>';
    };

    // --- Render Daily Chart (Bloomberg style with accumulated) ---
    PTV.renderDailyChart = function(data) {
        var year = data.year, month = parseInt(data.month);
        var today = new Date();
        var todayDay = today.getDate();
        var daysInMonth = new Date(year, month, 0).getDate();
        var kpis = PTV.computeKPIs(data);

        // Group by day
        var dayTotals = {};
        var movMonth = data.mov.filter(function(m) { return isCurrentMonth(m.id_tempo, year, data.month); });
        movMonth.forEach(function(m) {
            var day = parseInt((m.data_faturamento || '').split('-')[2]) || 0;
            if (day > 0) dayTotals[day] = (dayTotals[day] || 0) + (m._valor || 0);
        });

        // Compute accumulated + max
        var acumulado = {};
        var acum = 0;
        var maxVal = 0;
        for (var d = 1; d <= daysInMonth; d++) {
            acum += (dayTotals[d] || 0);
            acumulado[d] = acum;
            if ((dayTotals[d] || 0) > maxVal) maxVal = dayTotals[d];
        }
        if (maxVal === 0) maxVal = 1;

        var totalMonth = sumVal(movMonth);
        var daysWithSales = Object.keys(dayTotals).length;
        var avgPerDay = daysWithSales > 0 ? totalMonth / daysWithSales : 0;
        var metaDiaria = kpis.metaMonth > 0 ? kpis.metaMonth / 22 : 0;
        var metaMonth = kpis.metaMonth;

        // Stats strip
        var html = '<div class="ptv-dc-stats">';
        html += '<div class="ptv-dc-stat"><div class="ptv-dc-stat-label">Faturado</div><div class="ptv-dc-stat-value">' + fmtBRLFull(totalMonth) + '</div></div>';
        html += '<div class="ptv-dc-stat"><div class="ptv-dc-stat-label">Meta Mes</div><div class="ptv-dc-stat-value">' + fmtBRLFull(metaMonth) + '</div></div>';
        html += '<div class="ptv-dc-stat"><div class="ptv-dc-stat-label">Falta</div><div class="ptv-dc-stat-value" style="color:' + (metaMonth - totalMonth > 0 ? '#ff4757' : '#00D4AA') + '">' + fmtBRLFull(Math.max(metaMonth - totalMonth, 0)) + '</div></div>';
        html += '<div class="ptv-dc-stat"><div class="ptv-dc-stat-label">Dias c/ NF</div><div class="ptv-dc-stat-value">' + daysWithSales + '</div></div>';
        html += '<div class="ptv-dc-stat"><div class="ptv-dc-stat-label">Media/Dia</div><div class="ptv-dc-stat-value">' + fmtBRL(avgPerDay) + '</div></div>';
        html += '<div class="ptv-dc-stat"><div class="ptv-dc-stat-label">Ating.</div><div class="ptv-dc-stat-value" style="color:' + (kpis.atingMonth >= 80 ? '#00D4AA' : kpis.atingMonth >= 50 ? '#f39c12' : '#ff4757') + '">' + fmtPct(kpis.atingMonth) + '</div></div>';
        html += '</div>';

        // Chart area: bars + SVG accumulation line
        html += '<div class="ptv-dc-chart">';

        // Bars
        html += '<div class="ptv-dc-bars">';
        for (var d = 1; d <= daysInMonth; d++) {
            var val = dayTotals[d] || 0;
            var height = (val / maxVal) * 100;
            var dt = new Date(year, month - 1, d);
            var isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            var isFuture = d > todayDay;
            var isToday = d === todayDay;
            var barColor = val > 0 ? '#00D4AA' : (isWeekend ? 'rgba(243,156,18,0.15)' : 'rgba(139,148,158,0.08)');
            if (isFuture) barColor = 'rgba(139,148,158,0.04)';
            var cls = isWeekend ? ' ptv-dc-weekend' : '';
            if (isFuture) cls += ' ptv-dc-future';
            if (isToday) cls += ' ptv-dc-today';

            html += '<div class="ptv-dc-bar-col' + cls + '">';
            html += '<div class="ptv-dc-tip">' + d + ' ' + DAYS[dt.getDay()] + ' — ' + (val > 0 ? fmtBRLFull(val) : 'Sem NF') + ' | Acum: ' + fmtBRLFull(acumulado[d]) + '</div>';
            html += '<div class="ptv-dc-bar" style="height:' + Math.max(height, 1) + '%;background:' + barColor + '"></div>';
            html += '</div>';
        }
        html += '</div>';

        // SVG Accumulation line overlay
        var maxAcum = acumulado[daysInMonth] || 1;
        var svgTarget = Math.max(metaMonth, maxAcum); // scale to whichever is bigger
        var points = [];
        for (var d = 1; d <= daysInMonth; d++) {
            if (d > todayDay && !dayTotals[d]) break;
            var x = ((d - 0.5) / daysInMonth) * 100;
            var y = 100 - ((acumulado[d] || 0) / svgTarget) * 100;
            points.push(x.toFixed(1) + ',' + y.toFixed(1));
        }
        html += '<svg class="ptv-dc-svg" viewBox="0 0 100 100" preserveAspectRatio="none">';
        // Meta line (horizontal)
        if (metaMonth > 0) {
            var metaY = 100 - (metaMonth / svgTarget) * 100;
            html += '<line x1="0" y1="' + metaY.toFixed(1) + '" x2="100" y2="' + metaY.toFixed(1) + '" stroke="#f39c12" stroke-width="0.3" stroke-dasharray="1,1" />';
        }
        // Accumulation polyline
        if (points.length > 1) {
            html += '<polyline points="' + points.join(' ') + '" fill="none" stroke="#3498db" stroke-width="0.5" />';
            // Dots
            points.forEach(function(p) {
                var xy = p.split(',');
                html += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="0.6" fill="#3498db" />';
            });
        }
        html += '</svg>';

        html += '</div>'; // end chart

        // Day labels
        html += '<div class="ptv-dc-labels">';
        for (var d = 1; d <= daysInMonth; d++) {
            var dt = new Date(year, month - 1, d);
            var isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            var isFuture = d > todayDay;
            var isToday = d === todayDay;
            var cls = isWeekend ? ' ptv-dc-weekend' : '';
            if (isFuture) cls += ' ptv-dc-future';
            if (isToday) cls += ' ptv-dc-today';
            html += '<div class="ptv-dc-label-col' + cls + '">';
            html += '<div class="ptv-dc-day">' + d + '</div>';
            html += '<div class="ptv-dc-dayname">' + DAYS[dt.getDay()].charAt(0) + '</div>';
            html += '</div>';
        }
        html += '</div>';

        return html;
    };

    // --- Monthly Table (compact) ---
    PTV.renderMonthlyTable = function(data) {
        var year = data.year, prevYear = year - 1;
        var byMonth = {}, byMonthPrev = {};
        for (var m = 1; m <= 12; m++) {
            byMonth[m] = data.mov.filter(function(r) { return r.id_tempo === year + '-' + String(m).padStart(2, '0'); });
            byMonthPrev[m] = data.movPrev.filter(function(r) { return r.id_tempo === prevYear + '-' + String(m).padStart(2, '0'); });
        }
        var planByMonth = {};
        data.plan.forEach(function(p) {
            var m = parseInt((p.id_tempo || '').split('-')[1]);
            if (m) planByMonth[m] = (planByMonth[m] || 0) + (parseFloat(p.valor) || 0);
        });

        var html = '<table class="ptv-table"><thead><tr><th></th>';
        for (var m = 1; m <= 12; m++) html += '<th>' + MONTHS[m-1] + '</th>';
        html += '<th>Total</th></tr></thead><tbody>';

        // Meta row
        var tM = 0;
        html += '<tr><td>META</td>';
        for (var m = 1; m <= 12; m++) { var v = planByMonth[m] || 0; tM += v; html += '<td>' + fmtBRL(v) + '</td>'; }
        html += '<td><strong>' + fmtBRL(tM) + '</strong></td></tr>';

        // Build locacao by month
        var locByMonth = {};
        (data.locacao || []).forEach(function(r) {
            var lm = parseInt((r.id_tempo || '').split('-')[1]);
            if (lm) locByMonth[lm] = (locByMonth[lm] || 0) + (parseFloat(r.vlr_liquido) || 0);
        });

        // Current year (mov + locacao)
        var tR = 0;
        html += '<tr><td>' + year + '</td>';
        for (var m = 1; m <= 12; m++) { var v = sumVal(byMonth[m]) + (locByMonth[m] || 0); tR += v; html += '<td>' + (v > 0 ? fmtBRL(v) : '-') + '</td>'; }
        html += '<td><strong>' + fmtBRL(tR) + '</strong></td></tr>';

        // Build prev year locacao by month
        var locPrevByMonth = {};
        (data.locacaoPrev || []).forEach(function(r) {
            var lm = parseInt((r.id_tempo || '').split('-')[1]);
            if (lm) locPrevByMonth[lm] = (locPrevByMonth[lm] || 0) + (parseFloat(r.vlr_liquido) || 0);
        });

        // Prev year (mov + locacao)
        var tP = 0;
        html += '<tr><td>' + prevYear + '</td>';
        for (var m = 1; m <= 12; m++) { var v = sumVal(byMonthPrev[m]) + (locPrevByMonth[m] || 0); tP += v; html += '<td>' + (v > 0 ? fmtBRL(v) : '-') + '</td>'; }
        html += '<td><strong>' + fmtBRL(tP) + '</strong></td></tr>';

        // Ating %
        html += '<tr><td>ATING %</td>';
        for (var m = 1; m <= 12; m++) {
            var meta = planByMonth[m] || 0;
            var real = sumVal(byMonth[m]) + (locByMonth[m] || 0);
            var pct = meta > 0 ? (real / meta * 100) : 0;
            html += '<td class="' + (real > 0 ? pctClass(pct) : '') + '">' + (real > 0 ? fmtPct(pct) : '-') + '</td>';
        }
        var totalA = tM > 0 ? tR / tM * 100 : 0;
        html += '<td class="' + pctClass(totalA) + '"><strong>' + fmtPct(totalA) + '</strong></td></tr>';

        html += '</tbody></table>';
        return html;
    };

    // --- Consultant Ranking (top N) ---
    PTV.renderConsultantTable = function(data, limit) {
        limit = limit || 10;
        var year = data.year, month = data.month, currentPeriod = data.currentPeriod, prevYear = year - 1;

        var consultants = {};
        data.mov.forEach(function(m) {
            var name = m.representante || 'Sem Consultor';
            if (!consultants[name]) consultants[name] = { name: name, vertical: m.vertical || '', movMonth: [], movYTD: [] };
            if (isCurrentMonth(m.id_tempo, year, month)) consultants[name].movMonth.push(m);
            if (isYTD(m.id_tempo, year, month)) consultants[name].movYTD.push(m);
        });

        var planByC = {};
        data.plan.forEach(function(p) {
            var n = p.consultor_nome || p.consultor || 'Sem Consultor';
            if (!planByC[n]) planByC[n] = { month: 0, ytd: 0 };
            var v = parseFloat(p.valor) || 0;
            if (p.id_tempo === currentPeriod) planByC[n].month += v;
            if (isYTD(p.id_tempo, year, month)) planByC[n].ytd += v;
        });

        // Fuzzy match plan names (abbreviated vs full names)
        function findPlanC(name) {
            if (planByC[name]) return planByC[name];
            var upper = name.toUpperCase();
            var keys = Object.keys(planByC);
            for (var i = 0; i < keys.length; i++) {
                if (upper.indexOf(keys[i].toUpperCase()) >= 0 || keys[i].toUpperCase().indexOf(upper) >= 0) return planByC[keys[i]];
            }
            return { month: 0, ytd: 0 };
        }
        var rows = Object.values(consultants).map(function(c) {
            var plan = findPlanC(c.name);
            var rM = sumVal(c.movMonth);
            var rY = sumVal(c.movYTD);
            return { name: c.name, vertical: c.vertical, realMonth: rM, metaMonth: plan.month, atingMonth: plan.month > 0 ? rM / plan.month * 100 : 0, realYTD: rY, metaYTD: plan.ytd, atingYTD: plan.ytd > 0 ? rY / plan.ytd * 100 : 0 };
        }).sort(function(a, b) { return b.realYTD - a.realYTD; });

        var shown = rows.slice(0, limit);
        var html = '<table class="ptv-table"><thead><tr>';
        html += '<th>Consultor</th><th>V</th><th>Mes</th><th>Meta Mes</th><th>%</th><th>YTD</th><th>Meta YTD</th><th>%</th>';
        html += '</tr></thead><tbody>';

        shown.forEach(function(r, i) {
            var vc = verticalClass(r.vertical);
            html += '<tr><td>' + escHtml(r.name) + '</td>';
            html += '<td><span class="ptv-badge ' + vc + '">' + (r.vertical || '-').substring(0,4) + '</span></td>';
            html += '<td>' + fmtBRL(r.realMonth) + '</td>';
            html += '<td style="color:var(--text-tertiary)">' + fmtBRL(r.metaMonth) + '</td>';
            html += '<td class="' + pctClass(r.atingMonth) + '">' + fmtPct(r.atingMonth) + '</td>';
            html += '<td>' + fmtBRL(r.realYTD) + '</td>';
            html += '<td style="color:var(--text-tertiary)">' + fmtBRL(r.metaYTD) + '</td>';
            html += '<td class="' + pctClass(r.atingYTD) + '">' + fmtPct(r.atingYTD) + '</td>';
            html += '</tr>';
        });

        if (rows.length > limit) {
            html += '<tr><td colspan="8" style="text-align:center;color:var(--text-tertiary);font-size:9px">+ ' + (rows.length - limit) + ' consultores</td></tr>';
        }

        html += '</tbody></table>';
        return html;
    };

    // --- Recent Transactions (ticker) ---
    PTV.renderRecentTransactions = function(data, limit) {
        limit = limit || 10;
        var movMonth = data.mov.filter(function(m) { return isCurrentMonth(m.id_tempo, data.year, data.month); });
        movMonth.sort(function(a, b) { return (b.data_faturamento || '').localeCompare(a.data_faturamento || ''); });

        var shown = movMonth.slice(0, limit);
        var html = '<table class="ptv-table"><thead><tr>';
        html += '<th>Data</th><th>Cliente</th><th>Produto</th><th>Consultor</th><th>Valor</th>';
        html += '</tr></thead><tbody>';

        shown.forEach(function(m) {
            var dt = (m.data_faturamento || '').split('-');
            var dtFmt = dt.length === 3 ? dt[2] + '/' + dt[1] : '-';
            html += '<tr>';
            html += '<td>' + dtFmt + '</td>';
            html += '<td>' + escHtml((m.nome_cliente || '').substring(0, 30)) + '</td>';
            html += '<td>' + escHtml((m.produto_nome || '').substring(0, 22)) + '</td>';
            html += '<td>' + escHtml((m.representante || '').substring(0, 18)) + '</td>';
            html += '<td>' + fmtBRLFull(m._valor) + '</td>';
            html += '</tr>';
        });

        if (movMonth.length > limit) {
            html += '<tr><td colspan="5" style="text-align:center;color:var(--text-tertiary);font-size:9px">+ ' + (movMonth.length - limit) + ' transacoes</td></tr>';
        }

        html += '</tbody></table>';
        return html;
    };

    // --- Client 80/20 (compact) ---
    PTV.renderClient8020 = function(data, limit) {
        limit = limit || 10;
        var movYTD = data.mov.filter(function(m) { return isYTD(m.id_tempo, data.year, data.month); });

        var clients = {};
        movYTD.forEach(function(m) {
            var n = m.nome_cliente || 'Desconhecido';
            clients[n] = (clients[n] || 0) + (m._valor || 0);
        });

        var rows = Object.entries(clients).map(function(e) { return { name: e[0], valor: e[1] }; }).sort(function(a, b) { return b.valor - a.valor; });
        var total = rows.reduce(function(s, r) { return s + r.valor; }, 0);

        var html = '<table class="ptv-table"><thead><tr><th>Cliente</th><th>Faturado</th><th>%</th><th>Acum%</th></tr></thead><tbody>';
        var acum = 0;
        rows.slice(0, limit).forEach(function(r) {
            acum += r.valor;
            var pct = total > 0 ? r.valor / total * 100 : 0;
            var acumPct = total > 0 ? acum / total * 100 : 0;
            html += '<tr><td>' + escHtml(r.name.substring(0, 32)) + '</td>';
            html += '<td>' + fmtBRL(r.valor) + '</td>';
            html += '<td>' + fmtPct(pct) + '</td>';
            html += '<td>' + fmtPct(acumPct) + '</td></tr>';
        });
        if (rows.length > limit) html += '<tr><td colspan="4" style="text-align:center;color:var(--text-tertiary);font-size:9px">+ ' + (rows.length - limit) + ' clientes</td></tr>';
        html += '</tbody></table>';
        return html;
    };

    // --- Product 80/20 ---
    PTV.renderProduct8020 = function(data, limit) {
        limit = limit || 10;
        var movYTD = data.mov.filter(function(m) { return isYTD(m.id_tempo, data.year, data.month); });

        var cats = {};
        movYTD.forEach(function(m) {
            var c = m.categoria || m.produto_nome || 'Outros';
            cats[c] = (cats[c] || 0) + (m._valor || 0);
        });

        var rows = Object.entries(cats).map(function(e) { return { name: e[0], valor: e[1] }; }).sort(function(a, b) { return b.valor - a.valor; });
        var total = rows.reduce(function(s, r) { return s + r.valor; }, 0);

        var html = '<table class="ptv-table"><thead><tr><th>Categoria</th><th>Faturado</th><th>%</th></tr></thead><tbody>';
        rows.slice(0, limit).forEach(function(r) {
            var pct = total > 0 ? r.valor / total * 100 : 0;
            html += '<tr><td>' + escHtml(r.name.substring(0, 30)) + '</td>';
            html += '<td>' + fmtBRL(r.valor) + '</td>';
            html += '<td>' + fmtPct(pct) + '</td></tr>';
        });
        if (rows.length > limit) html += '<tr><td colspan="3" style="text-align:center;color:var(--text-tertiary);font-size:9px">+ ' + (rows.length - limit) + ' categorias</td></tr>';
        html += '</tbody></table>';
        return html;
    };

    // --- UF Table ---
    PTV.renderUFTable = function(data, limit) {
        limit = limit || 8;
        var movYTD = data.mov.filter(function(m) { return isYTD(m.id_tempo, data.year, data.month); });

        var ufs = {};
        movYTD.forEach(function(m) {
            var uf = m.uf || '??';
            if (!ufs[uf]) ufs[uf] = { uf: uf, valor: 0, clientes: new Set() };
            ufs[uf].valor += m._valor || 0;
            if (m.nome_cliente) ufs[uf].clientes.add(m.nome_cliente);
        });

        var rows = Object.values(ufs).sort(function(a, b) { return b.valor - a.valor; });
        var total = rows.reduce(function(s, r) { return s + r.valor; }, 0);

        var html = '<table class="ptv-table"><thead><tr><th>UF</th><th>Faturamento</th><th>Clientes</th><th>%</th></tr></thead><tbody>';
        rows.slice(0, limit).forEach(function(r) {
            html += '<tr><td>' + escHtml(r.uf) + '</td>';
            html += '<td>' + fmtBRLFull(r.valor) + '</td>';
            html += '<td>' + r.clientes.size + '</td>';
            html += '<td>' + fmtPct(total > 0 ? r.valor / total * 100 : 0) + '</td></tr>';
        });
        if (rows.length > limit) html += '<tr><td colspan="4" style="text-align:center;color:var(--text-tertiary);font-size:9px">+ ' + (rows.length - limit) + ' UFs</td></tr>';
        html += '</tbody></table>';
        return html;
    };

    // --- Carteira ---
    PTV.renderCarteira = function(data, limit) {
        limit = limit || 8;
        if (!data.carteira || data.carteira.length === 0) return '<div style="padding:12px;color:var(--text-tertiary);font-size:10px;text-align:center">Sem pedidos na carteira</div>';

        var byC = {};
        data.carteira.forEach(function(c) {
            var n = c.consultor_nome || c.representante || c.profissional || 'Sem Consultor';
            if (!byC[n]) byC[n] = { name: n, pedidos: 0, valor: 0 };
            byC[n].pedidos++;
            byC[n].valor += parseFloat(c._saldo_aberto) || 0;
        });

        var rows = Object.values(byC).sort(function(a, b) { return b.valor - a.valor; });
        var total = rows.reduce(function(s, r) { return s + r.valor; }, 0);

        var html = '<table class="ptv-table"><thead><tr><th>Consultor</th><th>Pedidos</th><th>Valor</th><th>%</th></tr></thead><tbody>';
        rows.slice(0, limit).forEach(function(r) {
            html += '<tr><td>' + escHtml(r.name) + '</td>';
            html += '<td>' + r.pedidos + '</td>';
            html += '<td>' + fmtBRLFull(r.valor) + '</td>';
            html += '<td>' + fmtPct(total > 0 ? r.valor / total * 100 : 0) + '</td></tr>';
        });
        html += '<tr class="total-row"><td>TOTAL</td><td>' + data.carteira.length + '</td><td>' + fmtBRLFull(total) + '</td><td>100%</td></tr>';
        html += '</tbody></table>';
        return html;
    };

    // --- Vertical Performance (executivo only) ---
    PTV.renderVerticalPerformance = function(data) {
        var year = data.year, month = data.month, currentPeriod = data.currentPeriod;
        var verticals = ['AGRO', 'AGUA', 'CORPORATIVO', 'FLORESTAS'];

        var html = '<table class="ptv-table"><thead><tr><th>Vertical</th><th>Mes</th><th>Meta</th><th>%</th><th>YTD</th><th>Meta YTD</th><th>%</th></tr></thead><tbody>';

        verticals.forEach(function(v) {
            var movM = data.mov.filter(function(m) { return isCurrentMonth(m.id_tempo, year, month) && (m.vertical || '').toUpperCase() === v; });
            var movY = data.mov.filter(function(m) { return isYTD(m.id_tempo, year, month) && (m.vertical || '').toUpperCase() === v; });
            var planM = data.plan.filter(function(p) { return p.id_tempo === currentPeriod && (p.vertical || '').toUpperCase() === v; });
            var planY = data.plan.filter(function(p) { return isYTD(p.id_tempo, year, month) && (p.vertical || '').toUpperCase() === v; });

            var rM = sumVal(movM), mM = sum(planM, 'valor');
            var rY = sumVal(movY), mY = sum(planY, 'valor');
            // Add locacao for AGUA vertical
            if (v === 'AGUA' && data.locacao) {
                data.locacao.forEach(function(r) {
                    var lv = parseFloat(r.vlr_liquido) || 0;
                    if (isCurrentMonth(r.id_tempo, year, month)) rM += lv;
                    if (isYTD(r.id_tempo, year, month)) rY += lv;
                });
            }
            var aM = mM > 0 ? rM / mM * 100 : 0;
            var aY = mY > 0 ? rY / mY * 100 : 0;
            var vc = verticalClass(v);

            html += '<tr><td><span class="ptv-badge ' + vc + '">' + v + '</span></td>';
            html += '<td>' + fmtBRL(rM) + '</td><td style="color:var(--text-tertiary)">' + fmtBRL(mM) + '</td>';
            html += '<td class="' + pctClass(aM) + '">' + fmtPct(aM) + '</td>';
            html += '<td>' + fmtBRL(rY) + '</td><td style="color:var(--text-tertiary)">' + fmtBRL(mY) + '</td>';
            html += '<td class="' + pctClass(aY) + '">' + fmtPct(aY) + '</td></tr>';
        });

        html += '</tbody></table>';
        return html;
    };

    // --- Full Panel Render (Bloomberg Grid Layout) ---
    // --- Pulsing Map (Brazil UF) ---
    var UF_COORDS = {
        'AC':[-9.97,-67.81],'AL':[-9.57,-36.78],'AM':[-3.12,-60.02],'AP':[0.03,-51.05],
        'BA':[-12.97,-38.51],'CE':[-3.72,-38.52],'DF':[-15.79,-47.88],'ES':[-20.32,-40.34],
        'GO':[-16.68,-49.26],'MA':[-2.53,-44.28],'MG':[-19.92,-43.94],'MS':[-20.44,-54.65],
        'MT':[-15.60,-56.10],'PA':[-1.46,-48.50],'PB':[-7.12,-34.86],'PE':[-8.05,-34.87],
        'PI':[-5.09,-42.80],'PR':[-25.43,-49.27],'RJ':[-22.91,-43.17],'RN':[-5.79,-35.21],
        'RO':[-8.76,-63.90],'RR':[2.82,-60.67],'RS':[-30.03,-51.23],'SC':[-27.59,-48.55],
        'SE':[-10.91,-37.07],'SP':[-23.55,-46.64],'TO':[-10.18,-48.33]
    };

    PTV.renderMap = function(data) {
        var movYTD = data.mov.filter(function(m) { return isYTD(m.id_tempo, data.year, data.month); });
        var ufData = {};
        movYTD.forEach(function(m) {
            var uf = (m.uf || '').toUpperCase().trim();
            if (!uf || uf.length !== 2 || !UF_COORDS[uf]) return;
            if (!ufData[uf]) ufData[uf] = { valor: 0, clientes: new Set(), nfs: 0 };
            ufData[uf].valor += m._valor || 0;
            if (m.nome_cliente) ufData[uf].clientes.add(m.nome_cliente);
            ufData[uf].nfs++;
        });

        var mapId = 'ptv-map-' + Date.now();
        var html = '<div id="' + mapId + '" class="ptv-map-container"></div>';

        // Lazy-load Leaflet then init map
        function ensureLeaflet(cb) {
            if (typeof L !== 'undefined') return cb();
            var css = document.createElement('link');
            css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(css);
            var s = document.createElement('script');
            s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            s.onload = cb; document.head.appendChild(s);
        }
        setTimeout(function() {
            var el = document.getElementById(mapId);
            if (!el) return;
            ensureLeaflet(function() {

            var map = L.map(el, {
                center: [-14.5, -51.0],
                zoom: 4,
                zoomControl: false,
                attributionControl: false,
                dragging: true,
                scrollWheelZoom: true,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                touchZoom: true
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd', maxZoom: 8, minZoom: 3
            }).addTo(map);

            // Find max value for scaling
            var maxVal = 0;
            Object.keys(ufData).forEach(function(uf) { if (ufData[uf].valor > maxVal) maxVal = ufData[uf].valor; });

            Object.keys(ufData).forEach(function(uf) {
                var d = ufData[uf];
                var coords = UF_COORDS[uf];
                if (!coords) return;
                var ratio = maxVal > 0 ? d.valor / maxVal : 0;
                var size = Math.max(10, Math.round(8 + ratio * 28));
                var color = ratio >= 0.5 ? '#00D4AA' : ratio >= 0.2 ? '#3498db' : '#6B7FA6';
                var opacity = 0.4 + ratio * 0.5;

                var icon = L.divIcon({
                    className: '',
                    iconSize: [size, size],
                    iconAnchor: [size/2, size/2],
                    html: '<div class="ptv-pulse-dot" style="width:' + size + 'px;height:' + size + 'px;background:' + color + ';opacity:' + opacity + ';--pulse-color:' + color + ';box-shadow:0 0 ' + (size/2) + 'px ' + color + '"></div>'
                });

                L.marker(coords, { icon: icon }).addTo(map).bindTooltip(
                    '<div style="font-family:var(--font-mono);font-size:10px"><strong>' + uf + '</strong><br>' +
                    fmtBRL(d.valor) + '<br>' +
                    '<span style="opacity:0.7">' + d.clientes.size + ' clientes &middot; ' + d.nfs + ' NFs</span></div>',
                    { direction: 'top', offset: [0, -size/2], className: 'ptv-map-tooltip' }
                );
            });

            // Add legend
            var legend = L.control({ position: 'bottomright' });
            legend.onAdd = function() {
                var div = L.DomUtil.create('div', 'ptv-map-legend');
                div.innerHTML = '<div style="font-weight:700;margin-bottom:3px;color:var(--text-secondary)">FATURAMENTO YTD</div>' +
                    '<div class="ptv-map-legend-item"><div class="ptv-map-legend-dot" style="background:#00D4AA"></div><span>Alto</span></div>' +
                    '<div class="ptv-map-legend-item"><div class="ptv-map-legend-dot" style="background:#3498db"></div><span>Medio</span></div>' +
                    '<div class="ptv-map-legend-item"><div class="ptv-map-legend-dot" style="background:#6B7FA6"></div><span>Baixo</span></div>';
                return div;
            };
            legend.addTo(map);

            // Fix map size after render
            setTimeout(function() { map.invalidateSize(); }, 200);
            });
        }, 300);

        return html;
    };

    PTV.renderFullPanel = function(data, title, subtitle, accentColor) {
        var now = new Date();
        var kpis = PTV.computeKPIs(data);
        kpis.year = data.year;

        var html = '';

        // Header with logo
        html += '<div class="ptv-header">';
        html += '<div class="ptv-header-left" style="display:flex;align-items:center;gap:12px">';
        html += '<img src="img/logo-araunah.png" alt="Araunah" style="height:28px;filter:brightness(0) invert(1);opacity:0.9" />';
        html += '<div><h2 style="color:' + (accentColor || '#00D4AA') + '">' + title + '</h2>';
        html += '<p>' + subtitle + '</p></div></div>';
        html += '<div class="ptv-header-right">';
        html += '<div style="text-align:right"><div class="ptv-clock">' + now.toLocaleTimeString('pt-BR') + '</div>';
        html += '<div class="ptv-clock-date">' + now.toLocaleDateString('pt-BR', {weekday:'short',day:'numeric',month:'short',year:'numeric'}) + '</div></div>';
        html += '</div></div>';

        // KPI Strip
        html += PTV.renderKPIs(kpis);

        // Faturamento Diario (full width)
        html += block('Faturamento Diario — ' + MONTHS[parseInt(data.month) - 1] + '/' + data.year, PTV.renderDailyChart(data), { full: true });

        // Grid: 2 columns
        html += '<div class="ptv-grid">';

        // Left: Ranking Consultores
        html += block('Ranking Consultores', PTV.renderConsultantTable(data, 10));

        // Right: Transacoes Recentes
        html += block('Ultimas Transacoes', PTV.renderRecentTransactions(data, 10));

        // Visao Mensal (full width)
        html += block('Visao Mensal — ' + data.year, PTV.renderMonthlyTable(data), { full: true });

        // Vertical Performance (executivo only)
        if (!data._verticalFilter) {
            html += block('Performance por Vertical', PTV.renderVerticalPerformance(data));
        }

        // Carteira
        html += block('Carteira de Pedidos', PTV.renderCarteira(data, 8));

        // Clientes 80/20
        html += block('Clientes 80/20 — YTD', PTV.renderClient8020(data, 10));

        // Produtos 80/20
        html += block('Produtos — YTD', PTV.renderProduct8020(data, 10));

        // UF
        html += block('Faturamento por UF', PTV.renderUFTable(data, 8));

        // Map (full width, footer)
        html += block('Mapa de Faturamento — Brasil', PTV.renderMap(data), { full: true, noScroll: true });

        html += '</div>'; // end grid

        return html;
    };

})();
