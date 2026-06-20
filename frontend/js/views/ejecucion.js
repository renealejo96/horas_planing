App.registerView('ejecucion', async () => {
    const TALLOS_POR_MALLA = {
        'GYPSOPHILA': 25, 'HYPERICUM': 25, 'VERONICA': 25, 'SOLIDAGO': 25, 'SUNFLOWER': 30, 'Eucalitpos': 25
    };

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

    // Cargar semana en ejecución y su planificación
    let semanaActual = null, planificacionItems = [], ejecuciones = [], areas = [], actividades = [], rendimientos = [], productos = [], fueraGrupos = [];
    let grupoActivo = window.ejecucionGrupoActivo || null;
    let gruposUnicos = [];
    let fechaSeleccionada = window.fechaGlobalSeleccionada || fechaHoy;
    window.fechaGlobalSeleccionada = fechaSeleccionada;
    
    let cultivoActivoDiario = window.ejecucionCultivoActivo || null;
    let subActividadActiva = window.ejecucionSubActividadActiva || null;
    
    const getCultivosDelGrupo = () => {
        const itemsGrupo = planificacionItems.filter(p => {
            return p && p.grupoCalculado === grupoActivo;
        });
        
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
        if (grupoActivo === 'COSECHA') return '';
        const cultivos = getCultivosDelGrupo();
        if (!cultivos.length) return '<div style="color:var(--text-muted); font-size:0.8rem; padding: 0.5rem 0;">Sin cultivos con ejecuciones pendientes</div>';
        
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
                        <button class="cultivo-card cultivo-tab-ejecucion ${isActive}" data-cultivo="${c.codigo}" onclick="seleccionarCultivoDiario('${c.codigo}')">
                            ${c.nombre}
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    };

    try {
        let grps = [];
        [semanaActual, areas, actividades, ejecuciones, rendimientos, productos, grps] = await Promise.all([
            api.getSemanaActual().catch(() => null),
            api.getAreas().catch(() => []),
            api.getActividades().catch(() => []),
            api.getEjecuciones().catch(() => []),
            api.getRendimientos().catch(() => []),
            api.getProductos().catch(() => []),
            api.getGrupos().catch(() => [])
        ]);
        
        fueraGrupos = grps;
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.rol !== 'ADMIN') {
            const permitidas = (user.actividadesPermitidas || '').split(',').map(s => s.trim().toUpperCase());
            fueraGrupos = fueraGrupos.filter(g => permitidas.includes(g.toUpperCase()));
        }
        
        if (semanaActual) {
            planificacionItems = await api.getPlanificacionSemana(semanaActual.codigoAass).catch(() => []);
            
            // Filtrar por permisos de usuario
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.rol !== 'ADMIN') {
                const permitidas = (user.actividadesPermitidas || '').split(',').map(s => s.trim().toUpperCase());
                planificacionItems = planificacionItems.filter(p => {
                    const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'OTRO').toUpperCase();
                    const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                    return permitidas.includes(grupo);
                });
            }
            
            // Extraer grupos únicos para Ejecución
            const gruposSet = new Set();
            planificacionItems.forEach(p => {
                const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'OTRO').toUpperCase();
                p.grupoCalculado = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                gruposSet.add(p.grupoCalculado);
            });
            
            gruposUnicos = Array.from(gruposSet).sort();
            
            if (gruposUnicos.length > 0 && (!grupoActivo || !gruposUnicos.includes(grupoActivo))) {
                grupoActivo = gruposUnicos.includes('COSECHA') ? 'COSECHA' : gruposUnicos[0];
                window.ejecucionGrupoActivo = grupoActivo;
            }
            
            if (grupoActivo) {
                const cultivos = getCultivosDelGrupo();
                if (!cultivoActivoDiario || !cultivos.some(c => c.codigo === cultivoActivoDiario)) {
                    cultivoActivoDiario = cultivos.length > 0 ? cultivos[0].codigo : null;
                    window.ejecucionCultivoActivo = cultivoActivoDiario;
                }
            }
        }
    } catch (e) {
        console.log('Error cargando ejecución:', e);
    }
    
    window.cambiarFechaEjecucion = (fecha) => {
        window.fechaGlobalSeleccionada = fecha;
        App.navigate('ejecucion');
    };
    
    // Función para cambiar el grupo sin recargar todo
    window.seleccionarGrupoEjecucion = (grupo) => {
        grupoActivo = grupo;
        window.ejecucionGrupoActivo = grupo;
        const cultivos = getCultivosDelGrupo();
        cultivoActivoDiario = cultivos.length > 0 ? cultivos[0].codigo : null;
        window.ejecucionCultivoActivo = cultivoActivoDiario;
        subActividadActiva = null;
        window.ejecucionSubActividadActiva = null;
        
        const cultCont = document.getElementById('cultivos-ejecucion-container');
        if (cultCont) cultCont.innerHTML = renderCultivoTabsDiario();
        
        const subActCont = document.getElementById('subactividades-ejecucion-container');
        if (subActCont) subActCont.innerHTML = renderSubActividadesTabsDiario();
        
        document.getElementById('grid-container-ejecucion').innerHTML = window.renderPlanificacionParaEjecutar();
        document.querySelectorAll('.grupo-tab-ejecucion').forEach(t => {
            if (t.dataset.grupo === grupo) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        
        // Auto-sincronizar cosecha al hacer click en el grupo COSECHA
        if (grupo === 'COSECHA') {
            window.sincronizarCosechaApi();
        }

        // Actualizar Historial de Ejecuciones dinámicamente
        const histWrapper = document.getElementById('historial-ejecuciones-wrapper');
        if (histWrapper) {
            histWrapper.innerHTML = renderHistorialCardCompleto();
        }

        // Actualizar Tarjeta de Información de Grupo
        const infoGrupoWrapper = document.getElementById('info-grupo-ejecucion-wrapper');
        if (infoGrupoWrapper) {
            infoGrupoWrapper.innerHTML = renderInfoGrupoEjecucion();
        }
    };

    window.seleccionarCultivoDiario = (cultivo) => {
        cultivoActivoDiario = cultivo;
        window.ejecucionCultivoActivo = cultivo;
        subActividadActiva = null;
        window.ejecucionSubActividadActiva = null;
        
        const subActCont = document.getElementById('subactividades-ejecucion-container');
        if (subActCont) subActCont.innerHTML = renderSubActividadesTabsDiario();
        
        document.getElementById('grid-container-ejecucion').innerHTML = window.renderPlanificacionParaEjecutar();
        document.querySelectorAll('.cultivo-tab-ejecucion').forEach(btn => {
            if (btn.dataset.cultivo === cultivo) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    };
    
    const getSubActividadesDelCultivo = () => {
        const itemsGrupoCultivo = planificacionItems.filter(p => {
            if (!p || p.grupoCalculado !== grupoActivo) return false;
            const pCultivo = (p.producto || p.actividad?.producto)?.codigo || 'GENERAL';
            return pCultivo === cultivoActivoDiario;
        });
        
        const subActSet = new Set();
        itemsGrupoCultivo.forEach(p => {
            if (p.actividad?.nombre) {
                subActSet.add(p.actividad.nombre);
            }
        });
        return Array.from(subActSet).sort();
    };

    const renderSubActividadesTabsDiario = () => {
        if (grupoActivo === 'COSECHA') return '';
        const subActs = getSubActividadesDelCultivo();
        if (!subActs.length) return '';
        
        return `
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:1px; margin-top: 0.5rem;">Filtrar por Sub-actividad</div>
            <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.2rem;">
                <button class="labor-card subact-tab-ejecucion ${subActividadActiva === 'TODAS' ? 'active' : ''}" onclick="seleccionarSubActividadDiario('TODAS')">
                    VER TODAS
                </button>
                ${subActs.map(sa => {
                    const isActive = subActividadActiva === sa ? 'active' : '';
                    return `
                        <button class="labor-card subact-tab-ejecucion ${isActive}" data-subact="${sa}" onclick="seleccionarSubActividadDiario('${sa}')">
                            ${sa}
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    };

    window.seleccionarSubActividadDiario = (subact) => {
        subActividadActiva = subact;
        window.ejecucionSubActividadActiva = subact;
        document.getElementById('grid-container-ejecucion').innerHTML = window.renderPlanificacionParaEjecutar();
        document.querySelectorAll('.subact-tab-ejecucion').forEach(btn => {
            const isMatch = (subact === 'TODAS' && !btn.dataset.subact) || (btn.dataset.subact === subact);
            if (isMatch) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    };
    
    const renderGrupoTabs = () => {
        if (!gruposUnicos.length) return '<span style="color:var(--text-muted);">Sin actividades en la semana</span>';
        return gruposUnicos.map(g => {
            const isActive = grupoActivo === g ? 'active' : '';
            return `
            <button class="grupo-tab-ejecucion ${isActive}" data-grupo="${g}" onclick="seleccionarGrupoEjecucion('${g}')">
                ${g}
            </button>
            `;
        }).join('');
    };
    
    // Separar ejecuciones planificadas vs imprevistas
    const ejecucionesImprevistas = ejecuciones.filter(e => !e.planificacion && e.observacion?.includes('[IMPREVISTO]'));
    const totalHorasImprevistas = ejecucionesImprevistas.reduce((sum, e) => sum + (e.horasReales || 0), 0);
    
    // Calcular totales de la SEMANA para la barra superior
    const totalHorasPlanificadas = planificacionItems.reduce((sum, p) => sum + (p.horasAjustadas || p.horasCalculadas || 0), 0);
    const totalHorasEjecutadas = planificacionItems.reduce((sum, p) => sum + (p.horasEjecutadas || 0), 0);
    const porcentajeEjecucion = totalHorasPlanificadas > 0 ? Math.min(100, (totalHorasEjecutadas / totalHorasPlanificadas) * 100) : 0;
    
    // Calcular el total para el DIA
    const totalHorasPlanificadasDia = planificacionItems.reduce((sum, p) => {
        const ejecsSemana = ejecuciones.filter(e => e.planificacion?.id === p.id);
        const ejecsOtrosDias = ejecsSemana.filter(e => e.fecha !== fechaSeleccionada);
        const horasEjecOtros = ejecsOtrosDias.reduce((s, e) => s + (e.horasReales || 0), 0);
        const horasPlanSemana = p.horasAjustadas || p.horasCalculadas || 0;
        return sum + Math.max(0, horasPlanSemana - horasEjecOtros);
    }, 0);
    const totalHorasEjecutadasDia = ejecuciones.filter(e => e.fecha === fechaSeleccionada && e.planificacion).reduce((sum, e) => sum + (e.horasReales || 0), 0);
    
    // Función para calcular rendimiento real
    window.calcularRendimientoReal = (planId) => {
        const horasInput = document.getElementById(`horas-real-${planId}`);
        const unidadesInput = document.getElementById(`unidades-real-${planId}`);
        const rendSpan = document.getElementById(`rend-real-${planId}`);
        
        const horas = parseFloat(horasInput.value) || 0;
        const unidades = parseFloat(unidadesInput.value) || 0;
        
        if (horas > 0) {
            const rendimiento = unidades / horas;
            rendSpan.textContent = `${rendimiento.toFixed(1)} u/h`;
            rendSpan.style.color = '#10B981';
        } else {
            rendSpan.textContent = '--';
            rendSpan.style.color = 'var(--text-muted)';
        }
    };

    // Función para sincronizar la cosecha desde la API externa
    window.sincronizarCosechaApi = async () => {
        if (!semanaActual) {
            showNotification('No hay una semana activa cargada', 'error');
            return;
        }

        const diasSemanaNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const [y, m, d] = fechaSeleccionada.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const nombreDia = diasSemanaNombres[date.getDay()];

        showNotification('Conectando con la API de Cosecha...', 'info');

        let data;

        try {
            data = await api.request(`/ejecucion/cosechas-externas?semana=${encodeURIComponent(semanaActual.codigoAass)}`);
        } catch (e) {
            console.warn('Error fetching harvest API via proxy, attempting direct fetch:', e);
            try {
                const directUrl = `https://cosecha-app-1.onrender.com/api/resumen?semana=${encodeURIComponent(semanaActual.codigoAass)}`;
                const responseDirect = await fetch(directUrl);
                if (!responseDirect.ok) {
                    throw new Error(`Direct status: ${responseDirect.status}`);
                }
                data = await responseDirect.json();
                console.log('Successfully fetched harvest data directly from Render API.');
            } catch (directErr) {
                console.error('Direct fetch also failed:', directErr);
                showNotification('Error al conectar con la API de Cosecha. Sincronización cancelada para evitar datos incorrectos.', 'error');
                return;
            }
        }

        const registros = data.datos || [];
        if (!registros.length) {
            showNotification('No hay registros de cosecha disponibles para esta semana en la API', 'warning');
            return;
        }

        // Agrupar por producto_maestro para la fecha seleccionada
        const totalesPorProducto = {};
        registros.forEach(r => {
            if (r.fecha === fechaSeleccionada) {
                const prod = String(r.producto_maestro || '').toUpperCase().trim();
                const tallos = parseFloat(r.total_tallos || r.cantidad || r.unidades || 0);
                totalesPorProducto[prod] = (totalesPorProducto[prod] || 0) + tallos;
            }
        });

        let matchCount = 0;
        const rows = document.querySelectorAll('#grid-container-ejecucion tr[data-producto-codigo]');
        
        rows.forEach(row => {
            const isCosechaRow = row.dataset.isCosecha === 'true';
            if (!isCosechaRow) return;

            const rowProdCodigo = String(row.dataset.productoCodigo || '').toUpperCase().trim();
            const planId = row.dataset.id;
            
            if (rowProdCodigo) {
                const unidadesInput = document.getElementById(`unidades-real-${planId}`);
                
                if (unidadesInput) {
                    if (totalesPorProducto[rowProdCodigo] !== undefined) {
                        unidadesInput.value = totalesPorProducto[rowProdCodigo];
                        unidadesInput.placeholder = "";
                        matchCount++;
                    } else {
                        unidadesInput.value = "";
                        unidadesInput.placeholder = "Sin tallos";
                    }
                    calcularRendimientoReal(planId);
                }
            }
        });

        if (matchCount > 0) {
            showNotification(`✓ Sincronizados ${matchCount} registros de cosecha desde la API`, 'success');
        } else {
            showNotification('No se encontraron coincidencias de cultivos entre la API y la planificación de hoy', 'info');
        }
    };
    
    // Función para guardar ejecución de una línea
    window.guardarEjecucionLinea = async (planId) => {
        const horasReales = parseFloat(document.getElementById(`horas-real-${planId}`).value);
        const unidadesReales = parseFloat(document.getElementById(`unidades-real-${planId}`).value);
        
        if (!horasReales || !unidadesReales) {
            showNotification('Ingresa horas y unidades reales', 'error');
            return;
        }
        
        const rendimientoReal = unidadesReales / horasReales;
        
        const btn = document.querySelector(`button[onclick="guardarEjecucionLinea(${planId})"]`);
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }
        
        try {
            await api.createEjecucion({
                planificacion: { id: planId },
                semana: semanaActual ? { id: semanaActual.id } : null,
                fecha: fechaSeleccionada,
                horasReales: horasReales,
                unidadesReales: unidadesReales,
                rendimientoReal: rendimientoReal
            });
            
            showNotification(`✓ Ejecutado el ${fechaSeleccionada}: ${horasReales}h`, 'success');
            App.navigate('ejecucion');
        } catch (e) {
            showNotification('Error al guardar ejecución', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    // Guardar ejecución de todo lo ingresado en el listado activo
    window.guardarTodoEjecucion = async () => {
        const elementosParaMostrar = planificacionItems.filter(p => {
            if (!p || p.grupoCalculado !== grupoActivo) return false;
            
            const pCultivo = (p.producto || p.actividad?.producto)?.codigo || 'GENERAL';
            if (grupoActivo !== 'COSECHA' && pCultivo !== cultivoActivoDiario) return false;
            
            const ejecsSemana = ejecuciones.filter(e => e.planificacion?.id === p.id);
            const totalHorasEjecutadasSemana = ejecsSemana.reduce((sum, e) => sum + (e.horasReales || 0), 0);
            const horasPlanSemana = p.horasAjustadas || p.horasCalculadas || 0;
            const completado = totalHorasEjecutadasSemana >= horasPlanSemana && horasPlanSemana > 0;
            return !completado;
        });

        const promesas = [];
        let creados = 0;

        for (const p of elementosParaMostrar) {
            const ejecsSemana = ejecuciones.filter(e => e.planificacion?.id === p.id);
            const totalHorasEjecutadasSemana = ejecsSemana.reduce((sum, e) => sum + (e.horasReales || 0), 0);
            const horasPlanSemana = p.horasAjustadas || p.horasCalculadas || 0;
            const completado = totalHorasEjecutadasSemana >= horasPlanSemana && horasPlanSemana > 0;

            if (completado) continue; // Saltear filas completadas

            const horasInput = document.getElementById(`horas-real-${p.id}`);
            const unidadesInput = document.getElementById(`unidades-real-${p.id}`);

            if (!horasInput || !unidadesInput) continue;

            const horasReales = parseFloat(horasInput.value);
            const unidadesReales = parseFloat(unidadesInput.value);

            if (horasReales > 0 && unidadesReales > 0) {
                const rendimientoReal = unidadesReales / horasReales;
                promesas.push(api.createEjecucion({
                    planificacion: { id: p.id },
                    semana: semanaActual ? { id: semanaActual.id } : null,
                    fecha: fechaSeleccionada,
                    horasReales: horasReales,
                    unidadesReales: unidadesReales,
                    rendimientoReal: rendimientoReal
                }));
                creados++;
            }
        }

        if (promesas.length === 0) {
            showNotification('No hay nuevos avances reales ingresados para guardar.', 'info');
            return;
        }

        const btn = document.querySelector('button[onclick="guardarTodoEjecucion()"]');
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GUARDANDO AVANCES...';
        }
        showNotification('Guardando avances de ejecución...', 'info');

        try {
            await Promise.all(promesas);
            showNotification(`✓ ${creados} registros de ejecución guardados`, 'success');
            App.navigate('ejecucion');
        } catch (e) {
            showNotification('Error al guardar ejecuciones en lote', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    // Modal de edición de ejecuciones
    window.abrirModalEditarEjecucion = async (id, fecha, horas, unidades, observacion) => {
        document.getElementById('edit-ejec-id').value = id;
        document.getElementById('edit-ejec-fecha').value = fecha;
        document.getElementById('edit-ejec-horas').value = horas;
        document.getElementById('edit-ejec-unidades').value = unidades;
        document.getElementById('edit-ejec-observacion').value = observacion || '';

        const unidadesInput = document.getElementById('edit-ejec-unidades');

        // Buscar ejecución en el arreglo local
        const ejec = ejecuciones.find(e => e.id == id);
        const p = ejec?.planificacion;
        const act = ejec?.actividad || p?.actividad;
        const rawName = (act?.laborMadre || act?.grupo || act?.nombre || '').toUpperCase();
        const isCosecha = rawName.includes('COSECHA');

        if (isCosecha) {
            // Configurar input como de solo lectura
            unidadesInput.readOnly = true;
            unidadesInput.style.background = 'rgba(255,255,255,0.05)';
            unidadesInput.style.border = '1px solid rgba(255,255,255,0.1)';
            unidadesInput.style.color = '#94A3B8';
            unidadesInput.style.cursor = 'not-allowed';
            unidadesInput.tabIndex = -1;

            // Mostrar estado de carga
            unidadesInput.value = '';
            unidadesInput.placeholder = 'Cargando tallos actualizados...';

            try {
                const weekCode = ejec?.semana?.codigoAass || semanaActual?.codigoAass;
                if (!weekCode) {
                    throw new Error('No hay semana asociada');
                }

                const pdcto = p?.producto || p?.actividad?.producto || ejec?.actividad?.producto;
                const rowProdCodigo = String(pdcto?.codigo || '').toUpperCase().trim();

                if (!rowProdCodigo) {
                    throw new Error('No hay producto asociado');
                }

                let data;
                try {
                    data = await api.request(`/ejecucion/cosechas-externas?semana=${encodeURIComponent(weekCode)}`);
                } catch (proxyErr) {
                    console.warn('Error fetching harvest API via proxy for edit, trying direct URL:', proxyErr);
                    const directUrl = `https://cosecha-app-1.onrender.com/api/resumen?semana=${encodeURIComponent(weekCode)}`;
                    const responseDirect = await fetch(directUrl);
                    if (!responseDirect.ok) {
                        throw new Error(`Direct status: ${responseDirect.status}`);
                    }
                    data = await responseDirect.json();
                }
                const registros = data.datos || [];

                // Sumar tallos para la fecha del registro y el producto exacto
                let totalCosechado = 0;
                let foundMatch = false;
                registros.forEach(r => {
                    if (r.fecha === fecha) {
                        const prod = String(r.producto_maestro || '').toUpperCase().trim();
                        if (prod === rowProdCodigo) {
                            const tallos = parseFloat(r.total_tallos || r.cantidad || r.unidades || 0);
                            totalCosechado += tallos;
                            foundMatch = true;
                        }
                    }
                });

                if (foundMatch) {
                    unidadesInput.value = totalCosechado;
                    showNotification(`✓ Tallos actualizados desde API: ${totalCosechado}`, 'success');
                } else {
                    unidadesInput.value = unidades;
                    unidadesInput.placeholder = '';
                    showNotification('No se encontraron cosechas actualizadas en la API para esta fecha/producto. Se mantiene el valor actual.', 'warning');
                }
            } catch (err) {
                console.error('Error fetching updated harvest data for edit:', err);
                unidadesInput.value = unidades;
                unidadesInput.placeholder = '';
                showNotification('Error al consultar cosechas de la API. Se mantiene el valor original.', 'warning');
            }
        } else {
            // Actividad normal
            unidadesInput.readOnly = false;
            unidadesInput.style.background = '#0F172A';
            unidadesInput.style.border = '1px solid rgba(255,255,255,0.15)';
            unidadesInput.style.color = 'white';
            unidadesInput.style.cursor = 'auto';
            unidadesInput.tabIndex = 0;
            unidadesInput.placeholder = '';
        }

        document.getElementById('modal-edit-ejecucion').style.display = 'flex';
    };

    window.cerrarModalEditarEjecucion = () => {
        document.getElementById('modal-edit-ejecucion').style.display = 'none';
    };

    window.guardarEditarEjecucion = async () => {
        const id = document.getElementById('edit-ejec-id').value;
        const fecha = document.getElementById('edit-ejec-fecha').value;
        const horasReales = parseFloat(document.getElementById('edit-ejec-horas').value);
        const unidadesReales = parseFloat(document.getElementById('edit-ejec-unidades').value);
        const observacion = document.getElementById('edit-ejec-observacion').value;

        if (!fecha || !horasReales || !unidadesReales) {
            showNotification('Por favor, rellene todos los campos obligatorios.', 'error');
            return;
        }

        const btn = document.querySelector('button[onclick="guardarEditarEjecucion()"]');
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        }

        try {
            await api.updateEjecucion(id, {
                fecha,
                horasReales,
                unidadesReales,
                observacion
            });
            showNotification('✓ Registro corregido con éxito', 'success');
            cerrarModalEditarEjecucion();
            App.navigate('ejecucion');
        } catch (e) {
            showNotification('Error al actualizar ejecución', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    window.eliminarEjecucionRegistro = async (id) => {
        if (!confirm('¿Está seguro de eliminar este registro de ejecución? Las horas del plan semanal se recalcularán automáticamente.')) {
            return;
        }

        try {
            await api.deleteEjecucion(id);
            showNotification('✓ Registro de ejecución eliminado', 'success');
            App.navigate('ejecucion');
        } catch (e) {
            showNotification('Error al eliminar ejecución', 'error');
        }
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
        const matchingRends = rendimientos.filter(r => r.actividad?.id === a.id);
        for (const r of matchingRends) {
            if (r.grupo) {
                const rg = r.grupo.toUpperCase();
                if (rg === cleanAreaCode || rg === cleanAreaNombre) return true;
            }
        }
        
        // Fallback 4: check if there's any Rendimiento mapping matching by NAME
        const hasMatchingYieldByName = rendimientos.some(r => 
            r.actividad?.nombre && a.nombre &&
            r.actividad.nombre.toUpperCase() === a.nombre.toUpperCase() &&
            r.grupo && (r.grupo.toUpperCase() === cleanAreaCode || r.grupo.toUpperCase() === cleanAreaNombre)
        );
};

    // ========== ESTADO ACTIVIDADES FUERA PLAN ==========
    let fueraGrupoActivo = null;
    let fueraCultivoActivo = null;
    let fueraLaborActiva = null;
    let fueraCultivosGrupo = [];
    let fueraRendimientosGrupo = [];
    let fueraFilasData = {};
    let fueraFilaCounter = 0;

    const getFueraCultivosDelGrupo = () => {
        const cultivosMap = new Map();
        fueraRendimientosGrupo.forEach(r => {
            if (r.productoCodigo) {
                cultivosMap.set(r.productoCodigo, r.producto);
            } else {
                cultivosMap.set('GENERAL', 'General');
            }
        });
        return Array.from(cultivosMap.entries()).map(([codigo, nombre]) => ({ codigo, nombre }));
    };

    const renderFueraCultivoCards = () => {
        const cultivos = getFueraCultivosDelGrupo();
        if (!cultivos.length) {
            return '<div style="color:var(--text-muted); text-align:center; padding:0.5rem;">Selecciona una actividad madre arriba</div>';
        }
        return cultivos.map(c => {
            const codigo = c.codigo || c;
            const nombre = c.nombre || c;
            const isActive = fueraCultivoActivo === codigo ? 'active' : '';
            return `
                <button class="cultivo-card ${isActive}" onclick="fueraSeleccionarCultivo('${codigo}')">
                    ${nombre}
                </button>
            `;
        }).join('');
    };

    const renderFueraLaborCards = () => {
        const labores = fueraGetLaboresUnicas();
        if (!labores.length) {
            return '<div style="color:var(--text-muted); text-align:center; padding:0.5rem; font-size:0.8rem;">Selecciona un cultivo</div>';
        }
        return labores.map(r => {
            const isActive = fueraLaborActiva === r.labor ? 'active' : '';
            return `
                <button class="labor-card ${isActive}" onclick="fueraSeleccionarLabor('${r.labor}')">
                    ${r.labor} <span style="opacity:0.7; font-size:0.65rem;">(${r.rendimiento})</span>
                </button>
            `;
        }).join('');
    };

    const fueraGetLaboresUnicas = () => {
        const laboresFiltradas = fueraCultivoActivo 
            ? fueraRendimientosGrupo.filter(r => r.productoCodigo === fueraCultivoActivo || r.producto.toUpperCase() === fueraCultivoActivo)
            : [];
        const laboresMap = new Map();
        laboresFiltradas.forEach(r => {
            if (!laboresMap.has(r.labor)) {
                laboresMap.set(r.labor, r);
            }
        });
        return Array.from(laboresMap.values());
    };

    const fueraGetPlaceholderUnidad = (unidadCodigo) => {
        switch(unidadCodigo) {
            case 'PLANTAS_HORA': return 'Plantas';
            case 'MALLAS_HORA': return 'Mallas';
            case 'PINGOS_HORA': return 'Pingos';
            case 'CAMAS_HORA':
            default: return 'Camas';
        }
    };

    const renderFueraFilaInput = (laborData, filaId, saved, esAdicional, unidadCodigo = 'CAMAS_HORA', placeholder = 'Camas', index = 1) => {
        const defaultIdeal = saved.cantidad ? (parseFloat(saved.cantidad) / laborData.rendimiento).toFixed(1) : '';
        const horasVal = saved.horas !== undefined ? saved.horas : defaultIdeal;
        return `
            <div data-fila="${filaId}" style="display:flex; align-items:center; gap:0.2rem; margin-bottom:0.2rem; padding:0.2rem; background:rgba(255,255,255,0.03); border-radius:4px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="font-weight:600; color:var(--text-muted); width:20px; text-align:center; font-size:0.8rem;">${index}</div>
                
                <input list="list-bloques" class="fuera-sel-bloque" data-fila="${filaId}" value="${saved.bloque || ''}" placeholder="Bloque"
                    style="flex:1.2; padding:0.35rem; background:#1E293B; color:white; border-radius:4px; border:1px solid rgba(255,255,255,0.15); font-size:0.85rem;"
                    onfocus="this.select()">

                <div style="width:65px; text-align:center; background:rgba(0,0,0,0.2); border-radius:4px; padding:0.35rem 0; font-size:0.75rem; color:#94A3B8; border:1px solid rgba(255,255,255,0.05);">
                    ${laborData.rendimiento}
                </div>

                <input type="number" class="fuera-inp-cantidad" data-fila="${filaId}" data-rend="${laborData.rendimiento}" 
                       data-actid="${laborData.actividadId}" data-unidad="${unidadCodigo}" value="${saved.cantidad || ''}"
                       placeholder="${placeholder}" oninput="fueraCalcHoras('${filaId}')" onfocus="this.select()"
                       style="width:85px; padding:0.35rem; background:#1E293B; color:white; border-radius:4px; border:1px solid rgba(255,255,255,0.15); font-size:0.9rem; text-align:center; font-weight:700;">
                
                <input type="number" step="0.1" class="fuera-inp-horas" data-fila="${filaId}" value="${horasVal}"
                       placeholder="Horas" onfocus="this.select()"
                       style="width:70px; padding:0.35rem; background:#1E293B; color:#10B981; border-radius:4px; border:1px solid rgba(255,255,255,0.15); font-size:0.9rem; text-align:center; font-weight:700;">

                <div style="min-width:60px; font-size:0.7rem; text-align:center; color:var(--text-muted);">
                    <span id="fuera-hrs-ideal-${filaId}">${saved.cantidad ? 'Idl: ' + (parseFloat(saved.cantidad) / laborData.rendimiento).toFixed(1) + 'h' : 'Idl: --'}</span>
                </div>

                <div style="display:flex; gap:0.2rem; margin-left: 0.2rem;">
                    ${!esAdicional ? 
                        `<button onclick="fueraAgregarFilaLabor(${laborData.id})" title="+ Bloque" 
                            style="width:26px; height:26px; background:rgba(59,130,246,0.15); color:#3B82F6; border:1px solid rgba(59,130,246,0.3); border-radius:4px; cursor:pointer; font-size:0.75rem;">
                            <i class="fa-solid fa-plus"></i>
                        </button>` : 
                        `<button onclick="fueraQuitarFilaLabor('${filaId}')" title="Quitar" 
                            style="width:26px; height:26px; background:rgba(239,68,68,0.15); color:#EF4444; border:1px solid rgba(239,68,68,0.3); border-radius:4px; cursor:pointer; font-size:0.75rem;">
                            <i class="fa-solid fa-minus"></i>
                        </button>`
                    }
                </div>
            </div>
        `;
    };

    const renderFueraLaborInput = () => {
        if (!fueraLaborActiva) {
            return `<div style="text-align:center; color:var(--text-muted); padding:1rem;">
                <i class="fa-solid fa-hand-pointer" style="font-size:1rem; margin-bottom:0.3rem; display:block;"></i>
                Selecciona una labor arriba
            </div>`;
        }
        
        const laborData = fueraRendimientosGrupo.find(r => r.labor === fueraLaborActiva && (r.productoCodigo === fueraCultivoActivo || r.producto.toUpperCase() === fueraCultivoActivo));
        if (!laborData) return '<div style="color:var(--text-muted); padding:1rem;">Labor no encontrada</div>';
        
        const unidadAbrev = laborData.unidadAbrev || 'cam/h';
        const unidadCodigo = laborData.unidadCodigo || 'CAMAS_HORA';
        const placeholder = fueraGetPlaceholderUnidad(unidadCodigo);
        
        const mainId = `fuera-main-${laborData.id}`;
        const saved = fueraFilasData[mainId] || {};
        const adicionales = Object.keys(fueraFilasData).filter(k => k.startsWith(`fuera-add-${laborData.id}-`));
        
        let html = `
            <div style="padding:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; padding:0.5rem; background:rgba(16,185,129,0.1); border-radius:8px; border:1px solid rgba(16,185,129,0.3);">
                    <span style="font-weight:600; color:#10B981; flex:1;">${laborData.labor}</span>
                    <span style="background:rgba(16,185,129,0.2); color:#10B981; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.8rem;">
                        ${laborData.rendimiento} ${unidadAbrev}
                    </span>
                </div>
        `;
        
        html += renderFueraFilaInput(laborData, mainId, saved, false, unidadCodigo, placeholder, 1);
        
        adicionales.forEach((filaId, index) => {
            const savedAd = fueraFilasData[filaId] || {};
            html += renderFueraFilaInput(laborData, filaId, savedAd, true, unidadCodigo, placeholder, index + 2);
        });
        
        html += '</div>';
        return html;
    };

    const renderFueraContenidoLabores = () => {
        const container = document.getElementById('fuera-contenido-labores');
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding:0.5rem 0.75rem; background:linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05)); border-bottom:1px solid rgba(16,185,129,0.3);">
                <div style="font-size:0.65rem; color:#10B981; margin-bottom:0.3rem; text-transform:uppercase; letter-spacing:1px; font-weight:600;">
                    <i class="fa-solid fa-filter" style="margin-right:0.3rem;"></i> Selección de Cultivo y Labor
                </div>
            </div>
            
            <div style="padding:0.75rem; display:flex; flex-direction:column; gap:0.75rem;">
                <!-- Selector de Cultivo -->
                <div id="fuera-cultivo-container" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                    ${renderFueraCultivoCards()}
                </div>
                
                <!-- Selector de Labor -->
                <div id="fuera-labor-container" style="display:flex; gap:0.4rem; flex-wrap:wrap; min-height:30px;">
                    ${renderFueraLaborCards()}
                </div>
                
                <!-- Area de Input -->
                <div id="fuera-labor-input" style="background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.05); min-height:80px;">
                    ${renderFueraLaborInput()}
                </div>
            </div>
        `;
    };

    const fueraGuardarValoresActuales = () => {
        document.querySelectorAll('#fuera-labor-input div[data-fila]').forEach(row => {
            const filaId = row.dataset.fila;
            const inp = row.querySelector('.fuera-inp-cantidad');
            const inpHrs = row.querySelector('.fuera-inp-horas');
            const sel = row.querySelector('.fuera-sel-bloque');
            if (inp && filaId) {
                fueraFilasData[filaId] = {
                    cantidad: inp.value || '',
                    horas: inpHrs ? inpHrs.value : '',
                    bloque: sel ? sel.value : ''
                };
            }
        });
    };

    window.fueraSeleccionarGrupo = async (grupo) => {
        fueraGuardarValoresActuales();
        fueraGrupoActivo = grupo;
        fueraCultivoActivo = null;
        fueraLaborActiva = null;
        fueraFilasData = {};
        
        document.querySelectorAll('.fuera-grupo-tab').forEach(t => {
            if (t.dataset.grupo === grupo) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        
        try {
            [fueraCultivosGrupo, fueraRendimientosGrupo] = await Promise.all([
                api.getCultivosPorGrupo(grupo),
                api.getRendimientosPorGrupo(grupo)
            ]);
        } catch(e) { fueraCultivosGrupo = []; fueraRendimientosGrupo = []; }
        
        renderFueraContenidoLabores();
    };

    window.fueraSeleccionarCultivo = (cultivo) => {
        fueraGuardarValoresActuales();
        fueraCultivoActivo = cultivo;
        fueraLaborActiva = null;
        fueraFilasData = {};
        
        const cultCont = document.getElementById('fuera-cultivo-container');
        const labCont = document.getElementById('fuera-labor-container');
        const labInp = document.getElementById('fuera-labor-input');
        
        if (cultCont) cultCont.innerHTML = renderFueraCultivoCards();
        if (labCont) labCont.innerHTML = renderFueraLaborCards();
        if (labInp) labInp.innerHTML = renderFueraLaborInput();
    };

    window.fueraSeleccionarLabor = (labor) => {
        fueraGuardarValoresActuales();
        fueraLaborActiva = labor;
        fueraFilasData = {};
        
        const labCont = document.getElementById('fuera-labor-container');
        const labInp = document.getElementById('fuera-labor-input');
        
        if (labCont) labCont.innerHTML = renderFueraLaborCards();
        if (labInp) labInp.innerHTML = renderFueraLaborInput();
    };

    window.fueraAgregarFilaLabor = (rendId) => {
        fueraGuardarValoresActuales();
        fueraFilaCounter++;
        const newFilaId = `fuera-add-${rendId}-${fueraFilaCounter}`;
        fueraFilasData[newFilaId] = { bloque: '', cantidad: '' };
        document.getElementById('fuera-labor-input').innerHTML = renderFueraLaborInput();
    };

    window.fueraQuitarFilaLabor = (filaId) => {
        fueraGuardarValoresActuales();
        delete fueraFilasData[filaId];
        document.getElementById('fuera-labor-input').innerHTML = renderFueraLaborInput();
    };

    window.fueraCalcHoras = (filaId) => {
        const inpCant = document.querySelector(`.fuera-inp-cantidad[data-fila="${filaId}"]`);
        const inpHrs = document.querySelector(`.fuera-inp-horas[data-fila="${filaId}"]`);
        const spanIdeal = document.getElementById(`fuera-hrs-ideal-${filaId}`);
        
        const cantidad = parseFloat(inpCant.value) || 0;
        const rend = parseFloat(inpCant.dataset.rend) || 1;
        
        if (cantidad > 0) {
            const horasIdeales = cantidad / rend;
            spanIdeal.textContent = 'Idl: ' + horasIdeales.toFixed(1) + 'h';
            
            // Si el input de horas reales está vacío, lo autorrellenamos con las horas ideales como sugerencia
            if (!inpHrs.value) {
                inpHrs.value = horasIdeales.toFixed(1);
            }
        } else {
            spanIdeal.textContent = 'Idl: --';
        }
    };

    window.fueraGuardarTodo = async () => {
        fueraGuardarValoresActuales();
        
        let guardados = 0;
        const todasLasFilas = document.querySelectorAll('#fuera-labor-input div[data-fila]');
        const itemsToSave = [];
        
        for (const fila of todasLasFilas) {
            const filaId = fila.dataset.fila;
            const inp = fila.querySelector('.fuera-inp-cantidad');
            const inpHrs = fila.querySelector('.fuera-inp-horas');
            const sel = fila.querySelector('.fuera-sel-bloque');
            const cantidad = parseFloat(inp?.value) || 0;
            const bloque = sel?.value || '';
            const horasReales = parseFloat(inpHrs?.value) || 0;
            
            if (cantidad <= 0) continue;
            
            const rend = parseFloat(inp.dataset.rend) || 1;
            const actId = parseInt(inp.dataset.actid);
            const esCosechaGroup = fueraGrupoActivo === 'COSECHA';
            
            if (!esCosechaGroup && !bloque) {
                showNotification('El bloque es obligatorio para todas las actividades.', 'warning');
                return;
            }
            
            if (horasReales <= 0) {
                showNotification('Las horas reales deben ser mayores a 0.', 'warning');
                return;
            }
            
            let horasPlanificacion;
            if (esCosechaGroup) {
                const tallosMalla = TALLOS_POR_MALLA[fueraCultivoActivo] || 25;
                horasPlanificacion = (cantidad / tallosMalla) / rend;
            } else {
                horasPlanificacion = cantidad / rend;
            }
            
            itemsToSave.push({
                actividadId: actId,
                bloque: bloque || null,
                unidades: cantidad,
                rendimiento: rend,
                horasPlanificacion: horasPlanificacion,
                horasReales: horasReales
            });
        }
        
        if (itemsToSave.length === 0) {
            showNotification('Ingresa al menos una cantidad mayor a 0', 'warning');
            return;
        }
        
        const btn = document.getElementById('fuera-btn-guardar');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GUARDANDO...'; }
        
        try {
            for (const item of itemsToSave) {
                const actividad = actividades.find(a => a.id == item.actividadId);
                const esFerti = actividad?.area?.codigo?.includes('FERTIRRIEGO');
                
                // 1. Crear planificación semanal
                const newPlan = await api.createPlanificacion({
                    semana: { id: semanaActual.id },
                    actividad: { id: item.actividadId },
                    bloque: esFerti ? null : item.bloque,
                    valvulas: esFerti ? item.bloque : null,
                    unidadesPlanificadas: item.unidades,
                    rendimientoUsado: item.rendimiento,
                    horasCalculadas: item.horasPlanificacion,
                    horasAjustadas: item.horasPlanificacion
                });
                
                // 2. Registrar la ejecución real inmediatamente
                if (newPlan && newPlan.id) {
                    const rendimientoReal = item.unidades / item.horasReales;
                    await api.createEjecucion({
                        planificacion: { id: newPlan.id },
                        semana: { id: semanaActual.id },
                        fecha: fechaSeleccionada,
                        horasReales: item.horasReales,
                        unidadesReales: item.unidades,
                        rendimientoReal: rendimientoReal,
                        observacion: '[EJECUCION IMPREVISTA]'
                    });
                }
                guardados++;
            }
            
            showNotification(`✓ Se agregaron ${guardados} actividades fuera de plan.`, 'success');
            // Recargar vista
            App.navigate('ejecucion');
        } catch (e) {
            console.error(e);
            showNotification('Error al guardar actividades fuera de plan', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> GUARDAR ACTIVIDADES FUERA PLAN'; }
        }
    };

    // Toggle sección agregar
    window.toggleSeccionAgregar = () => {
        const contenido = document.getElementById('agregar-contenido');
        const icono = document.getElementById('agregar-toggle-icon');
        if (contenido.style.display === 'none') {
            contenido.style.display = 'block';
            icono.className = 'fa-solid fa-chevron-up';
        } else {
            contenido.style.display = 'none';
            icono.className = 'fa-solid fa-chevron-down';
        }
    };
    
    // Renderizar opciones de áreas
    const renderAreasOptions = () => {
        if (areas.length === 0) return '<option value="">Sin áreas</option>';
        return '<option value="">Seleccionar área...</option>' + 
            areas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
    };
    
    // Renderizar tabla de ejecución DIARIA (basada en el plan semanal y ejecuciones)
    window.renderPlanificacionParaEjecutar = () => {
        if (grupoActivo !== 'COSECHA' && !subActividadActiva) {
            return `
                <tr>
                    <td colspan="11" style="text-align:center; color:var(--text-muted); padding:3rem;">
                        <i class="fa-solid fa-hand-pointer" style="font-size:2rem; margin-bottom:0.5rem; display:block; opacity:0.5; color:var(--primary);"></i>
                        Selecciona una sub-actividad arriba para empezar a registrar
                    </td>
                </tr>
            `;
        }

        const elementosParaMostrar = planificacionItems.filter(p => {
            if (!p || p.grupoCalculado !== grupoActivo) return false;
            
            const pCultivo = (p.producto || p.actividad?.producto)?.codigo || 'GENERAL';
            if (grupoActivo !== 'COSECHA' && pCultivo !== cultivoActivoDiario) return false;
            
            if (grupoActivo !== 'COSECHA' && subActividadActiva && subActividadActiva !== 'TODAS' && p.actividad?.nombre !== subActividadActiva) return false;
            
            return true;
        });

        if (elementosParaMostrar.length === 0) {
            return `
                <tr>
                    <td colspan="11" style="text-align:center; color:var(--text-muted); padding:2rem;">
                        <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; margin-bottom:0.5rem; display:block; opacity:0.5;"></i>
                        No hay actividades planificadas para la categoría <strong>${grupoActivo}</strong> en esta semana.
                    </td>
                </tr>
            `;
        }

        // Agrupar por Cultivo
        const porCultivo = {};
        elementosParaMostrar.forEach(p => {
            const cultivoKey = p.actividad?.producto?.nombre || 'GENERAL';
            if (!porCultivo[cultivoKey]) porCultivo[cultivoKey] = [];
            porCultivo[cultivoKey].push(p);
        });

        const cultivosOrdenados = Object.keys(porCultivo).sort();
        let html = '';

        cultivosOrdenados.forEach(cultivoName => {
            const itemsCultivo = porCultivo[cultivoName];
            
            // Fila separadora si estamos en cosecha
            if (grupoActivo === 'COSECHA') {
                html += `
                    <tr style="background:rgba(245,158,11,0.05); font-weight:bold; border-left:3px solid #F59E0B;">
                        <td colspan="11" style="padding:0.5rem 0.8rem; color:#F59E0B; font-size:0.8rem; font-weight:700;">
                            <i class="fa-solid fa-leaf" style="margin-right:0.3rem;"></i> CULTIVO: ${cultivoName.toUpperCase()}
                        </td>
                    </tr>
                `;
            }

            itemsCultivo.forEach(p => {
                const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'OTRO').toUpperCase();
                const isCosecha = rawName.includes('COSECHA');
                
                const rendRelacionado = rendimientos.find(r => r.actividad?.id === p.actividad?.id && (!p.actividad?.producto || r.producto?.id === p.actividad?.producto?.id));
                const getPlaceholderUnidad = (unidadCodigo) => {
                    switch(unidadCodigo) {
                        case 'PLANTAS_HORA': return 'Pts';
                        case 'MALLAS_HORA': return 'Mallas';
                        case 'PINGOS_HORA': return 'Pingos';
                        case 'CAMAS_HORA': return 'Camas';
                        default: return 'unid';
                    }
                };
                const unidadPlaceholder = isCosecha ? 'Tallos' : getPlaceholderUnidad(rendRelacionado?.unidad?.codigo);
                
                const ejecsSemana = ejecuciones.filter(e => e.planificacion?.id === p.id);
                const ejecsOtrosDias = ejecsSemana.filter(e => e.fecha !== fechaSeleccionada);
                const horasEjecOtros = ejecsOtrosDias.reduce((sum, e) => sum + (e.horasReales || 0), 0);
                const unidadesEjecOtros = ejecsOtrosDias.reduce((sum, e) => sum + (e.unidadesReales || 0), 0);

                const horasPlanSemana = p.horasAjustadas || p.horasCalculadas || 0;
                const unidadesPlanSemana = p.unidadesPlanificadas || 0;

                const horasDisponiblesHoy = Math.max(0, horasPlanSemana - horasEjecOtros);
                const unidadesDisponiblesHoy = Math.max(0, unidadesPlanSemana - unidadesEjecOtros);
                
                const ejecsHoy = ejecsSemana.filter(e => e.fecha === fechaSeleccionada);
                const horasEjecutadasHoy = ejecsHoy.reduce((sum, e) => sum + (e.horasReales || 0), 0);
                const unidadesEjecutadasHoy = ejecsHoy.reduce((sum, e) => sum + (e.unidadesReales || 0), 0);
                
                const totalHorasEjecutadasSemana = ejecsSemana.reduce((sum, e) => sum + (e.horasReales || 0), 0);
                const totalUnidadesEjecutadasSemana = ejecsSemana.reduce((sum, e) => sum + (e.unidadesReales || 0), 0);
                const completado = totalHorasEjecutadasSemana >= horasPlanSemana && horasPlanSemana > 0;
                
                const pdcto = p.producto || p.actividad?.producto;
                const dsc = (pdcto && pdcto.nombre) ? `${pdcto.nombre} - ${p.actividad?.nombre || ''}` : (p.actividad?.nombre || '-');
                
                html += `
                    <tr data-id="${p.id}" data-producto-codigo="${pdcto ? pdcto.codigo : ''}" data-is-cosecha="${isCosecha}" style="${completado ? 'opacity:0.6;' : ''}">
                        <td>
                            ${completado ? '<i class="fa-solid fa-check-circle" style="color:#10B981;"></i>' : '<i class="fa-regular fa-circle" style="color:var(--text-muted);"></i>'}
                        </td>
                        <td>${p.actividad?.area?.nombre || '-'}</td>
                        <td>
                            <strong>${dsc}</strong>
                        </td>
                        <td>${p.bloque || p.valvulas || '-'}</td>
                        <td style="text-align:right;">
                            <span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; display:block; margin-bottom:2px;" title="Planificado Semana: ${unidadesPlanSemana.toFixed(0)}">Disp: ${unidadesDisponiblesHoy.toFixed(0)} / ${unidadesPlanSemana.toFixed(0)} ${unidadPlaceholder}</span>
                            <span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; display:block;" title="Planificado Semana: ${horasPlanSemana.toFixed(1)}h">Disp: ${horasDisponiblesHoy.toFixed(1)} / ${horasPlanSemana.toFixed(1)}h</span>
                        </td>
                        <td style="text-align:right;">
                            <span class="badge" style="background:${completado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}; color:${completado ? '#A7F3D0' : '#FCD34D'}; display:block; margin-bottom:2px;" title="Ejecutado Semana: ${totalUnidadesEjecutadasSemana.toFixed(0)}">
                                Hoy: ${unidadesEjecutadasHoy.toFixed(0)} (${totalUnidadesEjecutadasSemana.toFixed(0)})
                            </span>
                            <span class="badge" style="background:${completado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}; color:${completado ? '#A7F3D0' : '#FCD34D'}; display:block;" title="Ejecutado Semana: ${totalHorasEjecutadasSemana.toFixed(1)}h">
                                Hoy: ${horasEjecutadasHoy.toFixed(1)}h (${totalHorasEjecutadasSemana.toFixed(1)}h)
                            </span>
                        </td>
                        <td style="text-align:center; font-weight:bold; color:var(--text-muted); font-size:0.8rem;">
                            ${unidadPlaceholder}
                        </td>
                        ${!completado ? `
                            <td style="text-align:center;">
                                <input type="number" id="unidades-real-${p.id}" placeholder="${unidadesDisponiblesHoy.toFixed(0)}" min="0" onfocus="this.select()"
                                       oninput="calcularRendimientoReal(${p.id})"
                                       ${isCosecha ? 'readonly tabindex="-1"' : ''}
                                       style="width:70px; padding:0.3rem; border-radius:6px; background:${isCosecha ? 'rgba(255,255,255,0.05)' : 'var(--surface-glass)'}; border:1px solid ${isCosecha ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'}; color:${isCosecha ? '#94A3B8' : 'white'}; text-align:center; cursor:${isCosecha ? 'not-allowed' : 'auto'};">
                            </td>
                            <td style="text-align:center;">
                                <input type="number" id="horas-real-${p.id}" placeholder="${horasDisponiblesHoy.toFixed(1)}" step="0.5" min="0" onfocus="this.select()"
                                       oninput="calcularRendimientoReal(${p.id})"
                                       style="width:70px; padding:0.3rem; border-radius:6px; background:var(--surface-glass); border:1px solid rgba(255,255,255,0.2); color:white; text-align:center;">
                            </td>
                            <td style="text-align:center;">
                                <span id="rend-real-${p.id}" style="color:var(--text-muted);">--</span>
                            </td>
                            <td>
                                <button class="btn btn-primary" style="padding:0.4rem 0.8rem; background:linear-gradient(135deg, #10B981, #059669); border:none;" onclick="guardarEjecucionLinea(${p.id})" title="Guardar avance">
                                    <i class="fa-solid fa-floppy-disk"></i>
                                </button>
                            </td>
                        ` : `
                            <td colspan="4" style="text-align:center; color:#10B981;"><i class="fa-solid fa-check-double"></i> Completado (${totalUnidadesEjecutadasSemana.toFixed(0)} u)</td>
                        `}
                    </tr>
                `;
            });
        });

        return html;
    };
    
    // Generar opciones de días de la semana
    const renderDiasSemana = () => {
        if (!semanaActual) return '';
        
        const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const [sy, sm, sd] = semanaActual.fechaInicio.split('T')[0].split('-');
        const fechaInicioLocal = new Date(sy, sm - 1, sd);
        let html = '<div style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem;">';
        
        for (let i = 0; i < 7; i++) {
            const cDate = new Date(fechaInicioLocal);
            cDate.setDate(cDate.getDate() + i);
            const fechaStr = getLocalIsoDate(cDate);
            
            const esMañana = fechaStr === fechaManana;
            const esHoy = fechaStr === fechaHoy;
            const esSeleccionado = fechaStr === fechaSeleccionada;
            
            html += `
                <button class="dia-btn ${esSeleccionado ? 'active' : ''}" 
                        onclick="cambiarFechaEjecucion('${fechaStr}')"
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

    // Renderizar historial de ejecuciones agrupado
    const renderHistorialEjecuciones = (ejecsFiltradas) => {
        if (!ejecsFiltradas || ejecsFiltradas.length === 0) return '';

        // Filtrar ejecuciones por el grupo activo
        const ejecsFiltradasGrupo = ejecsFiltradas.filter(e => {
            const rawName = (e.planificacion?.actividad?.laborMadre || e.actividad?.laborMadre || 'OTRO').toUpperCase();
            const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
            return grupo === grupoActivo;
        });

        if (ejecsFiltradasGrupo.length === 0) {
            return `
                <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.9rem;">
                    No hay registros de ejecución para la categoría <strong>${grupoActivo}</strong> en este día.
                </div>
            `;
        }

        const getNombreDiaSemana = (fechaStr) => {
            const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const [y, m, d] = fechaStr.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            return diasNombres[date.getDay()];
        };

        // Agrupar
        const agrupados = {};
        ejecsFiltradasGrupo.forEach(e => {
            const fecha = e.fecha || 'Sin Fecha';
            
            const rawName = (e.planificacion?.actividad?.laborMadre || e.actividad?.laborMadre || 'OTRO').toUpperCase();
            const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
            
            const cultivo = (e.planificacion?.actividad?.producto?.nombre || e.actividad?.producto?.nombre || 'GENERAL').toUpperCase();
            
            if (!agrupados[fecha]) agrupados[fecha] = {};
            if (!agrupados[fecha][grupo]) agrupados[fecha][grupo] = {};
            if (!agrupados[fecha][grupo][cultivo]) agrupados[fecha][grupo][cultivo] = [];
            
            agrupados[fecha][grupo][cultivo].push(e);
        });

        // Ordenar fechas descendente
        const fechasOrdenadas = Object.keys(agrupados).sort((a, b) => b.localeCompare(a));
        
        // Mantener registro de qué días están expandidos (por defecto, todos los que se muestran)
        if (window.historialExpandido === undefined) {
            window.historialExpandido = {};
        }
        fechasOrdenadas.forEach(fecha => {
            if (window.historialExpandido[fecha] === undefined) {
                window.historialExpandido[fecha] = true; // Abierto por defecto
            }
        });

        window.toggleDiaHistorial = (fecha) => {
            window.historialExpandido[fecha] = !window.historialExpandido[fecha];
            const hDiv = document.getElementById('historial-ejecuciones-dinamico');
            if (hDiv) hDiv.innerHTML = renderHistorialEjecuciones(ejecsFiltradas);
        };

        return fechasOrdenadas.map(fecha => {
            const abierto = !!window.historialExpandido[fecha];
            const grupos = agrupados[fecha];
            const totalHorasDia = Object.values(grupos).reduce((sumG, g) => 
                sumG + Object.values(g).reduce((sumC, cList) => 
                    sumC + cList.reduce((sumE, e) => sumE + (e.horasReales || 0), 0)
                , 0)
            , 0);

            let htmlDia = `
                <div class="dia-historial-container" style="margin-bottom:1rem; border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden; background:rgba(255,255,255,0.01);">
                    <!-- CABECERA DIA -->
                    <div onclick="toggleDiaHistorial('${fecha}')" 
                         style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 1rem; background:rgba(255,255,255,0.04); cursor:pointer; user-select:none;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <i class="fa-solid ${abierto ? 'fa-chevron-down' : 'fa-chevron-right'}" style="color:var(--primary); font-size: 0.8rem;"></i>
                            <span style="font-size:0.85rem; font-weight:600; color:white;">
                                <i class="fa-solid fa-calendar-day" style="opacity:0.7; margin-right:0.3rem; font-size: 0.8rem;"></i> 
                                <span style="text-transform: capitalize;">${getNombreDiaSemana(fecha)}</span> (${fecha})
                            </span>
                        </div>
                        <span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; font-weight:bold; font-size:0.75rem; padding: 0.2rem 0.6rem;">
                            ${totalHorasDia.toFixed(1)}h ejecutadas
                        </span>
                    </div>
                    
                    <!-- CONTENIDO DIA -->
                    <div style="display:${abierto ? 'block' : 'none'}; padding:1rem; border-top:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.15);">
            `;

            // Recorrer grupos
            const gruposOrdenados = Object.keys(grupos).sort();
            gruposOrdenados.forEach(grupo => {
                const cultivos = grupos[grupo];
                htmlDia += `
                    <div style="margin-bottom:1rem; border-left:3px solid var(--primary); padding-left:0.75rem;">
                        <h4 style="color:var(--primary); text-transform:uppercase; font-size:0.9rem; font-weight:800; margin-bottom:0.5rem; letter-spacing:0.5px;">
                            ${grupo}
                        </h4>
                `;

                // Recorrer cultivos
                const cultivosOrdenados = Object.keys(cultivos).sort();
                cultivosOrdenados.forEach(cultivo => {
                    const ejecs = cultivos[cultivo];
                    const ejecsOrdenadas = [...ejecs].sort((a, b) => {
                        const nameA = (a.planificacion?.actividad?.nombre || a.actividad?.nombre || '').toUpperCase();
                        const nameB = (b.planificacion?.actividad?.nombre || b.actividad?.nombre || '').toUpperCase();
                        return nameA.localeCompare(nameB);
                    });
                    htmlDia += `
                        <div style="margin-bottom:0.5rem; margin-left:0.5rem;">
                            <h5 style="color:#F59E0B; font-size:0.8rem; font-weight:700; margin-bottom:0.3rem;">
                                <i class="fa-solid fa-leaf" style="font-size:0.75rem; margin-right:0.25rem;"></i> CULTIVO: ${cultivo}
                            </h5>
                            
                            <table style="width:100%; font-size:0.8rem; border-collapse:collapse; margin-bottom:0.5rem; background:rgba(255,255,255,0.02); border-radius:6px; overflow:hidden;">
                                <thead>
                                    <tr style="background:rgba(0,0,0,0.3); color:var(--text-muted); text-transform:uppercase; font-size:0.65rem;">
                                        <th style="padding:0.4rem 0.6rem;">Actividad</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:center;">Bloque</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:center;">Tipo</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:right;">Horas</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:right;">Unidades</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:center;">Rendimiento</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:center; width:100px;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ejecsOrdenadas.map(e => {
                                        const esImprevisto = !e.planificacion && e.observacion?.includes('[IMPREVISTO]');
                                        const actNombre = e.planificacion?.actividad?.nombre || e.actividad?.nombre || '-';
                                        const bloqueStr = e.planificacion?.bloque || e.planificacion?.valvulas || '-';
                                        const obsEscapada = (e.observacion || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                                        
                                        return `
                                            <tr style="border-top:1px solid rgba(255,255,255,0.03);">
                                                <td style="padding:0.5rem 0.6rem;">
                                                    <strong>${actNombre}</strong>
                                                    ${e.observacion ? `<br><small style="color:var(--text-muted); font-style:italic;">"${e.observacion}"</small>` : ''}
                                                </td>
                                                <td style="padding:0.5rem 0.6rem; text-align:center; color:white;">${bloqueStr}</td>
                                                <td style="padding:0.5rem 0.6rem; text-align:center;">
                                                    ${esImprevisto 
                                                        ? '<span class="badge" style="background:rgba(245, 158, 11, 0.2); color:#FCD34D; font-size:0.65rem; padding:0.1rem 0.3rem;">IMPREV.</span>' 
                                                        : '<span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; font-size:0.65rem; padding:0.1rem 0.3rem;">PLAN.</span>'}
                                                </td>
                                                <td style="padding:0.5rem 0.6rem; text-align:right; font-weight:600; color:white;">${(e.horasReales || 0).toFixed(1)}h</td>
                                                <td style="padding:0.5rem 0.6rem; text-align:right; font-weight:600; color:white;">${(e.unidadesReales || 0).toLocaleString()}</td>
                                                <td style="padding:0.5rem 0.6rem; text-align:center;">
                                                    <span class="badge" style="background:rgba(16, 185, 129, 0.15); color:#A7F3D0; font-size:0.7rem;">
                                                        ${(e.rendimientoReal || 0).toFixed(1)} u/h
                                                    </span>
                                                </td>
                                                <td style="padding:0.5rem 0.6rem; text-align:center;">
                                                    <div style="display:flex; gap:0.3rem; justify-content:center;">
                                                        <button class="btn btn-sm" onclick="abrirModalEditarEjecucion(${e.id}, '${e.fecha}', ${e.horasReales}, ${e.unidadesReales}, '${obsEscapada}')"
                                                                style="padding:3px 6px; font-size:0.75rem; border:1px solid rgba(59, 130, 246, 0.3); color:#93C5FD; background:rgba(59, 130, 246, 0.1); cursor:pointer; border-radius:4px;">
                                                            <i class="fa-solid fa-pencil"></i>
                                                        </button>
                                                        <button class="btn btn-sm" onclick="eliminarEjecucionRegistro(${e.id})"
                                                                style="padding:3px 6px; font-size:0.75rem; border:1px solid rgba(239, 68, 68, 0.3); color:#FCA5A5; background:rgba(239, 68, 68, 0.1); cursor:pointer; border-radius:4px;">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                });

                htmlDia += `</div>`;
            });

            htmlDia += `
                    </div>
                </div>
            `;
            return htmlDia;
        }).join('');
    };

    // ========== NAVEGACION CON TECLADO EJECUCION ==========
    const configurarNavegacionTecladoEjecucion = () => {
        const contenedor = document.getElementById('grid-container-ejecucion');
        if (!contenedor) return;

        contenedor.addEventListener('keydown', (e) => {
            const keys = ['Enter', 'ArrowUp', 'ArrowDown'];
            if (!keys.includes(e.key)) return;

            const target = e.target;
            const isUnidades = target.id && target.id.startsWith('unidades-real-');
            const isHoras = target.id && target.id.startsWith('horas-real-');
            if (!isUnidades && !isHoras) return;

            const selector = isUnidades ? 'input[id^="unidades-real-"]' : 'input[id^="horas-real-"]';
            const allInputs = Array.from(contenedor.querySelectorAll(selector));
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
        
        contenedor.addEventListener('focusin', (e) => {
            if (e.target.id && (e.target.id.startsWith('unidades-real-') || e.target.id.startsWith('horas-real-'))) {
                e.target.select();
            }
        });
    };

    if (window.historialGlobalExpandido === undefined) {
        window.historialGlobalExpandido = false;
    }
    
    window.toggleHistorialGlobal = () => {
        window.historialGlobalExpandido = !window.historialGlobalExpandido;
        App.navigate('ejecucion');
    };

    const inicioFechaSemana = semanaActual?.fechaInicio ? semanaActual.fechaInicio.split('T')[0] : '';
    const finFechaSemana = semanaActual?.fechaFin ? semanaActual.fechaFin.split('T')[0] : '';
    const ejecucionesFiltradas = ejecuciones.filter(e => e.fecha === fechaSeleccionada);

    const getEjecucionesFiltradasGrupo = () => {
        return ejecucionesFiltradas.filter(e => {
            const rawName = (e.planificacion?.actividad?.laborMadre || e.actividad?.laborMadre || 'OTRO').toUpperCase();
            const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
            return grupo === grupoActivo;
        });
    };

    const renderHistorialCardCompleto = () => {
        const ejecsFiltradasGrupo = getEjecucionesFiltradasGrupo();
        if (ejecsFiltradasGrupo.length === 0) return '';

        return `
            <div class="card" style="margin-top:1.5rem; border: 1px solid rgba(139, 92, 246, 0.2);">
                <div onclick="window.toggleHistorialGlobal()" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                    <h3 style="margin:0;"><i class="fa-solid fa-history" style="color:var(--secondary); margin-right:0.5rem;"></i> Historial de Ejecuciones del Día <span class="badge" style="margin-left:0.5rem; background:var(--secondary); color:white;">${ejecsFiltradasGrupo.length}</span></h3>
                    <i class="fa-solid ${window.historialGlobalExpandido ? 'fa-chevron-up' : 'fa-chevron-down'}" style="color:var(--text-muted);"></i>
                </div>
                <div id="historial-ejecuciones-dinamico" style="margin-top:1.5rem; display:${window.historialGlobalExpandido ? 'block' : 'none'};">
                    ${renderHistorialEjecuciones(ejecucionesFiltradas)}
                </div>
            </div>
        `;
    };

    const renderInfoGrupoEjecucion = () => {
        if (!grupoActivo) return '';

        // Horas planificadas de la SEMANA para el grupo activo
        const planGrupoSemana = planificacionItems.filter(p => p && p.grupoCalculado === grupoActivo);
        const horasPlanGrupoSemana = planGrupoSemana.reduce((sum, p) => sum + (p.horasAjustadas || p.horasCalculadas || 0), 0);

        // Horas ejecutadas de la SEMANA para el grupo activo
        const ejecsGrupoSemana = ejecuciones.filter(e => {
            const rawName = (e.planificacion?.actividad?.laborMadre || e.actividad?.laborMadre || 'OTRO').toUpperCase();
            const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
            return grupo === grupoActivo;
        });
        const horasEjecGrupoSemana = ejecsGrupoSemana.reduce((sum, e) => sum + (e.horasReales || 0), 0);

        // Horas ejecutadas de HOY para el grupo activo
        const horasEjecGrupoHoy = ejecsGrupoSemana
            .filter(e => e.fecha === fechaSeleccionada)
            .reduce((sum, e) => sum + (e.horasReales || 0), 0);

        const pctGrupoSemana = horasPlanGrupoSemana > 0 ? Math.min(100, (horasEjecGrupoSemana / horasPlanGrupoSemana) * 100) : 0;

        // Color según el porcentaje de avance
        const getPctColor = (pct) => {
            if (pct < 30) return '#EF4444'; // Rojo
            if (pct < 75) return '#F59E0B'; // Naranja
            return '#10B981'; // Verde
        };
        const activeColor = getPctColor(pctGrupoSemana);

        return `
            <div id="info-grupo-card" style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8)); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1.25rem; border-radius: 12px; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; background:rgba(59, 130, 246, 0.15); color:#60A5FA; font-size:1.1rem; border:1px solid rgba(59, 130, 246, 0.25);">
                            <i class="fa-solid fa-business-time"></i>
                        </span>
                        <div>
                            <h4 style="margin:0; font-size:0.95rem; text-transform:uppercase; color:white; letter-spacing:0.5px;">Resumen de ${grupoActivo}</h4>
                            <span style="font-size:0.75rem; color:var(--text-muted);">Monitoreo de horas asignadas y avance</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:1rem; align-items:center;">
                        <div style="text-align:right;">
                            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Horas Hoy:</span>
                            <span style="font-size:1.25rem; font-weight:700; color:#FCD34D;">${horasEjecGrupoHoy.toFixed(1)}h</span>
                        </div>
                        <div style="width:1px; height:25px; background:rgba(255,255,255,0.1);"></div>
                        <div style="text-align:right;">
                            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Total Semana:</span>
                            <span style="font-size:1.25rem; font-weight:700; color:#60A5FA;">${horasEjecGrupoSemana.toFixed(1)}h / ${horasPlanGrupoSemana.toFixed(1)}h</span>
                        </div>
                    </div>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                        <span style="color:var(--text-muted);">Avance Semanal de la Labor:</span>
                        <span style="color:${activeColor}; font-weight:700;">${pctGrupoSemana.toFixed(0)}% Completado</span>
                    </div>
                    <div style="height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.03);">
                        <div style="height:100%; width:${pctGrupoSemana}%; background:linear-gradient(90deg, #3B82F6, ${activeColor}); border-radius:4px; transition:width 0.4s ease-out;"></div>
                    </div>
                </div>
            </div>
        `;
    };

    setTimeout(() => {
        configurarNavegacionTecladoEjecucion();
        if (grupoActivo === 'COSECHA') {
            window.sincronizarCosechaApi();
        }
    }, 100);

    return `
        <div class="fade-in">
            <!-- Header con resumen -->
            <div class="top-actions" style="margin-bottom: 1rem; justify-content: space-between;">
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <span style="color:var(--text-muted);">Ejecutando:</span>
                    <span class="badge" style="font-size:1rem; padding:0.5rem 1rem; background:rgba(16, 185, 129, 0.2); color:#A7F3D0;">
                        ${semanaActual ? `Semana ${semanaActual.codigoAass}` : 'Sin semana activa'}
                    </span>
                </div>
                <div style="display:flex; gap:1rem; align-items:center;">
                    <div style="text-align:right;">
                        <span style="font-size:0.8rem; color:var(--text-muted);">Avance (Semana):</span>
                        <span style="font-size:1.2rem; font-weight:600; color:${porcentajeEjecucion >= 80 ? '#10B981' : porcentajeEjecucion >= 50 ? '#F59E0B' : '#EF4444'};">
                            ${porcentajeEjecucion.toFixed(0)}%
                        </span>
                    </div>
                    <div style="width:150px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                        <div style="width:${porcentajeEjecucion}%; height:100%; background:linear-gradient(90deg, #10B981, #3B82F6); transition:width 0.5s;"></div>
                    </div>
                    ${totalHorasImprevistas > 0 ? `<div style="text-align:right; margin-left:1rem; padding-left:1rem; border-left:1px solid rgba(255,255,255,0.1);"><span style="font-size:0.8rem; color:#F59E0B;">Imprevistos:</span><span style="font-size:1.1rem; font-weight:600; color:#FCD34D;"> ${totalHorasImprevistas.toFixed(1)}h</span></div>` : ''}
                </div>
            </div>
            
            ${renderDiasSemana()}

            <div id="info-grupo-ejecucion-wrapper" style="margin-top: 1rem;">
                ${renderInfoGrupoEjecucion()}
            </div>
            
            <!-- Tabla principal de ejecución -->
            <div class="card" style="margin-top:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3><i class="fa-solid fa-hammer" style="color:var(--primary); margin-right:0.5rem;"></i> Ejecutar Actividades Planificadas</h3>
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <div style="font-size:0.9rem; color:var(--text-muted); text-align:right;">
                            ${totalHorasEjecutadas.toFixed(1)}h de ${totalHorasPlanificadas.toFixed(1)}h planificadas
                        </div>

                        <button class="btn btn-primary" onclick="guardarTodoEjecucion()" 
                                style="background:linear-gradient(135deg, #10B981, #059669); border:none; font-weight:800; font-size:0.95rem; padding:0.8rem 1.5rem; border-radius:8px; box-shadow:0 4px 15px rgba(16, 185, 129, 0.4); letter-spacing:0.5px; text-transform:uppercase; display:inline-flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <i class="fa-solid fa-floppy-disk"></i> GUARDAR AVANCES DE EJECUCIÓN DEL DÍA
                        </button>
                    </div>
                </div>
                
                <p style="color:var(--text-muted); margin-bottom:1rem; font-size:0.9rem;">
                    <i class="fa-solid fa-info-circle"></i> Ingresa las horas y unidades reales para cada actividad. El rendimiento real se calcula automáticamente.
                </p>
                
                <!-- GRUPO TABS -->
                <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:1rem; border-radius:8px;">
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:1px;">Filtro de Actividad Madre</div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.75rem;">
                        ${renderGrupoTabs()}
                    </div>
                    <div id="cultivos-ejecucion-container">
                        ${renderCultivoTabsDiario()}
                    </div>
                    <div id="subactividades-ejecucion-container">
                        ${renderSubActividadesTabsDiario()}
                    </div>
                </div>
                
                <div style="overflow-x:auto;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:30px;"></th>
                                <th>Área</th>
                                <th>Actividad</th>
                                <th>Bloque</th>
                                <th style="text-align:right;">Plan.</th>
                                <th style="text-align:right;">Ejec.</th>
                                <th style="text-align:center;">Unidad</th>
                                <th style="text-align:center;">Cant. Real</th>
                                <th style="text-align:center;">Horas Real</th>
                                <th style="text-align:center;">Rend.</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="grid-container-ejecucion">
                            ${window.renderPlanificacionParaEjecutar()}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- NUEVO: Sección Agregar Línea Fuera de Planificación con flujo de plan semanal -->
            <div class="card" style="margin-top:1.5rem; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding: 1rem;" onclick="toggleSeccionAgregar()">
                    <h3 style="margin:0;"><i class="fa-solid fa-plus-circle" style="color:#10B981; margin-right:0.5rem;"></i> Llenar Actividades Fuera de Planificación</h3>
                    <i id="agregar-toggle-icon" class="fa-solid fa-chevron-down" style="color:var(--text-muted);"></i>
                </div>
                
                <div id="agregar-contenido" style="display:none; border-top: 1px solid rgba(255,255,255,0.1);">
                    <!-- GRUPO TABS -->
                    <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.1);">
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:1px;">Actividad Madre</div>
                        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                            ${fueraGrupos.map(g => {
                                const grupoNombre = typeof g === 'string' ? g : (g.nombre || g.codigo || String(g));
                                const isActive = fueraGrupoActivo === grupoNombre ? 'active' : '';
                                return `<button class="grupo-tab fuera-grupo-tab ${isActive}" data-grupo="${grupoNombre}" onclick="fueraSeleccionarGrupo('${grupoNombre}')">${grupoNombre}</button>`;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div id="fuera-contenido-labores">
                        <div style="padding:1rem; text-align:center; color:var(--text-muted);">
                            <i class="fa-solid fa-hand-pointer" style="font-size:1.5rem; margin-bottom:0.5rem; display:block;"></i>
                            Selecciona una actividad madre arriba
                        </div>
                    </div>
                    
                    <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.1);">
                        <button id="fuera-btn-guardar" onclick="fueraGuardarTodo()" 
                            style="width:100%; padding:0.75rem; background:linear-gradient(135deg, #10B981, #059669); 
                                   color:white; border:none; border-radius:8px; font-size:1rem; font-weight:700; cursor:pointer;
                                   box-shadow: 0 4px 12px rgba(16,185,129,0.4); text-transform:uppercase; letter-spacing:1px;">
                            <i class="fa-solid fa-save" style="margin-right:0.5rem;"></i> Guardar Actividades Fuera Plan
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Historial -->
            <div id="historial-ejecuciones-wrapper">
                ${renderHistorialCardCompleto()}
            </div>
        </div>

        <!-- MODAL DE EDICIÓN DE EJECUCIONES -->
        <div id="modal-edit-ejecucion" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9999; justify-content:center; align-items:center;">
            <div class="modal-content" style="background:#1E293B; border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:1.5rem; max-width:400px; width:90%; color:white; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-top:0; margin-bottom:1rem; color:var(--primary); display:flex; align-items:center; gap:0.5rem;">
                    <i class="fa-solid fa-pencil"></i> Editar Ejecución
                </h3>
                <input type="hidden" id="edit-ejec-id">
                
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.85rem; color:var(--text-muted);">Fecha</label>
                    <input type="date" id="edit-ejec-fecha" style="width:100%; padding:0.6rem; border-radius:8px; background:#0F172A; border:1px solid rgba(255,255,255,0.15); color:white;">
                </div>
                
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.85rem; color:var(--text-muted);">Cantidad Real Trabajada</label>
                    <input type="number" id="edit-ejec-unidades" min="0" style="width:100%; padding:0.6rem; border-radius:8px; background:#0F172A; border:1px solid rgba(255,255,255,0.15); color:white; font-weight:700;">
                </div>
                
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.85rem; color:var(--text-muted);">Horas Reales Invertidas</label>
                    <input type="number" id="edit-ejec-horas" min="0.1" step="0.1" style="width:100%; padding:0.6rem; border-radius:8px; background:#0F172A; border:1px solid rgba(255,255,255,0.15); color:white; font-weight:700;">
                </div>
                
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.85rem; color:var(--text-muted);">Observación</label>
                    <textarea id="edit-ejec-observacion" rows="2" style="width:100%; padding:0.6rem; border-radius:8px; background:#0F172A; border:1px solid rgba(255,255,255,0.15); color:white; resize:vertical;"></textarea>
                </div>
                
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-outline" onclick="cerrarModalEditarEjecucion()" style="padding:0.5rem 1rem;">Cancelar</button>
                    <button class="btn btn-primary" onclick="guardarEditarEjecucion()" style="background:linear-gradient(135deg, #10B981, #059669); border:none; padding:0.5rem 1.2rem; font-weight:bold;">Guardar</button>
                </div>
            </div>
        </div>
    `;
});
