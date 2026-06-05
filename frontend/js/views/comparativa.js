App.registerView('comparativa', async () => {
    // Cargar datos
    let todasLasSemanas = [];
    let semanaActual = null, comparativaSemana = null, comparativaDia = null, alerta = null;
    const hoy = new Date().toISOString().split('T')[0];
    
    let semanaSeleccionada = window.comparativaSemanaSeleccionada || null;
    let fechaSeleccionada = window.comparativaFechaSeleccionada || hoy;
    let vistaActiva = 'semana'; // 'semana' o 'dia'
    
    let planificacionItems = [];
    
    window.cambiarSemanaComparativa = async (codigoAass) => {
        const encontrada = todasLasSemanas.find(s => s.codigoAass === codigoAass);
        if (!encontrada) return;
        
        window.comparativaSemanaSeleccionada = encontrada;
        window.comparativaFechaSeleccionada = encontrada.fechaInicio ? encontrada.fechaInicio.split('T')[0] : hoy;
        App.navigate('comparativa');
    };
    
    try {
        [semanaActual, todasLasSemanas] = await Promise.all([
            api.getSemanaActual().catch(() => null),
            api.getSemanasDisponibles().catch(() => [])
        ]);
        
        if (!semanaSeleccionada) {
            semanaSeleccionada = semanaActual;
            window.comparativaSemanaSeleccionada = semanaSeleccionada;
        }
        
        if (semanaSeleccionada) {
            [comparativaSemana, comparativaDia, alerta, planificacionItems] = await Promise.all([
                api.getComparativaSemana(semanaSeleccionada.codigoAass).catch(() => null),
                api.getComparativaDia(fechaSeleccionada).catch(() => null),
                api.getAlertaHoras(semanaSeleccionada.codigoAass).catch(() => null),
                api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => [])
            ]);
        }
    } catch (e) {
        console.log('Error cargando comparativa:', e);
    }
    
    // Función para cambiar entre vistas
    window.cambiarVistaComparativa = (vista) => {
        vistaActiva = vista;
        document.getElementById('vista-semana').style.display = vista === 'semana' ? 'block' : 'none';
        document.getElementById('vista-dia').style.display = vista === 'dia' ? 'block' : 'none';
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-btn[data-vista="${vista}"]`).classList.add('active');
    };
    
    // Función para cambiar día en vista detallada
    window.cambiarDiaComparativa = async (fecha) => {
        fechaSeleccionada = fecha;
        try {
            comparativaDia = await api.getComparativaDia(fecha);
            const contenedor = document.getElementById('comparativa-dia-contenido');
            if (contenedor) {
                contenedor.innerHTML = renderComparativaDiaDetalle(comparativaDia);
            }
            const gridSelector = document.getElementById('comparativa-grid-dias-selector');
            if (gridSelector) {
                gridSelector.innerHTML = renderVistaSemana();
            }
        } catch (e) {
            showNotification('Error cargando datos del día', 'error');
        }
    };
    
    // Función para determinar color de variación
    const getVariacionColor = (porcentaje) => {
        if (porcentaje >= 100) return '#10B981'; // Verde - completo o más
        if (porcentaje >= 80) return '#F59E0B'; // Amarillo - casi completo
        if (porcentaje >= 50) return '#3B82F6'; // Azul - en progreso
        return '#94A3B8'; // Gris - bajo
    };
    
    // Renderizar alerta si existe
    const renderAlerta = () => {
        if (!alerta || !alerta.alertaActiva) return '';
        
        const esWarning = alerta.nivel === 'warning';
        const esDanger = alerta.nivel === 'danger';
        
        return `
            <div class="alerta-banner ${alerta.nivel}">
                <div class="alerta-icono">
                    <i class="fa-solid ${esDanger ? 'fa-exclamation-triangle' : 'fa-exclamation-circle'}"></i>
                </div>
                <div class="alerta-contenido">
                    <span class="alerta-titulo">${esDanger ? 'CRÍTICO' : 'ATENCIÓN'}</span>
                    <span class="alerta-mensaje">${alerta.mensaje}</span>
                </div>
                <div class="alerta-stats">
                    <div class="alerta-stat">
                        <span class="label">Ejecutadas</span>
                        <span class="value">${alerta.horasEjecutadas?.toFixed(1) || 0}h</span>
                    </div>
                    <div class="alerta-stat">
                        <span class="label">Restantes</span>
                        <span class="value">${alerta.horasRestantes?.toFixed(1) || 0}h</span>
                    </div>
                </div>
            </div>
        `;
    };
    
    // Renderizar vista de semana (cuadrícula de los 7 días como selector interactivo)
    const renderVistaSemana = () => {
        if (!comparativaSemana || !comparativaSemana.diasSemana) {
            return '<p style="color:var(--text-muted); text-align:center; padding:2rem;">Sin datos disponibles</p>';
        }
        
        return `
            <div class="comparativa-semana-grid">
                ${comparativaSemana.diasSemana.map(dia => {
                    const porcentaje = dia.porcentajeAvance || 0;
                    const color = getVariacionColor(porcentaje);
                    const esHoy = dia.fecha === hoy;
                    const esPasado = dia.fecha < hoy;
                    const esSeleccionado = dia.fecha === fechaSeleccionada;
                    
                    return `
                        <div class="dia-card ${esHoy ? 'hoy' : ''} ${esPasado ? 'pasado' : ''} ${esSeleccionado ? 'active' : ''}" 
                             onclick="cambiarDiaComparativa('${dia.fecha}')"
                             style="${esSeleccionado ? 'border: 2px solid var(--secondary); box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);' : ''}">
                            <div class="dia-header">
                                <span class="dia-nombre">${dia.diaSemana}</span>
                                <span class="dia-fecha">${parseInt(dia.fecha.split('-')[2])}</span>
                            </div>
                            
                            <div class="dia-progress">
                                <div class="progress-ring" style="--progress: ${Math.min(100, porcentaje)}%; --color: ${color};">
                                    <span class="progress-value">${porcentaje.toFixed(0)}%</span>
                                </div>
                            </div>
                            
                            <div class="dia-stats">
                                <div class="stat-row">
                                    <span class="label"><i class="fa-solid fa-calendar-check"></i> Plan</span>
                                    <span class="value">${(dia.horasPlanificadas || 0).toFixed(1)}h</span>
                                </div>
                                <div class="stat-row">
                                    <span class="label"><i class="fa-solid fa-hammer"></i> Ejec</span>
                                    <span class="value">${(dia.horasEjecutadas || 0).toFixed(1)}h</span>
                                </div>
                                <div class="stat-row diferencia ${dia.diferencia > 0 ? 'pendiente' : 'completo'}">
                                    <span class="label"><i class="fa-solid ${dia.diferencia > 0 ? 'fa-clock' : 'fa-check'}"></i> Dif</span>
                                    <span class="value">${dia.diferencia > 0 ? '+' : ''}${(dia.diferencia || 0).toFixed(1)}h</span>
                                </div>
                            </div>
                            
                            ${esHoy ? '<span class="badge-hoy-card">HOY</span>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };
    
    // Renderizar detalle de día
    const renderComparativaDiaDetalle = (data) => {
        if (!data || !data.items || data.items.length === 0) {
            return `
                <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <p>No hay actividades planificadas para este día</p>
                </div>
            `;
        }
        
        return `
            <div class="comparativa-dia-table">
                <table>
                    <thead>
                        <tr>
                            <th>Actividad</th>
                            <th>Bloque</th>
                            <th style="text-align:right;">Plan</th>
                            <th style="text-align:right;">Ejec</th>
                            <th style="text-align:right;">Dif</th>
                            <th style="text-align:center;">Avance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(item => {
                            const porcentaje = item.porcentajeAvance || 0;
                            const color = getVariacionColor(porcentaje);
                            
                            return `
                                <tr>
                                    <td><strong>${item.actividad}</strong></td>
                                    <td>${item.bloque || '-'}</td>
                                    <td style="text-align:right;">${(item.horasPlanificadas || 0).toFixed(1)}h</td>
                                    <td style="text-align:right;">${(item.horasEjecutadas || 0).toFixed(1)}h</td>
                                    <td style="text-align:right;">
                                        <span class="badge-diferencia ${item.diferencia > 0 ? 'pendiente' : 'completo'}">
                                            ${item.diferencia > 0 ? '+' : ''}${(item.diferencia || 0).toFixed(1)}h
                                        </span>
                                    </td>
                                    <td style="text-align:center;">
                                        <div class="mini-progress" style="--progress: ${Math.min(100, porcentaje)}%; --color: ${color};">
                                            <span>${porcentaje.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="2"><strong>TOTAL</strong></td>
                            <td style="text-align:right;"><strong>${(data.totalPlanificado || 0).toFixed(1)}h</strong></td>
                            <td style="text-align:right;"><strong>${(data.totalEjecutado || 0).toFixed(1)}h</strong></td>
                            <td style="text-align:right;">
                                <span class="badge-diferencia ${data.diferencia > 0 ? 'pendiente' : 'completo'}">
                                    ${data.diferencia > 0 ? '+' : ''}${(data.diferencia || 0).toFixed(1)}h
                                </span>
                            </td>
                            <td style="text-align:center;">
                                <strong style="color: ${getVariacionColor(data.porcentajeAvance || 0)};">
                                    ${(data.porcentajeAvance || 0).toFixed(0)}%
                                </strong>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    };
    
    // Renderizar selector de días para vista detallada (obsoleto, reemplazado por la cuadrícula interactiva)
    const renderSelectorDias = () => {
        return '';
    };
    
    // Renderizar resumen de la semana
    const renderResumenSemana = () => {
        if (!comparativaSemana) return '';
        
        const porcentaje = comparativaSemana.porcentajeAvanceSemana || 0;
        const color = getVariacionColor(porcentaje);
        
        return `
            <div class="resumen-semana-card">
                <div class="resumen-progress">
                    <div class="big-progress-ring" style="--progress: ${Math.min(100, porcentaje)}%; --color: ${color};">
                        <div class="progress-inner">
                            <span class="progress-value">${porcentaje.toFixed(0)}%</span>
                            <span class="progress-label">Avance</span>
                        </div>
                    </div>
                </div>
                <div class="resumen-stats">
                    <div class="resumen-stat">
                        <i class="fa-solid fa-calendar-check" style="color:var(--secondary);"></i>
                        <div>
                            <span class="label">Planificadas</span>
                            <span class="value">${(comparativaSemana.totalHorasPlanificadasSemana || 0).toFixed(1)}h</span>
                        </div>
                    </div>
                    <div class="resumen-stat">
                        <i class="fa-solid fa-hammer" style="color:var(--primary);"></i>
                        <div>
                            <span class="label">Ejecutadas</span>
                            <span class="value">${(comparativaSemana.totalHorasEjecutadasSemana || 0).toFixed(1)}h</span>
                        </div>
                    </div>
                    <div class="resumen-stat">
                        <i class="fa-solid fa-hourglass-half" style="color:var(--accent);"></i>
                        <div>
                            <span class="label">Restantes</span>
                            <span class="value">${((comparativaSemana.totalHorasPlanificadasSemana || 0) - (comparativaSemana.totalHorasEjecutadasSemana || 0)).toFixed(1)}h</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const renderDesgloseCumplimiento = () => {
        if (!planificacionItems || planificacionItems.length === 0) {
            return '<p style="color:var(--text-muted); text-align:center; padding:1.5rem;">Sin planificaciones para esta semana</p>';
        }

        // Agrupar por Actividad Madre (laborMadre)
        const porGrupo = {};
        planificacionItems.forEach(p => {
            const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'GENERAL').toUpperCase();
            const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
            if (!porGrupo[grupo]) porGrupo[grupo] = [];
            porGrupo[grupo].push(p);
        });

        const gruposOrdenados = Object.keys(porGrupo).sort();

        return gruposOrdenados.map(grupo => {
            const items = porGrupo[grupo];
            
            // Ordenar items por cultivo y luego actividad
            items.sort((a, b) => {
                const cultA = (a.actividad?.producto?.nombre || '').toUpperCase();
                const cultB = (b.actividad?.producto?.nombre || '').toUpperCase();
                if (cultA !== cultB) return cultA.localeCompare(cultB);
                return (a.actividad?.nombre || '').localeCompare(b.actividad?.nombre || '');
            });

            // Totales de grupo
            const totUPlan = items.reduce((s, p) => s + (p.unidadesPlanificadas || 0), 0);
            const totUReal = items.reduce((s, p) => s + (p.unidadesEjecutadas || 0), 0);
            const pctUCumpl = totUPlan > 0 ? (totUReal / totUPlan) * 100 : 0;
            
            const totHPlan = items.reduce((s, p) => s + (p.horasAjustadas || p.horasCalculadas || 0), 0);
            const totHReal = items.reduce((s, p) => s + (p.horasEjecutadas || 0), 0);
            const difHoras = totHPlan - totHReal;

            return `
                <div style="margin-bottom:1.5rem; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden;">
                    <!-- Cabecera Actividad Madre -->
                    <div style="padding:0.8rem 1.2rem; background:rgba(59,130,246,0.06); display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:0.5rem;">
                        <h4 style="color:var(--primary); text-transform:uppercase; font-size:0.95rem; font-weight:800; margin:0; letter-spacing:0.5px;">
                            ${grupo}
                        </h4>
                        <div style="display:flex; gap:1rem; font-size:0.8rem;">
                            <span style="color:var(--text-muted);">
                                Cumplimiento Físico: 
                                <strong style="color:${pctUCumpl >= 100 ? '#10B981' : pctUCumpl >= 80 ? '#F59E0B' : '#94A3B8'};">
                                    ${pctUCumpl.toFixed(0)}%
                                </strong>
                            </span>
                            <span style="color:var(--text-muted); border-left:1px solid rgba(255,255,255,0.15); padding-left:1rem;">
                                Horas Ganadas: 
                                <strong style="color:${difHoras >= 0 ? '#10B981' : '#EF4444'};">
                                    ${difHoras >= 0 ? '+' : ''}${difHoras.toFixed(1)}h
                                </strong>
                            </span>
                        </div>
                    </div>

                    <!-- Tabla de items -->
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left;">
                            <thead style="background:rgba(0,0,0,0.2); color:var(--text-muted); text-transform:uppercase; font-size:0.65rem; letter-spacing:0.5px;">
                                <tr>
                                    <th style="padding:0.75rem 1rem;">Actividad / Variedad</th>
                                    <th style="padding:0.75rem; text-align:center;">Bloque</th>
                                    <th style="padding:0.75rem; text-align:right;">U. Planificadas</th>
                                    <th style="padding:0.75rem; text-align:right;">U. Ejecutadas</th>
                                    <th style="padding:0.75rem; text-align:center;">% Cumpl.</th>
                                    <th style="padding:0.75rem; text-align:right;">Horas Plan</th>
                                    <th style="padding:0.75rem; text-align:right;">Horas Real</th>
                                    <th style="padding:0.75rem; text-align:center;">Tiempo Ganado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(p => {
                                    const uPlan = p.unidadesPlanificadas || 0;
                                    const uReal = p.unidadesEjecutadas || 0;
                                    const pct = uPlan > 0 ? (uReal / uPlan) * 100 : 0;
                                    const colorPct = pct >= 100 ? '#10B981' : pct >= 80 ? '#F59E0B' : pct >= 50 ? '#3B82F6' : '#94A3B8';
                                    
                                    const hPlan = p.horasAjustadas || p.horasCalculadas || 0;
                                    const hReal = p.horasEjecutadas || 0;
                                    const hDiff = hPlan - hReal;

                                    const actNombre = p.actividad?.nombre || 'GENERAL';
                                    const cultivo = p.actividad?.producto?.nombre || 'GENERAL';
                                    
                                    return `
                                        <tr style="border-top:1px solid rgba(255,255,255,0.03); transition:background 0.2s;">
                                            <td style="padding:0.7rem 1rem; color:white;">
                                                <strong>${actNombre}</strong><br>
                                                <small style="color:var(--text-muted); font-size:0.75rem;">${cultivo}</small>
                                            </td>
                                            <td style="padding:0.7rem; text-align:center; color:white;">${p.bloque || p.valvulas || '-'}</td>
                                            <td style="padding:0.7rem; text-align:right;">${uPlan.toLocaleString()}</td>
                                            <td style="padding:0.7rem; text-align:right; font-weight:600; color:${uReal > 0 ? 'white' : 'var(--text-muted)'};">${uReal.toLocaleString()}</td>
                                            <td style="padding:0.7rem; text-align:center;">
                                                <span class="badge" style="background:rgba(${uPlan > 0 ? (pct >= 100 ? '16,185,129' : pct >= 80 ? '245,158,11' : '59,130,246') : '148,163,184'}, 0.15); color:${uPlan > 0 ? colorPct : '#94A3B8'}; font-weight:bold; border:1px solid rgba(${uPlan > 0 ? (pct >= 100 ? '16,185,129' : pct >= 80 ? '245,158,11' : '59,130,246') : '148,163,184'}, 0.3);">
                                                    ${uPlan > 0 ? `${pct.toFixed(0)}%` : '--'}
                                                </span>
                                            </td>
                                            <td style="padding:0.7rem; text-align:right;">${hPlan.toFixed(1)}h</td>
                                            <td style="padding:0.7rem; text-align:right;">${hReal.toFixed(1)}h</td>
                                            <td style="padding:0.7rem; text-align:center;">
                                                ${hReal > 0 ? `
                                                    <span class="badge" style="background:${hDiff >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color:${hDiff >= 0 ? '#A7F3D0' : '#FCA5A5'}; border:1px solid ${hDiff >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; font-size:0.75rem;">
                                                        ${hDiff >= 0 ? `+${hDiff.toFixed(1)}h ganados` : `${hDiff.toFixed(1)}h desviación`}
                                                    </span>
                                                ` : `<span style="color:var(--text-muted); font-size:0.75rem;">Sin ejecutar</span>`}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                            <tfoot style="background:rgba(0,0,0,0.3); border-top:1px solid rgba(255,255,255,0.08); font-weight:bold;">
                                <tr>
                                    <td colspan="2" style="padding:0.75rem 1rem;">TOTAL ${grupo}</td>
                                    <td style="padding:0.75rem; text-align:right;">${totUPlan.toLocaleString()}</td>
                                    <td style="padding:0.75rem; text-align:right;">${totUReal.toLocaleString()}</td>
                                    <td style="padding:0.75rem; text-align:center;">
                                        <span style="color:${pctUCumpl >= 100 ? '#10B981' : pctUCumpl >= 80 ? '#F59E0B' : '#94A3B8'}; font-weight:bold;">
                                            ${totUPlan > 0 ? `${pctUCumpl.toFixed(0)}%` : '--'}
                                        </span>
                                    </td>
                                    <td style="padding:0.75rem; text-align:right;">${totHPlan.toFixed(1)}h</td>
                                    <td style="padding:0.75rem; text-align:right;">${totHReal.toFixed(1)}h</td>
                                    <td style="padding:0.75rem; text-align:center;">
                                        <span class="badge" style="background:${difHoras >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color:${difHoras >= 0 ? '#10B981' : '#EF4444'}; font-weight:bold; font-size:0.85rem;">
                                            ${difHoras >= 0 ? `+${difHoras.toFixed(1)}h ganados` : `${difHoras.toFixed(1)}h desviación`}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    };
    
    return `
        <div class="fade-in comparativa-view">
            <!-- Alerta de horas -->
            ${renderAlerta()}
            
            <!-- Header -->
            <div class="card comparativa-header">
                <div class="header-content" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <h3><i class="fa-solid fa-chart-bar" style="color:var(--primary); margin-right:0.5rem;"></i> Comparativa Plan vs Ejecución</h3>
                        <p class="subtitle">Seguimiento de avance de horas planificadas</p>
                    </div>
                    
                    <!-- SELECTOR DE SEMANA -->
                    <div style="display:flex; align-items:center; gap:0.5rem; background:rgba(255,255,255,0.05); padding:0.5rem 1rem; border-radius:10px; border:1px solid var(--surface-glass-border);">
                        <label for="comp-semana-select" style="font-size:0.85rem; color:var(--text-muted); font-weight:600; white-space:nowrap;"><i class="fa-solid fa-filter"></i> Semana:</label>
                        <select id="comp-semana-select" onchange="cambiarSemanaComparativa(this.value)" style="padding:0.4rem; border-radius:6px; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white; font-weight:700; width:150px;">
                            ${todasLasSemanas.map(s => {
                                const isSel = semanaSeleccionada && s.codigoAass === semanaSeleccionada.codigoAass ? 'selected' : '';
                                return `<option value="${s.codigoAass}" ${isSel}>Semana ${s.codigoAass}</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>
                
                <!-- Tabs -->
                <div class="tabs-container">
                    <button class="tab-btn active" data-vista="semana" onclick="cambiarVistaComparativa('semana')">
                        <i class="fa-solid fa-calendar-week"></i> Vista Semanal
                    </button>
                    <button class="tab-btn" data-vista="dia" onclick="cambiarVistaComparativa('dia')">
                        <i class="fa-solid fa-calendar-day"></i> Vista Diaria
                    </button>
                </div>
            </div>
            
            <!-- Resumen de la semana -->
            ${renderResumenSemana()}
            
            <!-- Vista Semanal -->
            <div id="vista-semana" style="display:block;">
                <div class="card">
                    <h4 style="margin-bottom:1rem;"><i class="fa-solid fa-chart-line" style="color:var(--primary); margin-right:0.5rem;"></i> Cumplimiento Físico y de Rendimiento por Actividad Madre</h4>
                    ${renderDesgloseCumplimiento()}
                </div>
            </div>
            
            <!-- Vista Diaria (oculta por defecto) -->
            <div id="vista-dia" style="display:none;">
                <div class="card">
                    <h4 style="margin-bottom:1rem;"><i class="fa-solid fa-table-cells" style="color:var(--secondary); margin-right:0.5rem;"></i> Selector de Día</h4>
                    <div id="comparativa-grid-dias-selector">
                        ${renderVistaSemana()}
                    </div>
                </div>
                
                <div class="card" style="margin-top:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h4><i class="fa-solid fa-list-check" style="color:var(--secondary); margin-right:0.5rem;"></i> Detalle del Día</h4>
                    </div>
                    <div id="comparativa-dia-contenido">
                        ${renderComparativaDiaDetalle(comparativaDia)}
                    </div>
                </div>
            </div>
        </div>
    `;
});
