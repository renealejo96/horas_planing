App.registerView('dashboard', async () => {
    // Cargar datos del dashboard
    let dashboard = { totalTrabajadores: 0, totalAreas: 0, totalActividades: 0, totalProductos: 0, personalPorArea: [] };
    let todasLasSemanas = [];
    let semanaActual = null, semanaSiguiente = null, planificacion = [], ejecuciones = [];
    let planificacionProxima = [];
    
    let semanaSeleccionada = window.dashboardSemanaSeleccionada || null;
    
    window.cambiarSemanaDashboard = (codigoAass) => {
        const encontrada = todasLasSemanas.find(s => s.codigoAass === codigoAass);
        if (!encontrada) return;
        window.dashboardSemanaSeleccionada = encontrada;
        App.navigate('dashboard');
    };
    
    // Función para renderizar la gráfica SVG
    const renderGraficaSemanas = (datos) => {
        if (!datos || datos.length === 0) {
            return '<p style="color:var(--text-muted); text-align:center; padding:2rem;">Sin datos para mostrar la gráfica</p>';
        }
        
        const width = 800;
        const height = 280;
        const xMarginLeft = 60;
        const xMarginRight = 150;
        const yMarginTop = 30;
        const yMarginBottom = 50;
        
        const plotWidth = width - xMarginLeft - xMarginRight;
        const plotHeight = height - yMarginTop - yMarginBottom;
        
        // Encontrar máximo valor
        const maxVal = Math.max(...datos.map(d => Math.max(d.planificadas, d.ejecutadas, 10)), 10) * 1.15;
        
        const lineasY = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
        
        const gridHtml = lineasY.map(val => {
            const y = yMarginTop + plotHeight - (val / maxVal) * plotHeight;
            return `
                <line x1="${xMarginLeft}" y1="${y}" x2="${xMarginLeft + plotWidth}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="4 4" />
                <text x="${xMarginLeft - 10}" y="${y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end">${val.toFixed(0)}h</text>
            `;
        }).join('');
        
        const numWeeks = datos.length;
        const groupWidth = plotWidth / numWeeks;
        
        const barsHtml = datos.map((d, i) => {
            const centerX = xMarginLeft + i * groupWidth + groupWidth / 2;
            
            const hPlan = (d.planificadas / maxVal) * plotHeight;
            const yPlan = yMarginTop + plotHeight - hPlan;
            
            const hEjec = (d.ejecutadas / maxVal) * plotHeight;
            const yEjec = yMarginTop + plotHeight - hEjec;
            
            const barWidth = Math.min(22, groupWidth * 0.3);
            
            const margen = d.ejecutadas - d.planificadas;
            const margenColor = margen >= 0 ? '#10B981' : '#EF4444';
            const margenTexto = margen >= 0 ? `+${margen.toFixed(1)}h` : `${margen.toFixed(1)}h`;
            
            return `
                <!-- Barra Planificada (Azul) -->
                <rect x="${centerX - barWidth - 3}" y="${yPlan}" width="${barWidth}" height="${hPlan}" rx="4" fill="url(#blueGrad)" style="transition: all 0.3s;">
                    <title>Semana ${d.semana} - Planificado: ${d.planificadas.toFixed(1)}h</title>
                </rect>
                
                <!-- Barra Ejecutada (Verde) -->
                <rect x="${centerX + 3}" y="${yEjec}" width="${barWidth}" height="${hEjec}" rx="4" fill="url(#greenGrad)" style="transition: all 0.3s;">
                    <title>Semana ${d.semana} - Ejecutado: ${d.ejecutadas.toFixed(1)}h</title>
                </rect>
                
                <!-- Texto encima de barras -->
                <text x="${centerX - barWidth/2 - 3}" y="${yPlan - 6}" fill="#93C5FD" font-size="10" text-anchor="middle" font-weight="600">${d.planificadas > 0 ? d.planificadas.toFixed(0) : ''}</text>
                <text x="${centerX + barWidth/2 + 3}" y="${yEjec - 6}" fill="#A7F3D0" font-size="10" text-anchor="middle" font-weight="600">${d.ejecutadas > 0 ? d.ejecutadas.toFixed(0) : ''}</text>
                
                <!-- Badge de Margen/Diferencia -->
                <g transform="translate(${centerX}, ${yMarginTop + plotHeight + 18})">
                    <rect x="-26" y="-12" width="52" height="18" rx="4" fill="rgba(0,0,0,0.3)" stroke="${margenColor}" stroke-width="1" />
                    <text x="0" y="1" fill="${margenColor}" font-size="10" font-weight="bold" text-anchor="middle">${margenTexto}</text>
                </g>
                
                <!-- Etiqueta Semana X-axis -->
                <text x="${centerX}" y="${height - 12}" fill="var(--text-main)" font-size="11" font-weight="bold" text-anchor="middle">Sem ${d.semana}</text>
            `;
        }).join('');
        
        return `
            <div style="width:100%; overflow-x:auto;">
                <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:transparent; display:block; margin:0 auto;">
                    <defs>
                        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.9"/>
                            <stop offset="100%" stop-color="#1D4ED8" stop-opacity="0.9"/>
                        </linearGradient>
                        <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#10B981" stop-opacity="0.9"/>
                            <stop offset="100%" stop-color="#047857" stop-opacity="0.9"/>
                        </linearGradient>
                    </defs>
                    
                    <!-- Gridlines & Y-axis labels -->
                    ${gridHtml}
                    
                    <!-- X-axis baseline -->
                    <line x1="${xMarginLeft}" y1="${yMarginTop + plotHeight}" x2="${xMarginLeft + plotWidth}" y2="${yMarginTop + plotHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
                    
                    <!-- Bars, margin badges & X-axis labels -->
                    ${barsHtml}
                    
                    <!-- Leyendas a la derecha -->
                    <g transform="translate(${width - xMarginRight + 20}, ${yMarginTop + 10})">
                        <rect x="0" y="0" width="12" height="12" rx="3" fill="url(#blueGrad)" />
                        <text x="20" y="10" fill="var(--text-main)" font-size="12" font-weight="500">Planificado</text>
                        
                        <rect x="0" y="25" width="12" height="12" rx="3" fill="url(#greenGrad)" />
                        <text x="20" y="35" fill="var(--text-main)" font-size="12" font-weight="500">Ejecutado</text>
                        
                        <rect x="0" y="55" width="40" height="18" rx="4" fill="rgba(0,0,0,0.3)" stroke="#10B981" stroke-width="1" />
                        <text x="50" y="68" fill="var(--text-muted)" font-size="11">Margen Pos.</text>
                        
                        <rect x="0" y="80" width="40" height="18" rx="4" fill="rgba(0,0,0,0.3)" stroke="#EF4444" stroke-width="1" />
                        <text x="50" y="93" fill="var(--text-muted)" font-size="11">Desviación</text>
                    </g>
                </svg>
            </div>
        `;
    };
    
    let datosGrafica = [];
    
    try {
        [dashboard, todasLasSemanas, semanaActual, semanaSiguiente] = await Promise.all([
            api.getDashboard(),
            api.getSemanasDisponibles().catch(() => []),
            api.getSemanaActual().catch(() => null),
            api.getSemanaSiguiente().catch(() => null)
        ]);
        
        if (!semanaSeleccionada) {
            semanaSeleccionada = semanaActual;
            window.dashboardSemanaSeleccionada = semanaSeleccionada;
        }
        
        // Si hay semana seleccionada, cargar planificación y ejecuciones de esa semana
        if (semanaSeleccionada) {
            [planificacion, ejecuciones] = await Promise.all([
                api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []),
                api.getEjecucionesSemana(semanaSeleccionada.codigoAass).catch(() => [])
            ]);
        }
        
        // Si hay semana siguiente, cargar su planificación
        if (semanaSiguiente) {
            planificacionProxima = await api.getPlanificacionSemana(semanaSiguiente.codigoAass).catch(() => []);
        }
        
        // Cargar comparativa de las últimas semanas para la gráfica
        const semanasParaGrafica = [...todasLasSemanas]
            .sort((a, b) => a.codigoAass.localeCompare(b.codigoAass))
            .slice(-6); // Las últimas 6 semanas
            
        const comparativas = await Promise.all(
            semanasParaGrafica.map(s => api.getComparativaSemana(s.codigoAass).catch(() => null))
        );
        
        datosGrafica = semanasParaGrafica.map((s, idx) => {
            const comp = comparativas[idx];
            return {
                semana: s.codigoAass,
                planificadas: comp ? (comp.totalHorasPlanificadasSemana || 0) : 0,
                ejecutadas: comp ? (comp.totalHorasEjecutadasSemana || 0) : 0,
                margen: comp ? ((comp.totalHorasEjecutadasSemana || 0) - (comp.totalHorasPlanificadasSemana || 0)) : 0
            };
        });
    } catch (e) {
        console.log('Error cargando dashboard:', e);
    }
    
    // Agrupar horas por labor madre
    const agruparPorLaborMadre = (items) => {
        const grupos = {};
        items.forEach(p => {
            const labor = p.actividad?.laborMadre || 'SIN ASIGNAR';
            if (!grupos[labor]) grupos[labor] = { planificadas: 0, ejecutadas: 0 };
            grupos[labor].planificadas += (p.horasAjustadas || p.horasCalculadas || 0);
        });
        return grupos;
    };
    
    // Acumular ejecuciones por labor madre
    const ejecucionesPorLabor = {};
    ejecuciones.forEach(e => {
        const labor = e.planificacion?.actividad?.laborMadre || 'SIN ASIGNAR';
        if (!ejecucionesPorLabor[labor]) ejecucionesPorLabor[labor] = 0;
        ejecucionesPorLabor[labor] += (e.horasReales || 0);
    });
    
    const gruposActual = agruparPorLaborMadre(planificacion);
    const gruposProxima = agruparPorLaborMadre(planificacionProxima);
    
    // Calcular horas
    const horasPlanificadas = planificacion.reduce((sum, p) => sum + (p.horasAjustadas || p.horasCalculadas || 0), 0);
    const horasEjecutadas = ejecuciones.reduce((sum, e) => sum + (e.horasReales || 0), 0);
    const porcentaje = horasPlanificadas > 0 ? Math.min((horasEjecutadas / horasPlanificadas) * 100, 100) : 0;
    const horasPendientes = Math.max(horasPlanificadas - horasEjecutadas, 0);
    
    // Determinar color del gauge según porcentaje
    const getGaugeColor = (pct) => {
        if (pct < 30) return '#EF4444';  // Rojo
        if (pct < 60) return '#F59E0B';  // Naranja
        if (pct < 90) return '#3B82F6';  // Azul
        return '#10B981';  // Verde
    };
    const gaugeColor = getGaugeColor(porcentaje);
    
    const renderPersonalPorArea = () => {
        if (!dashboard.personalPorArea || dashboard.personalPorArea.length === 0) {
            return '<p style="color:var(--text-muted);">No hay áreas configuradas</p>';
        }
        return dashboard.personalPorArea.map(a => `
            <div style="display:flex; justify-content:space-between; padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:8px;">
                <span><i class="fa-solid fa-users" style="color:var(--primary); margin-right:0.5rem;"></i>${a.area}</span>
                <span class="badge">${a.cantidad} trabajadores</span>
            </div>
        `).join('');
    };
    
    return `
        <div class="fade-in">
            <!-- SELECTOR DE SEMANA -->
            <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; padding:1rem 1.5rem;">
                <div>
                    <h3 style="margin:0;"><i class="fa-solid fa-gauge-high" style="color:var(--primary); margin-right:0.5rem;"></i> Panel de Indicadores</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0.25rem 0 0 0;">Resumen del estado de la finca para la semana seleccionada</p>
                </div>
                
                <div style="display:flex; align-items:center; gap:0.5rem; background:rgba(255,255,255,0.05); padding:0.5rem 1rem; border-radius:10px; border:1px solid var(--surface-glass-border);">
                    <label for="dash-semana-select" style="font-size:0.85rem; color:var(--text-muted); font-weight:600; white-space:nowrap;"><i class="fa-solid fa-filter"></i> Semana:</label>
                    <select id="dash-semana-select" onchange="cambiarSemanaDashboard(this.value)" style="padding:0.4rem; border-radius:6px; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white; font-weight:700; width:150px;">
                        ${todasLasSemanas.map(s => {
                            const isSel = semanaSeleccionada && s.codigoAass === semanaSeleccionada.codigoAass ? 'selected' : '';
                            return `<option value="${s.codigoAass}" ${isSel}>Semana ${s.codigoAass}</option>`;
                        }).join('')}
                    </select>
                </div>
            </div>

            <!-- VELOCÍMETRO DE HORAS - Indicador Principal -->
            <div class="card" style="margin-bottom:1.5rem; background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9)); border: 1px solid rgba(255,255,255,0.1);">
                <div style="display:grid; grid-template-columns: 1fr 300px 1fr; gap:2rem; align-items:center;">
                    
                    <!-- Info Izquierda -->
                    <div style="text-align:center;">
                        <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:0.5rem;">
                            <i class="fa-solid fa-calendar-check"></i> HORAS PLANIFICADAS
                        </div>
                        <div style="font-size:3rem; font-weight:700; color:#3B82F6; text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);">
                            ${horasPlanificadas.toFixed(1)}
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-muted);">horas esta semana</div>
                    </div>
                    
                    <!-- Velocímetro Central -->
                    <div style="position:relative; width:280px; height:180px; margin:0 auto;">
                        <!-- Fondo del gauge -->
                        <svg viewBox="0 0 200 120" style="width:100%; height:100%;">
                            <!-- Arco de fondo -->
                            <path d="M 20 100 A 80 80 0 0 1 180 100" 
                                  fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="20" stroke-linecap="round"/>
                            <!-- Arco de progreso -->
                            <path d="M 20 100 A 80 80 0 0 1 180 100" 
                                  fill="none" stroke="url(#gaugeGradient)" stroke-width="20" stroke-linecap="round"
                                  stroke-dasharray="${porcentaje * 2.51} 251"
                                  style="transition: stroke-dasharray 1s ease-out;"/>
                            <!-- Gradiente -->
                            <defs>
                                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style="stop-color:#EF4444"/>
                                    <stop offset="50%" style="stop-color:#F59E0B"/>
                                    <stop offset="100%" style="stop-color:#10B981"/>
                                </linearGradient>
                            </defs>
                            <!-- Marcadores -->
                            <text x="15" y="115" fill="var(--text-muted)" font-size="10">0%</text>
                            <text x="93" y="25" fill="var(--text-muted)" font-size="10">50%</text>
                            <text x="175" y="115" fill="var(--text-muted)" font-size="10">100%</text>
                        </svg>
                        <!-- Porcentaje central -->
                        <div style="position:absolute; top:60%; left:50%; transform:translate(-50%, -50%); text-align:center;">
                            <div style="font-size:2.5rem; font-weight:800; color:${gaugeColor}; text-shadow: 0 0 30px ${gaugeColor};">
                                ${porcentaje.toFixed(0)}%
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:-5px;">completado</div>
                        </div>
                        <!-- Indicador de aguja -->
                        <div style="position:absolute; bottom:20px; left:50%; width:4px; height:60px; background:linear-gradient(to top, ${gaugeColor}, transparent); transform-origin:bottom center; transform:translateX(-50%) rotate(${(porcentaje * 1.8) - 90}deg); transition: transform 1s ease-out; border-radius:2px; box-shadow: 0 0 10px ${gaugeColor};"></div>
                    </div>
                    
                    <!-- Info Derecha -->
                    <div style="text-align:center;">
                        <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:0.5rem;">
                            <i class="fa-solid fa-clipboard-check"></i> HORAS EJECUTADAS
                        </div>
                        <div style="font-size:3rem; font-weight:700; color:#10B981; text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);">
                            ${horasEjecutadas.toFixed(1)}
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-muted);">horas registradas</div>
                    </div>
                </div>
                
                <!-- Barra de progreso inferior -->
                <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <span style="color:var(--text-muted); font-size:0.85rem;">Progreso Semanal - ${semanaSeleccionada ? semanaSeleccionada.codigoAass : 'Sin semana'}</span>
                        <span style="color:${gaugeColor}; font-weight:600;">${horasPendientes.toFixed(1)} horas pendientes</span>
                    </div>
                    <div style="height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden;">
                        <div style="height:100%; width:${porcentaje}%; background:linear-gradient(90deg, #EF4444 0%, #F59E0B 50%, #10B981 100%); border-radius:6px; transition:width 1s ease-out; box-shadow: 0 0 10px ${gaugeColor};"></div>
                    </div>
                </div>
            </div>

            <div class="grid-cards">
                <div class="card stat-card">
                    <i class="fa-solid fa-users stat-icon"></i>
                    <div class="stat-title">Personal Total</div>
                    <div class="stat-value">${dashboard.totalTrabajadores}</div>
                </div>
                
                <div class="card stat-card" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(109, 40, 217, 0.25)); display: flex; flex-direction: column; justify-content: flex-start; min-height: 220px;">
                    <i class="fa-solid fa-business-time stat-icon" style="top: 1rem; right: 1rem;"></i>
                    <div class="stat-title">Horas Nómina (Ideales)</div>
                    <div class="stat-value" style="font-size: 2.2rem; font-weight: 700; margin-bottom: 0.75rem;">
                        ${dashboard.personalPorArea.reduce((sum, a) => sum + (a.cantidad * 40), 0).toLocaleString()}h
                    </div>
                    <!-- Lista de áreas con horas correspondientes -->
                    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; width: 100%; margin-top: auto;">
                        ${dashboard.personalPorArea.map(a => `
                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-muted);">
                                <span><i class="fa-solid fa-users" style="color:var(--primary); font-size:0.7rem; margin-right:0.3rem;"></i>${a.area}</span>
                                <span style="font-weight:600; color:white;">${(a.cantidad * 40).toLocaleString()}h</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="card stat-card" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(30, 64, 175, 0.2))">
                    <i class="fa-solid fa-layer-group stat-icon"></i>
                    <div class="stat-title">Áreas</div>
                    <div class="stat-value">${dashboard.totalAreas}</div>
                </div>

                <div class="card stat-card" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(180, 83, 9, 0.2))">
                    <i class="fa-solid fa-tasks stat-icon"></i>
                    <div class="stat-title">Actividades</div>
                    <div class="stat-value">${dashboard.totalActividades}</div>
                </div>
                
                <div class="card stat-card" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.2))">
                    <i class="fa-solid fa-seedling stat-icon"></i>
                    <div class="stat-title">Productos</div>
                    <div class="stat-value">${dashboard.totalProductos}</div>
                </div>
            </div>

            <div class="card" style="margin-top:1.5rem; margin-bottom:1.5rem;">
                <h3><i class="fa-solid fa-calendar-week" style="color:var(--primary); margin-right:0.5rem;"></i> Semanas de Trabajo</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:1rem; margin-top:1rem;">
                    <div style="padding:1.25rem; background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); border-radius:12px;">
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">SEMANA SELECCIONADA</div>
                        ${semanaSeleccionada ? `
                            <div style="font-size:1.5rem; font-weight:600; color:#A7F3D0;">${semanaSeleccionada.codigoAass}</div>
                            <div style="color:var(--text-muted); font-size:0.9rem; margin-bottom:0.75rem;">${semanaSeleccionada.fechaInicio} al ${semanaSeleccionada.fechaFin}</div>
                            ${Object.keys(gruposActual).length > 0 ? `
                                <div style="border-top:1px solid rgba(16,185,129,0.2); padding-top:0.75rem; margin-top:0.5rem;">
                                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">AVANCE POR LABOR:</div>
                                    ${Object.entries(gruposActual).sort((a,b) => b[1].planificadas - a[1].planificadas).map(([labor, datos]) => {
                                        const ejecutado = ejecucionesPorLabor[labor] || 0;
                                        const pct = datos.planificadas > 0 ? Math.min((ejecutado / datos.planificadas) * 100, 100) : 0;
                                        return `
                                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                                                <span style="flex:0 0 100px; font-size:0.8rem; color:#A7F3D0;">${labor}</span>
                                                <div style="flex:1; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                                                    <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #EF4444 0%, #F59E0B 50%, #10B981 100%); border-radius:4px;"></div>
                                                </div>
                                                <span style="flex:0 0 80px; font-size:0.75rem; color:var(--text-muted); text-align:right;">${ejecutado.toFixed(1)}/${datos.planificadas.toFixed(1)}h</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : ''}
                            <span class="badge" style="margin-top:0.5rem; background:rgba(16, 185, 129, 0.3); color:#A7F3D0;">${semanaSeleccionada.estado}</span>
                        ` : '<div style="color:var(--text-muted);">Sin semana seleccionada</div>'}
                    </div>
                    <div style="padding:1.25rem; background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.3); border-radius:12px;">
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">PRÓXIMA SEMANA</div>
                        ${semanaSiguiente ? `
                            <div style="font-size:1.5rem; font-weight:600; color:#93C5FD;">${semanaSiguiente.codigoAass}</div>
                            <div style="color:var(--text-muted); font-size:0.9rem; margin-bottom:0.75rem;">${semanaSiguiente.fechaInicio} al ${semanaSiguiente.fechaFin}</div>
                            ${Object.keys(gruposProxima).length > 0 ? `
                                <div style="border-top:1px solid rgba(59,130,246,0.2); padding-top:0.75rem; margin-top:0.5rem;">
                                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">HORAS PLANIFICADAS:</div>
                                    ${Object.entries(gruposProxima).sort((a,b) => b[1].planificadas - a[1].planificadas).map(([labor, datos]) => `
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                                            <span style="font-size:0.85rem; color:#93C5FD;">${labor}</span>
                                            <span style="font-size:0.85rem; color:var(--text-muted);">${datos.planificadas.toFixed(1)} hrs</span>
                                        </div>
                                    `).join('')}
                                    <div style="border-top:1px solid rgba(59,130,246,0.2); padding-top:0.5rem; margin-top:0.5rem; display:flex; justify-content:space-between;">
                                        <span style="font-weight:600; color:#93C5FD;">TOTAL</span>
                                        <span style="font-weight:600; color:white;">${Object.values(gruposProxima).reduce((s,g) => s + g.planificadas, 0).toFixed(1)} hrs</span>
                                    </div>
                                </div>
                            ` : '<div style="color:var(--text-muted); font-size:0.85rem; margin-top:0.5rem;">Sin planificación aún</div>'}
                            <span class="badge" style="margin-top:0.5rem; background:rgba(59, 130, 246, 0.3); color:#93C5FD;">${semanaSiguiente.estado}</span>
                        ` : '<div style="color:var(--text-muted);">Sin semana planificada</div>'}
                    </div>
                </div>
            </div>

            <!-- GRÁFICA DE MARGEN DE HORAS SEMANAL -->
            <div class="card" style="margin-bottom:1.5rem;">
                <h3 style="margin-bottom:0.5rem;"><i class="fa-solid fa-chart-column" style="color:var(--secondary); margin-right:0.5rem;"></i> Historial y Margen de Horas Semanal</h3>
                <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.5rem;">Comparativa histórica de las últimas semanas planificadas vs. ejecutadas (ejecutado - planificado)</p>
                ${renderGraficaSemanas(datosGrafica)}
            </div>

            <div class="card" style="margin-bottom:1.5rem;">
                <h3><i class="fa-solid fa-rocket" style="color:var(--primary); margin-right:0.5rem;"></i> Acciones Rápidas</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-top:1.5rem;">
                    <button class="btn btn-primary" onclick="App.navigate('planificacion')" style="justify-content:center; padding:1rem;">
                        <i class="fa-solid fa-calendar-plus"></i> Planificar Semana
                    </button>
                    <button class="btn btn-outline" onclick="App.navigate('ejecucion')" style="justify-content:center; padding:1rem;">
                        <i class="fa-solid fa-clipboard-check"></i> Registrar Ejecución
                    </button>
                    <button class="btn btn-outline" onclick="App.navigate('personal')" style="justify-content:center; padding:1rem;">
                        <i class="fa-solid fa-user-plus"></i> Gestionar Personal
                    </button>
                    <button class="btn btn-outline" onclick="App.navigate('rendimientos')" style="justify-content:center; padding:1rem;">
                        <i class="fa-solid fa-cog"></i> Configuración
                    </button>
                </div>
            </div>
            
            <div class="card">
                <h3><i class="fa-solid fa-chart-pie" style="color:var(--secondary); margin-right:0.5rem;"></i> Personal por Área</h3>
                <div style="margin-top:1rem; display:grid; gap:0.75rem;">
                    ${renderPersonalPorArea()}
                </div>
            </div>
        </div>
    `;
});
