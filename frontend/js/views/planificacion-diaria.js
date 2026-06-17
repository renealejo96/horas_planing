App.registerView('planificacion-diaria', async () => {
    const TALLOS_POR_MALLA = {
        'GYPSOPHILA': 25, 'HYPERICUM': 25, 'VERONICA': 25, 'SOLIDAGO': 25, 'SUNFLOWER': 30
    };

    // Cargar datos
    let semanaSeleccionada = null, semanaActual = null, todasLasSemanas = [];
    let planificacionItems = [], planificacionDiaria = [], areas = [], rendimientosGlobales = [], ejecucionesSemana = [], allPlanificacionDiariaSemana = [];
    let actividades = [], productos = [];
    let planDiarioPorPlan = {}; // Mapeo rápido de id_planificacion -> objeto_plan_diario
    let grupoActivo = null;
    let gruposUnicos = [];
    let cultivoActivoDiario = null;
    
    const getLocalIsoDate = (dOb) => {
        const y = dOb.getFullYear();
        const m = String(dOb.getMonth() + 1).padStart(2, '0');
        const d = String(dOb.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const fechaManana = getLocalIsoDate(manana);
    const fechaHoy = getLocalIsoDate(hoy);
    
    // Fecha global seleccionada (para sincronizar entre vistas)
    let fechaSeleccionada = window.fechaGlobalSeleccionada || fechaHoy;
    window.fechaGlobalSeleccionada = fechaSeleccionada;
    
    try {
        [semanaActual, areas, todasLasSemanas, actividades, productos, rendimientosGlobales] = await Promise.all([
            api.getSemanaActual().catch(() => null),
            api.getAreas().catch(() => []),
            api.getSemanasDisponibles().catch(() => []),
            api.getActividades().catch(() => []),
            api.getProductos().catch(() => []),
            api.getRendimientos().catch(() => [])
        ]);
        
        // CLAVE: Buscar la semana que contiene la fechaSeleccionada
        // Si no hay semanas disponibles, usar semanaActual como fallback
        const semanas = todasLasSemanas.length ? todasLasSemanas : (semanaActual ? [semanaActual] : []);
        semanaSeleccionada = semanas.find(s => {
            if (!s.fechaInicio || !s.fechaFin) return false;
            const inicio = s.fechaInicio.split('T')[0];
            const fin = s.fechaFin.split('T')[0];
            return fechaSeleccionada >= inicio && fechaSeleccionada <= fin;
        }) || semanaActual;
        
        if (semanaSeleccionada) {
            [planificacionItems, planificacionDiaria, ejecucionesSemana, allPlanificacionDiariaSemana] = await Promise.all([
                api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []),
                api.getPlanDiarioFecha(fechaSeleccionada).catch(() => []),
                api.getEjecucionesSemana(semanaSeleccionada.codigoAass).catch(() => []),  // solo de esta semana
                api.getPlanDiarioSemana(semanaSeleccionada.codigoAass).catch(() => [])
            ]);
            
            // Filtrar por permisos de usuario
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.rol !== 'ADMIN') {
                const permitidas = (user.actividadesPermitidas || '').split(',').map(s => s.trim().toUpperCase());
                planificacionItems = planificacionItems.filter(p => {
                    const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'GENERAL').toUpperCase();
                    const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                    return permitidas.includes(grupo);
                });
                planificacionDiaria = planificacionDiaria.filter(pd => {
                    if (!pd.planificacion) return false;
                    const rawName = (pd.planificacion.actividad?.laborMadre || pd.planificacion.actividad?.grupo || pd.planificacion.actividad?.nombre || 'GENERAL').toUpperCase();
                    const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                    return permitidas.includes(grupo);
                });
            }
            
            // Mapeo rápido para verificar asignaciones ya hechas
            planDiarioPorPlan = {};
            planificacionDiaria.forEach(pd => {
                const pid = pd.planificacionId || pd.planificacion?.id;
                if (pid) planDiarioPorPlan[pid] = pd;
            });

            // Extraer grupos únicos y ordenar con fallback seguro
            const gruposSet = new Set();
            planificacionItems.forEach(p => {
                const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'GENERAL').toUpperCase();
                p.grupoCalculado = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                gruposSet.add(p.grupoCalculado);
            });
            
            planificacionDiaria.forEach(pd => {
                if (pd.planificacion) {
                    const rawName = (pd.planificacion.actividad?.laborMadre || pd.planificacion.actividad?.grupo || pd.planificacion.actividad?.nombre || 'GENERAL').toUpperCase();
                    pd.planificacion.grupoCalculado = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                    gruposSet.add(pd.planificacion.grupoCalculado);
                }
            });
            
            gruposUnicos = Array.from(gruposSet).sort();
            
            // Si no hay grupo activo o el activo ya no existe, elegimos el primero o COSECHA
            if (gruposUnicos.length > 0 && (!grupoActivo || !gruposUnicos.includes(grupoActivo))) {
                grupoActivo = gruposUnicos.includes('COSECHA') ? 'COSECHA' : gruposUnicos[0];
            }

            // Iniciar cultivo activo diario
            if (grupoActivo) {
                const cultivos = getCultivosDelGrupo();
                cultivoActivoDiario = cultivos.length > 0 ? cultivos[0].codigo : null;
            }
        }
    } catch (e) {
        console.log('Error cargando planificación diaria:', e);
    }
    
    // Las variables ya fueron inicializadas en el try/catch arriba
    
    // Calcular totales visuales sin importar el grupo (para el header superior)
    const totalHorasSemana = planificacionItems.reduce((sum, p) => sum + (p.horasAjustadas || p.horasCalculadas || 0), 0);
    const totalHorasDiaAsignadas = planificacionDiaria.reduce((sum, pd) => sum + (pd.horasAsignadas || 0), 0);
    
    // Función para cambiar el grupo sin recargar todo
    window.seleccionarGrupoDiario = (grupo) => {
        grupoActivo = grupo;
        const cultivos = getCultivosDelGrupo();
        cultivoActivoDiario = cultivos.length > 0 ? cultivos[0].codigo : null;
        
        const cultCont = document.getElementById('cultivos-diarios-container');
        if (cultCont) cultCont.innerHTML = renderCultivoTabsDiario();
        
        document.getElementById('grid-container-diario').innerHTML = renderPlanificacionParaAsignar();
        document.querySelectorAll('.grupo-tab-diario').forEach(t => {
            if (t.dataset.grupo === grupo) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
    };
    
    // Función para recargar datos del día
    window.recargarPlanDiario = (fecha) => {
        window.fechaGlobalSeleccionada = fecha;
        App.navigate('planificacion-diaria');
    };
    
    window.calcHorasDiarias = (planId, isCosecha, tallosMalla, rend) => {
        const uniInp = document.getElementById(`uni-dia-${planId}`);
        const hrsInp = document.getElementById(`hrs-dia-${planId}`);
        const unidades = parseFloat(uniInp.value) || 0;
        if (unidades > 0) {
            let horas = isCosecha ? ((unidades / tallosMalla) / rend) : (unidades / rend);
            hrsInp.value = horas.toFixed(2);
        } else {
            hrsInp.value = '';
        }
    };

    // Función para guardar asignación diaria
    // Función para guardar asignación diaria
    window.guardarAsignacionDiaria = async (planificacionId) => {
        const inputUni = document.getElementById(`uni-dia-${planificacionId}`);
        const inputHrs = document.getElementById(`hrs-dia-${planificacionId}`);
        const inputObs = document.getElementById(`obs-dia-${planificacionId}`);
        
        const unidadesAsignadas = parseFloat(inputUni?.value) || 0;
        let horasAsignadas = parseFloat(inputHrs?.value) || 0;
        
        if (horasAsignadas <= 0 && unidadesAsignadas <= 0) {
            showNotification('Ingresa unidades u horas a asignar', 'error');
            return;
        }

        // Buscar planificacion semanal para avisar si se excede el plan
        const p = planificacionItems.find(item => item.id === planificacionId);
        let superoPlan = false;
        if (p) {
            const isCosecha = grupoActivo === 'COSECHA';
            const productoCodigo = p.actividad?.producto?.codigo;
            const tallosMalla = p.actividad?.producto?.tallosPorMalla || TALLOS_POR_MALLA[productoCodigo] || 25;
            const rendOriginal = p.rendimientoUsado || 1;

            const horasSemanales = p.horasAjustadas || p.horasCalculadas || 0;
            const unidadesSemanales = isCosecha ? Math.round(horasSemanales * rendOriginal * tallosMalla) : (p.unidadesPlanificadas || 0);

            const asignacionesOtrosDias = allPlanificacionDiariaSemana.filter(pd => {
                const pid = pd.planificacionId || pd.planificacion?.id;
                return pid === planificacionId && pd.fecha !== fechaSeleccionada;
            });
            const horasOtrosDias = asignacionesOtrosDias.reduce((s, pd) => s + (pd.horasAsignadas || 0), 0);
            const unidadesOtrosDias = asignacionesOtrosDias.reduce((s, pd) => s + (pd.unidadesAsignadas || 0), 0);

            if ((horasOtrosDias + horasAsignadas) > (horasSemanales + 0.05) || (unidadesOtrosDias + unidadesAsignadas) > (unidadesSemanales + 0.05)) {
                superoPlan = true;
            }
        }

        const btn = document.querySelector(`button[onclick="guardarAsignacionDiaria(${planificacionId})"]`);
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            await api.crearPlanDiario({
                planificacionId: planificacionId,
                fecha: fechaSeleccionada,
                horasAsignadas: horasAsignadas,
                unidadesAsignadas: unidadesAsignadas,
                observacion: inputObs?.value || null
            });
            showNotification(`✓ Asignado para ${fechaSeleccionada}`, 'success');
            if (superoPlan) {
                setTimeout(() => {
                    showNotification('⚠️ ¡Atención! Esta asignación supera las horas o unidades semanales planificadas.', 'warning');
                }, 1000);
            }
            App.navigate('planificacion-diaria');
        } catch (e) {
            showNotification('Error al guardar asignación', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };
    
    window.guardarTodoDiario = async () => {
        const itemsFiltrados = planificacionItems.filter(p => p.grupoCalculado === grupoActivo);
        const promesas = [];
        let creados = 0;
        let superoPlan = false;
        
        for (const p of itemsFiltrados) {
            const planExistente = planDiarioPorPlan[p.id];
            if (planExistente) continue; // Skip existing
            
            const inputUni = document.getElementById(`uni-dia-${p.id}`);
            const inputHrs = document.getElementById(`hrs-dia-${p.id}`);
            const inputObs = document.getElementById(`obs-dia-${p.id}`);
            
            const unidadesAsignadas = parseFloat(inputUni?.value) || 0;
            let horasAsignadas = parseFloat(inputHrs?.value) || 0;
            
            if (horasAsignadas > 0 || unidadesAsignadas > 0) {
                // Verificar si supera presupuesto semanal
                const isCosecha = grupoActivo === 'COSECHA';
                const productoCodigo = p.actividad?.producto?.codigo;
                const tallosMalla = p.actividad?.producto?.tallosPorMalla || TALLOS_POR_MALLA[productoCodigo] || 25;
                const rendOriginal = p.rendimientoUsado || 1;

                const horasSemanales = p.horasAjustadas || p.horasCalculadas || 0;
                const unidadesSemanales = isCosecha ? Math.round(horasSemanales * rendOriginal * tallosMalla) : (p.unidadesPlanificadas || 0);

                const asignacionesOtrosDias = allPlanificacionDiariaSemana.filter(pd => {
                    const pid = pd.planificacionId || pd.planificacion?.id;
                    return pid === p.id && pd.fecha !== fechaSeleccionada;
                });
                const horasOtrosDias = asignacionesOtrosDias.reduce((s, pd) => s + (pd.horasAsignadas || 0), 0);
                const unidadesOtrosDias = asignacionesOtrosDias.reduce((s, pd) => s + (pd.unidadesAsignadas || 0), 0);

                if ((horasOtrosDias + horasAsignadas) > (horasSemanales + 0.05) || (unidadesOtrosDias + unidadesAsignadas) > (unidadesSemanales + 0.05)) {
                    superoPlan = true;
                }

                promesas.push(api.crearPlanDiario({
                    planificacionId: p.id,
                    fecha: fechaSeleccionada,
                    horasAsignadas: horasAsignadas,
                    unidadesAsignadas: unidadesAsignadas,
                    observacion: inputObs?.value || null
                }));
                creados++;
            }
        }
        
        if (promesas.length === 0) {
            showNotification('No hay nuevas asignaciones ingresadas para guardar.', 'info');
            return;
        }

        const btn = document.querySelector('button[onclick="guardarTodoDiario()"]');
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GUARDANDO ASIGNACIONES...';
        }
        showNotification('Guardando asignaciones...', 'info');
        
        try {
            await Promise.all(promesas);
            showNotification(`✓ ${creados} asignaciones guardadas exitosamente`, 'success');
            if (superoPlan) {
                setTimeout(() => {
                    showNotification('⚠️ ¡Atención! Algunas de las asignaciones guardadas superan los totales semanales planificados.', 'warning');
                }, 1000);
            }
            App.navigate('planificacion-diaria');
        } catch (e) {
            showNotification('Error guardando en lote', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };
    
    // Función para eliminar asignación
    window.eliminarAsignacionDiaria = async (planDiariaId) => {
        if (!confirm('¿Eliminar esta asignación diaria?')) return;
        
        try {
            await api.eliminarPlanDiario(planDiariaId);
            showNotification('Asignación eliminada', 'success');
            App.navigate('planificacion-diaria');
        } catch (e) {
            showNotification('Error al eliminar', 'error');
        }
    };
    
    const getCultivosDelGrupo = () => {
        // Filtrar por grupo y excluir asignados para hoy
        const itemsGrupo = planificacionItems.filter(p => p.grupoCalculado === grupoActivo && !planDiarioPorPlan[p.id]);
        const cultivosMap = new Map();
        itemsGrupo.forEach(p => {
            const pdcto = p.producto || p.actividad?.producto;
            if (pdcto) {
                cultivosMap.set(pdcto.codigo, pdcto.nombre);
            } else {
                cultivosMap.set('GENERAL', 'General');
            }
        });
        return Array.from(cultivosMap.entries()).map(([codigo, nombre]) => ({ codigo, nombre }));
    };

    const renderCultivoTabsDiario = () => {
        const cultivos = getCultivosDelGrupo();
        if (!cultivos.length) return '<div style="color:var(--text-muted); font-size:0.8rem; padding: 0.5rem 0;">Sin cultivos con planificación pendiente</div>';
        
        if (cultivoActivoDiario && !cultivos.some(c => c.codigo === cultivoActivoDiario)) {
            cultivoActivoDiario = cultivos[0].codigo;
        } else if (!cultivoActivoDiario) {
            cultivoActivoDiario = cultivos[0].codigo;
        }
        
        return `
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:1px; margin-top: 0.5rem;">Filtrar por Cultivo</div>
            <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                ${cultivos.map(c => {
                    const isActive = cultivoActivoDiario === c.codigo ? 'active' : '';
                    return `
                        <button class="cultivo-card cultivo-tab-diario ${isActive}" data-cultivo="${c.codigo}" onclick="seleccionarCultivoDiario('${c.codigo}')">
                            ${c.nombre}
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    };

    window.seleccionarCultivoDiario = (cultivo) => {
        cultivoActivoDiario = cultivo;
        document.getElementById('grid-container-diario').innerHTML = renderPlanificacionParaAsignar();
        document.querySelectorAll('.cultivo-tab-diario').forEach(btn => {
            if (btn.dataset.cultivo === cultivo) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    };

    const renderGrupoTabs = () => {
        if (!gruposUnicos.length) return '<span style="color:var(--text-muted);">Sin planificaciones en la semana</span>';
        return gruposUnicos.map(g => {
            const isActive = grupoActivo === g ? 'active' : '';
            return `
            <button class="grupo-tab-diario ${isActive}" data-grupo="${g}" onclick="seleccionarGrupoDiario('${g}')">
                ${g}
            </button>
            `;
        }).join('');
    };
    
    // Renderizar ACORDEÓN JERÁRQUICO: Actividad -> Cultivo (Variedad)
    window.renderPlanificacionParaAsignar = () => {
        if (planificacionItems.length === 0) {
            return `
                <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <p style="font-size:1.1rem;">Sin planificaciones para esta semana.</p>
                </div>
            `;
        }
        
        const getPlaceholderUnidad = (unidadCodigo) => {
            switch(unidadCodigo) {
                case 'PLANTAS_HORA': return 'Plantas';
                case 'MALLAS_HORA': return 'Mallas';
                case 'PINGOS_HORA': return 'Pingos';
                case 'CAMAS_HORA': return 'Camas';
                default: return 'unid';
            }
        };

        // 1. Filtrar por GRUPO ACTIVO y CULTIVO ACTIVO y excluir ya asignadas para hoy
        const itemsGrupo = planificacionItems.filter(p => {
            const pCultivo = (p.producto || p.actividad?.producto)?.codigo || 'GENERAL';
            return p.grupoCalculado === grupoActivo && !planDiarioPorPlan[p.id] && pCultivo === cultivoActivoDiario;
        });

        // Filtrar solo los que tengan disponible > 0
        const itemsGrupoFiltrados = itemsGrupo.filter(p => {
            const isCosecha = grupoActivo === 'COSECHA';
            const productoCodigo = p.actividad?.producto?.codigo;
            const tallosMalla = p.actividad?.producto?.tallosPorMalla || TALLOS_POR_MALLA[productoCodigo] || 25;
            const rendOriginal = p.rendimientoUsado || 1;
            
            const horasSemanales = p.horasAjustadas || p.horasCalculadas || 0;
            const unidadesSemanales = isCosecha ? Math.round(horasSemanales * rendOriginal * tallosMalla) : (p.unidadesPlanificadas || 0);

            // Calcular asignaciones en otros días
            const asignacionesOtrosDias = allPlanificacionDiariaSemana.filter(pd => {
                const pid = pd.planificacionId || pd.planificacion?.id;
                return pid === p.id && pd.fecha !== fechaSeleccionada;
            });
            const unidadesOtrosDias = asignacionesOtrosDias.reduce((s, pd) => s + (pd.unidadesAsignadas || 0), 0);
            const unidadesDisponiblesDia = unidadesSemanales - unidadesOtrosDias;
            
            return unidadesDisponiblesDia > 0;
        });
        
        if (itemsGrupoFiltrados.length === 0) {
            return `
                <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                    <i class="fa-solid fa-check-circle" style="font-size:2.5rem; margin-bottom:0.5rem; color:#10B981; opacity:0.8;"></i>
                    <p style="font-size:1rem; font-weight:600; color:white;">¡Completado!</p>
                    <p style="font-size:0.85rem;">Todas las actividades de esta categoría y cultivo han sido asignadas o completadas.</p>
                </div>
            `;
        }

        // 2. Agrupar por nombre de ACTIVIDAD específica
        const porActividad = {};
        itemsGrupoFiltrados.forEach(p => {
            const actKey = p.actividad?.nombre || 'GENERAL';
            if (!porActividad[actKey]) porActividad[actKey] = [];
            porActividad[actKey].push(p);
        });
        
        const actividadesOrdenadas = Object.keys(porActividad).sort();
        const html = actividadesOrdenadas.map((actividadNombre, actIdx) => {
            const itemsActividad = porActividad[actividadNombre];
            const actId = `act-acord-${actIdx}`;
            const horasActividad = itemsActividad.reduce((s, p) => s + (p.horasAjustadas || p.horasCalculadas || 0), 0);
            const isCosecha = grupoActivo === 'COSECHA';

            // Agrupar items de esta actividad por CULTIVO (Variedad)
            const porCultivo = {};
            itemsActividad.forEach(p => {
                const cultivoKey = p.actividad?.producto?.nombre || 'GENERAL';
                if (!porCultivo[cultivoKey]) porCultivo[cultivoKey] = [];
                porCultivo[cultivoKey].push(p);
            });
            const cultivosOrdenados = Object.keys(porCultivo).sort();

            let rowCounter = 0;

            return `
            <div class="actividad-accordion" style="margin-bottom:0.75rem; border:1px solid rgba(255,255,255,0.1); border-radius:12px; overflow:hidden; background:rgba(255,255,255,0.02);">
                <!-- CABECERA ACTIVIDAD -->
                <div onclick="toggleAcordeon('${actId}')" 
                     style="display:flex; align-items:center; gap:1rem; padding:0.8rem 1.2rem; background:rgba(59,130,246,0.08); cursor:pointer; user-select:none;">
                    <i id="icon-${actId}" class="fa-solid fa-chevron-right" style="color:var(--primary); transition:transform 0.2s;"></i>
                    <div style="flex:1;">
                        <span style="font-size:1.05rem; font-weight:700; color:white;">${actividadNombre}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.8rem;">
                            ${itemsActividad.length} ítems pendientes · ${horasActividad.toFixed(1)}h semana
                        </span>
                    </div>
                </div>

                <!-- CONTENIDO ACTIVIDAD (CERRADO POR DEFECTO) -->
                <div id="${actId}" style="display:none; border-top:1px solid rgba(255,255,255,0.05);">
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left;">
                            <thead style="background:rgba(0,0,0,0.2); color:var(--text-muted); text-transform:uppercase; font-size:0.7rem; letter-spacing:0.5px;">
                                <tr>
                                    <th style="padding:0.75rem; width:40px; text-align:center;">#</th>
                                    <th style="padding:0.75rem; width:120px;">Bloque</th>
                                    <th style="padding:0.75rem; text-align:center;">Meta Semanal</th>
                                    <th style="padding:0.75rem; width:110px; text-align:center;">U. Día</th>
                                    <th style="padding:0.75rem; width:80px; text-align:center;">H. Día</th>
                                    <th style="padding:0.75rem;">Nota</th>
                                    <th style="padding:0.75rem; text-align:center;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                            ${cultivosOrdenados.map(cultivoName => {
                                const itemsCultivo = porCultivo[cultivoName];
                                const separatorRow = `
                                    <tr style="background:rgba(245,158,11,0.05); font-weight:bold; border-left:3px solid #F59E0B;">
                                        <td colspan="7" style="padding:0.5rem 0.8rem; color:#F59E0B; font-size:0.8rem; font-weight:700;">
                                            <i class="fa-solid fa-leaf" style="margin-right:0.3rem;"></i> CULTIVO: ${cultivoName.toUpperCase()}
                                        </td>
                                    </tr>
                                `;

                                const rowsHtml = itemsCultivo.map(p => {
                                    rowCounter++;
                                    const productoCodigo = p.actividad?.producto?.codigo;
                                    const tallosMalla = p.actividad?.producto?.tallosPorMalla || TALLOS_POR_MALLA[productoCodigo] || 25;
                                    const rendOriginal = p.rendimientoUsado || 1;
                                    const rendRelacionado = rendimientosGlobales.find(r => r.actividad?.id === p.actividad?.id && (!p.actividad?.producto || r.producto?.id === p.actividad?.producto?.id));
                                    const blackjackUnidad = rendRelacionado?.unidad?.codigo;
                                    const unidadStr = getPlaceholderUnidad(blackjackUnidad);
                                    const unidadPlaceholder = isCosecha ? 'Tallos' : unidadStr;
                                    
                                    const horasSemanales = p.horasAjustadas || p.horasCalculadas || 0;
                                    const unidadesSemanales = isCosecha ? Math.round(horasSemanales * rendOriginal * tallosMalla) : (p.unidadesPlanificadas || 0);

                                    // Calcular asignaciones previas de la misma semana (días anteriores)
                                    const asignacionesPrevias = allPlanificacionDiariaSemana.filter(pd => {
                                        const pid = pd.planificacionId || pd.planificacion?.id;
                                        return pid === p.id && pd.fecha < fechaSeleccionada;
                                    });
                                    const horasAsignadasPrevias = asignacionesPrevias.reduce((s, pd) => s + (pd.horasAsignadas || 0), 0);
                                    const unidadesAsignadasPrevias = asignacionesPrevias.reduce((s, pd) => s + (pd.unidadesAsignadas || 0), 0);

                                    const horasDisponiblesDia = horasSemanales - horasAsignadasPrevias;
                                    const unidadesDisponiblesDia = unidadesSemanales - unidadesAsignadasPrevias;

                                    const esExcedido = unidadesDisponiblesDia < 0 || horasDisponiblesDia < 0;

                                    const badgeDisponible = esExcedido 
                                        ? `<div style="font-size:0.7rem; color:#FCA5A5; background:rgba(239, 68, 68, 0.15); padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block; font-weight:bold;">
                                            <i class="fa-solid fa-triangle-exclamation"></i> Excedido: ${Math.round(Math.abs(unidadesDisponiblesDia)).toLocaleString()} ${unidadPlaceholder} (${Math.abs(horasDisponiblesDia).toFixed(1)}h)
                                           </div>`
                                        : `<div style="font-size:0.7rem; color:#A7F3D0; background:rgba(16, 185, 129, 0.15); padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block;">
                                            Disponible: <strong>${Math.round(unidadesDisponiblesDia).toLocaleString()}</strong> ${unidadPlaceholder} (<strong>${horasDisponiblesDia.toFixed(1)}h</strong>)
                                           </div>`;

                                    return `
                                        <tr style="border-top:1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
                                            <td style="padding:0.7rem; text-align:center; color:var(--text-muted); font-size:0.75rem;">${rowCounter}</td>
                                            <td style="padding:0.7rem; color:white; font-weight:600;">${p.bloque || '-'}</td>
                                            <td style="padding:0.7rem; text-align:center;">
                                                <div style="color:var(--text-muted); font-size:0.8rem;">${unidadesSemanales.toLocaleString()} ${unidadPlaceholder}</div>
                                                <div style="font-size:0.7rem; opacity:0.6;">${horasSemanales.toFixed(1)}h plan</div>
                                                ${badgeDisponible}
                                            </td>
                                            <td style="padding:0.7rem;">
                                                <input type="number" id="uni-dia-${p.id}" placeholder="${Math.max(0, Math.round(unidadesDisponiblesDia))}" onfocus="this.select()"
                                                    oninput="calcHorasDiarias(${p.id}, ${isCosecha}, ${tallosMalla}, ${rendOriginal})"
                                                    style="width:100%; padding:0.4rem; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white; border-radius:6px; text-align:center; font-weight:700;">
                                            </td>
                                            <td style="padding:0.7rem;">
                                                <input type="number" id="hrs-dia-${p.id}" placeholder="${Math.max(0, horasDisponiblesDia).toFixed(1)}h" step="0.5" readonly
                                                    style="width:100%; padding:0.4rem; background:transparent; border:none; color:#94A3B8; text-align:center; font-weight:600;">
                                            </td>
                                            <td style="padding:0.7rem;">
                                                <input type="text" id="obs-dia-${p.id}" placeholder="Nota..." 
                                                    style="width:100%; padding:0.4rem; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white; border-radius:6px; font-size:0.75rem;">
                                            </td>
                                            <td style="padding:0.7rem; text-align:center;">
                                                <button class="btn btn-primary btn-sm" onclick="guardarAsignacionDiaria(${p.id})" 
                                                    style="background:linear-gradient(135deg, #10B981, #059669); border:none; padding:6px 12px; border-radius:6px; font-weight:bold; cursor:pointer;"
                                                    title="Guardar asignación">
                                                    <i class="fa-solid fa-floppy-disk"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('');

                                return separatorRow + rowsHtml;
                            }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            `;
        }).join('');
        
        return html;
    };
    
    // Toggle acordeón
    window.toggleAcordeon = (id) => {
        const el = document.getElementById(id);
        const icon = document.getElementById(`icon-${id}`);
        if (!el) return;
        const hidden = el.style.display === 'none';
        el.style.display = hidden ? 'block' : 'none';
        if (icon) {
            icon.style.transform = hidden ? 'rotate(90deg)' : 'rotate(0deg)';
        }
    };
    
    // Generar opciones de días de la semana
    const renderDiasSemana = () => {
        const semParaMostrar = semanaSeleccionada || semanaActual;
        if (!semParaMostrar) return '';
        
        const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        
        // Fallback robusto para fechaInicio
        const fInicioStr = semParaMostrar.fechaInicio ? semParaMostrar.fechaInicio.split('T')[0] : getLocalIsoDate(new Date());
        const [sy, sm, sd] = fInicioStr.split('-');
        const fechaInicioLocal = new Date(sy, sm - 1, sd);
        let html = '<div style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem; margin-top:1rem;">';
        
        for (let i = 0; i < 7; i++) {
            const cDate = new Date(fechaInicioLocal);
            cDate.setDate(cDate.getDate() + i);
            const fechaStr = getLocalIsoDate(cDate);
            
            const esMañana = fechaStr === fechaManana;
            const esHoy = fechaStr === fechaHoy;
            const esSeleccionado = fechaStr === fechaSeleccionada;
            
            html += `
                <button class="dia-btn ${esSeleccionado ? 'active' : ''}" 
                        onclick="recargarPlanDiario('${fechaStr}')"
                        style="flex:1; min-width:60px; padding:0.5rem; border:none; 
                               background:${esSeleccionado ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'rgba(255,255,255,0.08)'}; 
                               color:white; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:600;
                               display:flex; flex-direction:column; align-items:center;
                               box-shadow:${esSeleccionado ? '0 2px 8px rgba(59,130,246,0.4)' : 'none'};">
                    <span style="font-size:0.7rem; color:${esSeleccionado ? '#DBEAFE' : 'var(--text-muted)'}; text-transform:uppercase;">${diasSemana[i]}</span>
                    <span style="font-size:1.1rem; margin-top:0.2rem;">${fechaStr.split('-')[2]}</span>
                    ${esHoy ? '<span style="font-size:0.6rem; background:#10B981; padding:0.1rem 0.3rem; border-radius:4px; margin-top:0.2rem;">Hoy</span>' : ''}
                </button>
            `;
        }
        html += '</div>';
        return html;
    };

    const renderAsignacionesRealizadas = () => {
        if (planificacionDiaria.length === 0) return '';

        if (window.asignacionesRealizadasExpandido === undefined) {
            window.asignacionesRealizadasExpandido = false;
        }

        window.toggleAsignacionesRealizadas = () => {
            window.asignacionesRealizadasExpandido = !window.asignacionesRealizadasExpandido;
            App.navigate('planificacion-diaria');
        };

        const expandido = !!window.asignacionesRealizadasExpandido;

        return `
            <div class="card" style="margin-top:1.5rem; border:1px solid rgba(16, 185, 129, 0.2);">
                <div onclick="toggleAsignacionesRealizadas()" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                    <h3 style="margin:0;"><i class="fa-solid fa-clipboard-check" style="color:#10B981; margin-right:0.5rem;"></i> Asignaciones Realizadas (${fechaSeleccionada}) <span class="badge" style="margin-left:0.5rem; background:#10B981; color:white;">${planificacionDiaria.length}</span></h3>
                    <i class="fa-solid ${expandido ? 'fa-chevron-up' : 'fa-chevron-down'}" style="color:var(--text-muted);"></i>
                </div>
                <div id="asignaciones-realizadas-contenido" style="display:${expandido ? 'block' : 'none'}; margin-top:1.5rem;">
                    <div style="overflow-x:auto;">
                        <table>
                            <thead>
                                <tr style="text-transform:uppercase; font-size:0.75rem; color:var(--text-muted);">
                                    <th>Grupo</th>
                                    <th>Actividad</th>
                                    <th>Bloque</th>
                                    <th style="text-align:right;">U. Asignadas</th>
                                    <th style="text-align:right;">H. Asignadas</th>
                                    <th>Nota</th>
                                    <th style="text-align:center; width:80px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${planificacionDiaria.map(pd => {
                                    const p = pd.planificacion;
                                    if (!p) return '';
                                    const rawName = (p.actividad?.laborMadre || 'GENERAL').toUpperCase();
                                    const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                                    const cultivo = p.actividad?.producto?.nombre || 'GENERAL';
                                    const dsc = `${cultivo} - ${p.actividad?.nombre || ''}`;
                                    return `
                                        <tr style="border-top:1px solid rgba(255,255,255,0.03);">
                                            <td><span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD;">${grupo}</span></td>
                                            <td><strong>${dsc}</strong></td>
                                            <td>${p.bloque || p.valvulas || '-'}</td>
                                            <td style="text-align:right; font-weight:bold; color:#10B981;">${pd.unidadesAsignadas.toFixed(0)}</td>
                                            <td style="text-align:right; font-weight:bold; color:#10B981;">${pd.horasAsignadas.toFixed(1)}h</td>
                                            <td style="color:var(--text-muted); font-size:0.8rem; font-style:italic;">${pd.observacion || ''}</td>
                                            <td style="text-align:center;">
                                                <button class="btn btn-sm" onclick="eliminarAsignacionDiaria(${pd.id})" 
                                                    style="color:#ef4444; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); padding:5px 8px; border-radius:6px; cursor:pointer;"
                                                    title="Eliminar asignación (volverá al listado de pendientes)">
                                                    <i class="fa-solid fa-trash-can"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    };

    const activityBelongsToArea = (a, areaId) => {
        const area = areas.find(ar => ar.id == areaId);
        if (!area) return false;
        
        // 1. Direct match
        if (a.area && a.area.id == areaId) return true;
        
        // Fallback: match activity.laborMadre with area.codigo/nombre
        const cleanAreaCode = area.codigo ? area.codigo.replace('PY_', '').toUpperCase() : '';
        const cleanAreaNombre = area.nombre ? area.nombre.toUpperCase() : '';
        
        if (a.laborMadre) {
            const lm = a.laborMadre.toUpperCase();
            if (lm === cleanAreaCode || lm === cleanAreaNombre) return true;
        }
        
        // Fallback 2: match activity name containing cleanAreaCode/Nombre or vice versa
        if (a.nombre) {
            const nm = a.nombre.toUpperCase();
            if (nm.includes(cleanAreaCode) || nm.includes(cleanAreaNombre) || cleanAreaNombre.includes(nm)) return true;
        }
        
        // Fallback 3: check if there's any Rendimiento mapping for this activity that has the grupo matching this area
        const matchingRends = rendimientosGlobales.filter(r => r.actividad?.id === a.id);
        for (const r of matchingRends) {
            if (r.grupo) {
                const rg = r.grupo.toUpperCase();
                if (rg === cleanAreaCode || rg === cleanAreaNombre) return true;
            }
        }
        
        // Fallback 4: check if there's any Rendimiento mapping matching by NAME
        const hasMatchingYieldByName = rendimientosGlobales.some(r => 
            r.actividad?.nombre && a.nombre &&
            r.actividad.nombre.toUpperCase() === a.nombre.toUpperCase() &&
            r.grupo && (r.grupo.toUpperCase() === cleanAreaCode || r.grupo.toUpperCase() === cleanAreaNombre)
        );
        if (hasMatchingYieldByName) return true;
        
        return false;
    };

    // Filter crops (productos) for daily add form based on Area
    window.filtrarCultivosDiario = (areaId) => {
        const selectCultivo = document.getElementById('diario-agregar-cultivo');
        const selectAct = document.getElementById('diario-agregar-actividad');
        
        selectAct.innerHTML = '<option value="">Selecciona cultivo primero</option>';
        selectAct.disabled = true;
        document.getElementById('diario-agregar-bloque-container').style.display = 'none';
        
        if (!areaId) {
            selectCultivo.innerHTML = '<option value="">Selecciona área primero</option>';
            selectCultivo.disabled = true;
            return;
        }
        
        const area = areas.find(ar => ar.id == areaId);
        const cleanAreaCode = area?.codigo ? area.codigo.replace('PY_', '').toUpperCase() : '';
        const cleanAreaNombre = area?.nombre ? area.nombre.toUpperCase() : '';
        
        // Find products that have yields defined in this Area (via group/area match or activity area match)
        const prodIds = new Set(
            rendimientosGlobales
                .filter(r => r.producto && (
                    (r.actividad?.area?.id == areaId) ||
                    (r.grupo && cleanAreaCode && r.grupo.toUpperCase() === cleanAreaCode) ||
                    (r.grupo && cleanAreaNombre && r.grupo.toUpperCase() === cleanAreaNombre)
                ))
                .map(r => r.producto.id)
        );
        const filteredProductos = productos.filter(p => prodIds.has(p.id));
        const finalProductos = filteredProductos.length > 0 ? filteredProductos : productos;
        
        selectCultivo.innerHTML = '<option value="">Seleccionar cultivo...</option>' +
            finalProductos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        selectCultivo.disabled = false;
    };

    // Filter activities for daily add form based on Area and Crop
    window.filtrarActividadesAgregarDiario = () => {
        const areaId = document.getElementById('diario-agregar-area').value;
        const cultivoId = document.getElementById('diario-agregar-cultivo').value;
        const selectAct = document.getElementById('diario-agregar-actividad');
        
        document.getElementById('diario-agregar-bloque-container').style.display = 'none';
        
        if (!areaId || !cultivoId) {
            selectAct.innerHTML = '<option value="">Selecciona cultivo primero</option>';
            selectAct.disabled = true;
            return;
        }
        
        // Find activities belonging to this area and either general (!producto) or matching this crop or having yield for this crop
        const actividadesArea = actividades.filter(a => {
            const belongsToArea = activityBelongsToArea(a, areaId);
            if (!belongsToArea) return false;
            
            const hasDirectCrop = a.producto && a.producto.id == cultivoId;
            const isGeneral = !a.producto;
            const hasYieldForCrop = rendimientosGlobales.some(r => 
                r.producto?.id == cultivoId && 
                (r.actividad?.id == a.id || (r.actividad?.nombre && a.nombre && r.actividad.nombre.toUpperCase() === a.nombre.toUpperCase()))
            );
            
            return hasDirectCrop || isGeneral || hasYieldForCrop;
        });
        
        if (actividadesArea.length === 0) {
            selectAct.innerHTML = '<option value="">Sin actividades para este área y cultivo</option>';
            selectAct.disabled = true;
        } else {
            // Eliminar duplicados visuales por nombre
            const nombresVistos = new Set();
            const actividadesUnicas = [];
            actividadesArea.forEach(a => {
                const nombreKey = (a.nombre || '').toUpperCase();
                if (!nombresVistos.has(nombreKey)) {
                    nombresVistos.add(nombreKey);
                    actividadesUnicas.push(a);
                }
            });
            
            selectAct.innerHTML = '<option value="">Seleccionar...</option>' + 
                actividadesUnicas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
            selectAct.disabled = false;
        }
    };
    
    let diarioActividadesCount = 0;

    const renderAreasOptions = () => {
        if (areas.length === 0) return '<option value="">Sin áreas</option>';
        return '<option value="">Seleccionar área...</option>' + 
            areas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
    };

    window.agregarFilaActividadFueraPlan = () => {
        const lista = document.getElementById('diario-agregar-actividades-lista');
        if (!lista) return;
        
        diarioActividadesCount++;
        const id = diarioActividadesCount;
        
        const card = document.createElement('div');
        card.id = `fila-actividad-card-${id}`;
        card.className = 'fila-actividad-card';
        card.style.cssText = `
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: var(--radius-md);
            padding: 1.25rem;
            margin-bottom: 1rem;
            position: relative;
        `;
        
        const areaOptions = renderAreasOptions();
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.5rem;">
                <span style="font-weight:700; color:var(--primary); font-size:0.9rem; text-transform:uppercase;"><i class="fa-solid fa-folder-plus"></i> Actividad Adicional</span>
                <button type="button" class="btn btn-sm" onclick="eliminarFilaActividadFueraPlan(${id})" style="color:#ef4444; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); padding:4px 8px; border-radius:6px; height: 32px;" title="Eliminar Actividad">
                    <i class="fa-solid fa-trash-can"></i> Eliminar
                </button>
            </div>
            
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem;">
                <div>
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted);">Área</label>
                    <select id="diario-act-area-${id}" onchange="diarioFiltrarCultivos(${id})" style="width:100%; padding:0.5rem; border-radius:6px; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white;">
                        ${areaOptions}
                    </select>
                </div>
                <div>
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted);">Cultivo (Producto)</label>
                    <select id="diario-act-cultivo-${id}" onchange="diarioFiltrarActividades(${id})" style="width:100%; padding:0.5rem; border-radius:6px; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white;" disabled>
                        <option value="">Selecciona área primero</option>
                    </select>
                </div>
                <div>
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted);">Actividad</label>
                    <select id="diario-act-actividad-${id}" onchange="diarioActualizarActividad(${id})" style="width:100%; padding:0.5rem; border-radius:6px; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white;" disabled>
                        <option value="">Selecciona cultivo primero</option>
                    </select>
                </div>
                <div>
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted);">Rendimiento (u/h)</label>
                    <input type="number" id="diario-act-rendimiento-${id}" placeholder="Auto" min="0.1" step="any" style="width:100%; padding:0.5rem; border-radius:6px; background:var(--surface-glass); border:1px solid rgba(255,255,255,0.15); color:white;" readonly>
                </div>
                <div id="diario-act-bloque-container-${id}" style="display:none;">
                    <label id="diario-act-bloque-label-${id}" style="display:block; margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted);">Bloque / Válvula</label>
                    <input type="text" id="diario-act-bloque-${id}" list="list-bloques" placeholder="Ej: B1" style="width:100%; padding:0.5rem; border-radius:6px; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white;" onfocus="this.select()">
                </div>
                <div>
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted);">Unidades *</label>
                    <input type="number" id="diario-act-unidades-${id}" placeholder="Ej: 30" min="0.1" step="any" oninput="diarioRecalcularHoras(${id})" style="width:100%; padding:0.5rem; border-radius:6px; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white; font-weight:700;">
                </div>
                <div style="display:flex; flex-direction:column; justify-content:flex-end; min-height:55px;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted);">Horas Calc.</label>
                    <div style="padding:0.5rem; text-align:center;"><span id="diario-act-horas-${id}" style="font-size:1.1rem; color:var(--text-muted); font-weight:700;">--</span></div>
                </div>
            </div>
            <div style="margin-top:1rem;">
                <label style="display:block; margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted);">Observación / Nota (opcional)</label>
                <input type="text" id="diario-act-observacion-${id}" placeholder="Ej: Adelanto de cultivo / imprevisto..." style="width:100%; padding:0.5rem; border-radius:6px; background:#1E293B; border:1px solid rgba(255,255,255,0.15); color:white;">
            </div>
        `;
        
        lista.appendChild(card);
    };

    window.eliminarFilaActividadFueraPlan = (id) => {
        const card = document.getElementById(`fila-actividad-card-${id}`);
        if (card) {
            card.remove();
        }
    };

    window.diarioFiltrarCultivos = (id) => {
        const areaId = document.getElementById(`diario-act-area-${id}`).value;
        const selectCultivo = document.getElementById(`diario-act-cultivo-${id}`);
        const selectAct = document.getElementById(`diario-act-actividad-${id}`);
        
        selectAct.innerHTML = '<option value="">Selecciona cultivo primero</option>';
        selectAct.disabled = true;
        document.getElementById(`diario-act-bloque-container-${id}`).style.display = 'none';
        
        if (!areaId) {
            selectCultivo.innerHTML = '<option value="">Selecciona área primero</option>';
            selectCultivo.disabled = true;
            return;
        }
        
        const area = areas.find(ar => ar.id == areaId);
        const cleanAreaCode = area?.codigo ? area.codigo.replace('PY_', '').toUpperCase() : '';
        const cleanAreaNombre = area?.nombre ? area.nombre.toUpperCase() : '';
        
        const prodIds = new Set(
            rendimientosGlobales
                .filter(r => r.producto && (
                    (r.actividad?.area?.id == areaId) ||
                    (r.grupo && cleanAreaCode && r.grupo.toUpperCase() === cleanAreaCode) ||
                    (r.grupo && cleanAreaNombre && r.grupo.toUpperCase() === cleanAreaNombre)
                ))
                .map(r => r.producto.id)
        );
        const filteredProductos = productos.filter(p => prodIds.has(p.id));
        const finalProductos = filteredProductos.length > 0 ? filteredProductos : productos;
        
        selectCultivo.innerHTML = '<option value="">Seleccionar cultivo...</option>' +
            finalProductos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        selectCultivo.disabled = false;
    };

    window.diarioFiltrarActividades = (id) => {
        const areaId = document.getElementById(`diario-act-area-${id}`).value;
        const cultivoId = document.getElementById(`diario-act-cultivo-${id}`).value;
        const selectAct = document.getElementById(`diario-act-actividad-${id}`);
        
        document.getElementById(`diario-act-bloque-container-${id}`).style.display = 'none';
        
        if (!areaId || !cultivoId) {
            selectAct.innerHTML = '<option value="">Selecciona cultivo primero</option>';
            selectAct.disabled = true;
            return;
        }
        
        const actividadesArea = actividades.filter(a => {
            const belongsToArea = activityBelongsToArea(a, areaId);
            if (!belongsToArea) return false;
            
            const hasDirectCrop = a.producto && a.producto.id == cultivoId;
            const isGeneral = !a.producto;
            const hasYieldForCrop = rendimientosGlobales.some(r => 
                r.producto?.id == cultivoId && 
                (r.actividad?.id == a.id || (r.actividad?.nombre && a.nombre && r.actividad.nombre.toUpperCase() === a.nombre.toUpperCase()))
            );
            
            return hasDirectCrop || isGeneral || hasYieldForCrop;
        });
        
        if (actividadesArea.length === 0) {
            selectAct.innerHTML = '<option value="">Sin actividades para esta área y cultivo</option>';
            selectAct.disabled = true;
        } else {
            const nombresVistos = new Set();
            const actividadesUnicas = [];
            actividadesArea.forEach(a => {
                const nombreKey = (a.nombre || '').toUpperCase();
                if (!nombresVistos.has(nombreKey)) {
                    nombresVistos.add(nombreKey);
                    actividadesUnicas.push(a);
                }
            });
            
            selectAct.innerHTML = '<option value="">Seleccionar...</option>' + 
                actividadesUnicas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
            selectAct.disabled = false;
        }
    };

    window.diarioActualizarActividad = (id) => {
        const actividadId = document.getElementById(`diario-act-actividad-${id}`).value;
        const rendInput = document.getElementById(`diario-act-rendimiento-${id}`);
        const cultivoId = document.getElementById(`diario-act-cultivo-${id}`).value;
        const container = document.getElementById(`diario-act-bloque-container-${id}`);
        const label = document.getElementById(`diario-act-bloque-label-${id}`);
        
        const actividad = actividades.find(a => a.id == actividadId);
        
        if (!actividad) {
            container.style.display = 'none';
            rendInput.value = '';
            return;
        }
        
        let rend = rendimientosGlobales.find(r => r.actividad?.id == actividadId && r.producto?.id == cultivoId) ||
                   rendimientosGlobales.find(r => r.actividad?.id == actividadId && !r.producto);
                   
        if (!rend && actividad.nombre) {
            const nameUpper = actividad.nombre.toUpperCase();
            rend = rendimientosGlobales.find(r => r.actividad?.nombre && r.actividad.nombre.toUpperCase() === nameUpper && r.producto?.id == cultivoId) ||
                   rendimientosGlobales.find(r => r.actividad?.nombre && r.actividad.nombre.toUpperCase() === nameUpper && !r.producto);
        }
                     
        const rendVal = rend ? (rend.rendimiento ?? rend.valorRendimiento ?? 0) : 0;
        rendInput.value = rendVal > 0 ? rendVal : '';
        
        if (actividad.esVarios) {
            container.style.display = 'none';
        } else {
            container.style.display = 'block';
            const esFerti = actividad.area?.codigo?.includes('FERTIRRIEGO');
            label.textContent = esFerti ? 'Válvula(s)' : 'Bloque(s)';
        }
        
        window.diarioRecalcularHoras(id);
    };

    window.diarioRecalcularHoras = (id) => {
        const unitsInput = document.getElementById(`diario-act-unidades-${id}`);
        const rendInput = document.getElementById(`diario-act-rendimiento-${id}`);
        const hrsSpan = document.getElementById(`diario-act-horas-${id}`);
        
        const unidades = parseFloat(unitsInput.value) || 0;
        const rendimiento = parseFloat(rendInput.value) || 0;
        
        if (rendimiento > 0 && unidades > 0) {
            const horas = unidades / rendimiento;
            hrsSpan.textContent = `${horas.toFixed(2)} h`;
            hrsSpan.style.color = '#10B981';
        } else {
            hrsSpan.textContent = '--';
            hrsSpan.style.color = 'var(--text-muted)';
        }
    };

    window.toggleSeccionAgregarDiario = () => {
        const contenido = document.getElementById('diario-agregar-contenido');
        const icono = document.getElementById('diario-agregar-toggle-icon');
        if (contenido.style.display === 'none') {
            contenido.style.display = 'block';
            icono.className = 'fa-solid fa-chevron-up';
        } else {
            contenido.style.display = 'none';
            icono.className = 'fa-solid fa-chevron-down';
        }
    };

    // Guardar múltiples actividades imprevistas
    window.agregarLineaDiarioFueraPlan = async () => {
        if (!semanaActual) {
            showNotification('No hay una semana activa cargada', 'error');
            return;
        }

        const areaInputs = document.querySelectorAll('select[id^="diario-act-area-"]');
        const itemsToSave = [];
        
        let hasError = false;
        areaInputs.forEach(areaSelect => {
            if (hasError) return;
            const matches = areaSelect.id.match(/diario-act-area-(\d+)/);
            if (!matches) return;
            const id = matches[1];
            
            const areaId = areaSelect.value;
            const cultivoId = document.getElementById(`diario-act-cultivo-${id}`).value;
            const actividadId = document.getElementById(`diario-act-actividad-${id}`).value;
            const rendimiento = parseFloat(document.getElementById(`diario-act-rendimiento-${id}`).value) || 0;
            const bloque = document.getElementById(`diario-act-bloque-${id}`)?.value?.trim() || '';
            const unidades = parseFloat(document.getElementById(`diario-act-unidades-${id}`).value) || 0;
            const observacion = document.getElementById(`diario-act-observacion-${id}`).value?.trim() || '';
            
            if (actividadId && unidades > 0 && rendimiento > 0) {
                const actividad = actividades.find(a => a.id == actividadId);
                const laborMadre = actividad?.laborMadre;
                const esCosecha = laborMadre && laborMadre.toUpperCase() === 'COSECHA';
                if (!esCosecha && !bloque) {
                    showNotification(`El campo bloque/válvula es obligatorio para la actividad "${actividad?.nombre || ''}"`, 'warning');
                    hasError = true;
                    return;
                }
                itemsToSave.push({
                    actividadId: parseInt(actividadId),
                    bloque,
                    unidades,
                    rendimiento,
                    observacion
                });
            }
        });
        
        if (hasError) return;
        
        if (itemsToSave.length === 0) {
            showNotification('Completa al menos una actividad con unidades y rendimiento válidos.', 'error');
            return;
        }
        
        try {
            // Guardar iterativamente
            for (const item of itemsToSave) {
                const horasCalc = item.unidades / item.rendimiento;
                const actividad = actividades.find(a => a.id == item.actividadId);
                const esFerti = actividad?.area?.codigo?.includes('FERTIRRIEGO');
                
                // 1. Crear en planificación semanal
                const newPlan = await api.createPlanificacion({
                    semana: { id: semanaActual.id },
                    actividad: { id: item.actividadId },
                    bloque: esFerti ? null : (item.bloque || null),
                    valvulas: esFerti ? (item.bloque || null) : null,
                    unidadesPlanificadas: item.unidades,
                    rendimientoUsado: item.rendimiento,
                    horasCalculadas: horasCalc,
                    horasAjustadas: horasCalc
                });
                
                // 2. Asignar automáticamente al plan diario
                if (newPlan && newPlan.id) {
                    await api.crearPlanDiario({
                        planificacionId: newPlan.id,
                        fecha: fechaSeleccionada,
                        horasAsignadas: horasCalc,
                        unidadesAsignadas: item.unidades,
                        observacion: item.observacion || '[ADICIONAL FUERA PLAN]'
                    });
                }
            }
            
            showNotification(`✓ Se agregaron ${itemsToSave.length} actividades fuera de plan y se asignaron correctamente.`, 'success');
            App.navigate('planificacion-diaria'); // Recargar vista
        } catch (e) {
            console.error('Error guardando fuera de plan:', e);
            showNotification('Error al agregar actividades fuera de plan', 'error');
        }
    };
    
    return `
        <div class="fade-in">
            <!-- Header con selector de día -->
            <div class="card plan-diario-header-card">
                <div class="header-content" style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h3><i class="fa-solid fa-calendar-day" style="color:var(--primary); margin-right:0.5rem;"></i> Planificación Diaria</h3>
                        <p class="subtitle">Asigna horas/unidades de la planificación semanal a cada día</p>
                    </div>
                    <div class="semana-badge" style="margin:0;">
                         ${semanaSeleccionada ? `Semana ${semanaSeleccionada.codigoAass}` : (semanaActual ? `Semana ${semanaActual.codigoAass}` : 'Sin semana activa')}
                    </div>
                </div>
                
                ${renderDiasSemana()}
                
                <div class="resumen-dia" style="margin-top:1.5rem;">
                    <div class="resumen-item">
                        <span class="label">Total Horas Semana:</span>
                        <span class="value">${totalHorasSemana.toFixed(1)}h</span>
                    </div>
                    <div class="resumen-item highlight">
                        <span class="label">Horas Asignadas para el ${fechaSeleccionada}:</span>
                        <span class="value">${totalHorasDiaAsignadas.toFixed(1)}h</span>
                    </div>
                </div>
            </div>
            
            <!-- Grid de actividades -->
            ${planificacionItems.length > 0 ? `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3><i class="fa-solid fa-tasks" style="color:var(--secondary); margin-right:0.5rem;"></i> Actividades de la Semana</h3>
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <span style="color:var(--text-muted); font-size:0.9rem;">
                            ${planificacionItems.length} actividades planificadas
                        </span>
                        <button class="btn btn-primary" onclick="guardarTodoDiario()" style="font-weight:bold;">
                            <i class="fa-solid fa-save"></i> Guardar Todo
                        </button>
                    </div>
                </div>
                
                <!-- GRUPO TABS -->
                <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:1rem; border-radius:8px;">
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:1px;">Filtro de Actividad Madre</div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.75rem;">
                        ${renderGrupoTabs()}
                    </div>
                    <div id="cultivos-diarios-container">
                        ${renderCultivoTabsDiario()}
                    </div>
                </div>
                
                <!-- CONTAINER GRID -->
                <div id="grid-container-diario" style="width: 100%;">
                    ${window.renderPlanificacionParaAsignar ? window.renderPlanificacionParaAsignar() : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- Asignaciones Realizadas -->
            ${renderAsignacionesRealizadas()}
        </div>
    `;

    // ========== NAVEGACION CON TECLADO DIARIO ==========
    const configurarNavegacionTecladoDiario = () => {
        const contenedor = document.getElementById('grid-container-diario');
        if (!contenedor) return;

        contenedor.addEventListener('keydown', (e) => {
            const keys = ['Enter', 'ArrowUp', 'ArrowDown'];
            if (!keys.includes(e.key)) return;

            const target = e.target;
            const isInput = target.id && target.id.startsWith('uni-dia-');
            if (!isInput) return;

            // Conseguir todos los inputs del contenedor que estén activos/visibles
            const allInputs = Array.from(contenedor.querySelectorAll('input[id^="uni-dia-"]:not([readonly])'));
            const currentIndex = allInputs.indexOf(target);

            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = currentIndex + 1;
                if (nextIndex < allInputs.length) {
                    allInputs[nextIndex].focus();
                    allInputs[nextIndex].select();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex - 1;
                if (prevIndex >= 0) {
                    allInputs[prevIndex].focus();
                    allInputs[prevIndex].select();
                }
            }
        });

        // Seleccionar todo al enfocar
        contenedor.addEventListener('focusin', (e) => {
            if (e.target.id && e.target.id.startsWith('uni-dia-')) {
                e.target.select();
            }
        });
    };

    setTimeout(configurarNavegacionTecladoDiario, 100);
});
