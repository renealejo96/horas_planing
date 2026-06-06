// Simple SPA Router
const App = {
    views: {},
    currentView: null,
    
    registerView: function(name, renderFunc) {
        this.views[name] = renderFunc;
    },
    
    navigate: function(viewName) {
        const container = document.getElementById('view-container');
        const titleSpan = document.getElementById('page-title');
        
        if (this.views[viewName]) {
            // Update Sidebar UI
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const activeLink = document.querySelector(`.nav-item[data-view="${viewName}"]`);
            if (activeLink) activeLink.classList.add('active');
            
            // Set Titles globally
            const titles = {
                dashboard: 'Dashboard Semanal',
                planificacion: 'Planificación Semanal',
                'planificacion-diaria': 'Plan Diario',
                ejecucion: 'Ejecución Diaria',
                comparativa: 'Comparativa',
                personal: 'Gestión de Personal',
                rendimientos: 'Parámetros de Rendimiento'
            };
            titleSpan.innerText = titles[viewName] || 'PYGANFLOR';
            
            // Render View
            container.innerHTML = '<div class="loader"><i class="fa-solid fa-spinner fa-spin"></i>&nbsp; Cargando...</div>';
            setTimeout(async () => {
                container.innerHTML = await this.views[viewName]();
            }, 100);
            
            this.currentView = viewName;
        }
    },
    
    // Alert state tracking
    alertState: {
        lastAlertLevel: null,
        alertShownThisSession: false
    },
    
    verificarConexionYBadge: async function(mostrarToast = false) {
        const [online, semanaActual] = await Promise.all([
            api.healthCheck(),
            api.getSemanaActual().catch(() => null)
        ]);
        
        if (online && mostrarToast) {
            showNotification('Conectado a PYGANFLOR - Supabase', 'success');
        }
        
        const badge = document.getElementById('global-semana-badge');
        if (badge) {
            if (semanaActual && semanaActual.codigoAass) {
                badge.innerHTML = `<i class="fa-regular fa-calendar" style="margin-right:0.3rem;"></i> Semana Activa: ${semanaActual.codigoAass}`;
            } else {
                badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right:0.3rem; color:#F59E0B;"></i> Sin Semana Activa`;
            }
        }
        return online;
    },
     checkAuth: function() {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        
        if (!token || !userStr) {
            // No autenticado: ocultar app y mostrar login
            document.querySelector('.app-container').style.display = 'none';
            this.showLoginOverlay();
            return false;
        }
        
        // Autenticado: mostrar app
        document.querySelector('.app-container').style.display = 'flex';
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.remove();
        
        const user = JSON.parse(userStr);
        
        // Actualizar barra lateral según rol y permisos
        const navUsuarios = document.getElementById('nav-usuarios');
        if (navUsuarios) {
            if (user.rol === 'ADMIN') {
                navUsuarios.style.display = 'flex';
            } else {
                navUsuarios.style.display = 'none';
            }
        }
        
        const navRendimientos = document.getElementById('nav-rendimientos');
        if (navRendimientos) {
            // Si es supervisor y no puede modificar rendimientos, se oculta
            if (user.rol === 'SUPERVISOR' && !user.modificarRendimientos) {
                navRendimientos.style.display = 'none';
            } else {
                navRendimientos.style.display = 'flex';
            }
        }
        
        // Actualizar datos del footer de la barra lateral
        const sidebarUserInfo = document.getElementById('sidebar-user-info');
        if (sidebarUserInfo) {
            const initials = user.username.substring(0, 2).toUpperCase();
            const roleLabel = user.rol === 'ADMIN' ? 'Administrador' : `Supervisor (${user.actividadesPermitidas || 'Sin actividades'})`;
            
            sidebarUserInfo.innerHTML = `
                <div class="avatar">${initials}</div>
                <div class="user-details">
                    <span class="user-name">${user.username}</span>
                    <span class="user-role" style="font-size:0.75rem;">${roleLabel}</span>
                    <button class="btn-logout" onclick="App.logout()">
                        <i class="fa-solid fa-right-from-bracket"></i> Salir
                    </button>
                </div>
            `;
        }
        
        return true;
    },
    
    logout: function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
    },
    
    showLoginOverlay: function() {
        if (document.getElementById('login-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'login-overlay';
        overlay.className = 'login-overlay';
        
        overlay.innerHTML = `
            <div class="login-card">
                <div class="login-header">
                    <i class="fa-solid fa-leaf"></i>
                    <h2>PYGANFLOR</h2>
                    <p>Sistema de Control de Horas Agrícola</p>
                </div>
                
                <form id="login-form">
                    <div class="login-form-group">
                        <label for="login-username">Usuario / Email</label>
                        <div class="login-input-wrapper">
                            <i class="fa-solid fa-user"></i>
                            <input type="text" id="login-username" placeholder="Ingrese su usuario o email" required autocomplete="username">
                        </div>
                    </div>
                    
                    <div class="login-form-group" style="margin-top: 1rem;">
                        <label for="login-password">Contraseña</label>
                        <div class="login-input-wrapper">
                            <i class="fa-solid fa-lock"></i>
                            <input type="password" id="login-password" placeholder="Ingrese su contraseña" required autocomplete="current-password">
                        </div>
                    </div>
                    
                    <button type="submit" class="btn-login" id="btn-login-submit">
                        <i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión
                    </button>
                </form>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-login-submit');
            const usernameInput = document.getElementById('login-username').value.trim();
            const passwordInput = document.getElementById('login-password').value;
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
            
            try {
                const response = await api.login(usernameInput, passwordInput);
                localStorage.setItem('token', response.token);
                
                // Guardar perfil del usuario
                const userProfile = {
                    username: response.username,
                    email: response.email,
                    rol: response.rol,
                    modificarRendimientos: response.modificarRendimientos,
                    actividadesPermitidas: response.actividadesPermitidas
                };
                localStorage.setItem('user', JSON.stringify(userProfile));
                
                showNotification(`¡Bienvenido de nuevo, ${response.username}!`, 'success');
                
                // Limpiar overlay y arrancar
                overlay.remove();
                if (this.checkAuth()) {
                    this.navigate('dashboard');
                    this.verificarConexionYBadge(false);
                    this.startAlertPolling();
                }
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Credenciales inválidas', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión';
            }
        });
    },

    init: function() {
        // Event listeners para Navegación
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('data-view');
                this.navigate(view);
            });
        });
        
        // Botón de sincronización
        document.getElementById('btn-sync').addEventListener('click', async () => {
            const btn = document.getElementById('btn-sync');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
            
            const isOnline = await this.verificarConexionYBadge(false);
            
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sincronizar';
                
                if (isOnline) {
                    showNotification('Conexión OK - Datos sincronizados con Supabase', 'success');
                    this.navigate(this.currentView); // Recargar vista actual
                } else {
                    showNotification('Sin conexión al servidor', 'error');
                }
            }, 800);
        });
        
        // Verificar autenticación
        if (this.checkAuth()) {
            this.navigate('dashboard');
            setTimeout(() => this.verificarConexionYBadge(true), 500);
            this.startAlertPolling();
        }
        
        // Registrar Service Worker para PWA
        this.registerServiceWorker();
        
        // Solicitar permisos de notificación
        this.requestNotificationPermission();
    },
    
    // Register Service Worker
    registerServiceWorker: async function() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('ServiceWorker registrado:', registration.scope);
            } catch (error) {
                console.log('Error al registrar ServiceWorker:', error);
            }
        }
    },
    
    // Request notification permission
    requestNotificationPermission: async function() {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                console.log('Permiso de notificaciones:', permission);
            } catch (error) {
                console.log('Error solicitando permisos:', error);
            }
        }
    },
    
    // Start polling for alerts every 5 minutes
    startAlertPolling: function() {
        // Check immediately on load
        setTimeout(() => this.checkForAlerts(), 2000);
        
        // Then check every 5 minutes
        setInterval(() => this.checkForAlerts(), 5 * 60 * 1000);
    },
    
    // Check for hour alerts
    checkForAlerts: async function() {
        try {
            const semana = await api.getSemanaActual().catch(() => null);
            if (!semana) return;
            
            const alerta = await api.getAlertaHoras(semana.codigoAass).catch(() => null);
            if (!alerta) return;
            
            // Check if alert state changed
            if (alerta.alertaActiva) {
                const isNewAlert = !this.alertState.alertShownThisSession;
                const levelChanged = this.alertState.lastAlertLevel !== alerta.nivel;
                
                if (isNewAlert || levelChanged) {
                    this.showAlertBanner(alerta);
                    this.sendPushNotification(alerta);
                    this.alertState.alertShownThisSession = true;
                    this.alertState.lastAlertLevel = alerta.nivel;
                }
            }
        } catch (error) {
            console.log('Error verificando alertas:', error);
        }
    },
    
    // Show alert banner at top of page
    showAlertBanner: function(alerta) {
        // Remove existing banner if any
        const existing = document.querySelector('.global-alert-banner');
        if (existing) existing.remove();
        
        const banner = document.createElement('div');
        banner.className = `global-alert-banner ${alerta.nivel}`;
        banner.innerHTML = `
            <i class="fa-solid ${alerta.nivel === 'danger' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle'}"></i>
            <span>${alerta.mensaje}</span>
            <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; cursor:pointer; padding:0.5rem;">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 0.75rem 1rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 10000;
            font-weight: 500;
            background: ${alerta.nivel === 'danger' ? 'linear-gradient(90deg, #DC2626, #EF4444)' : 'linear-gradient(90deg, #D97706, #F59E0B)'};
            color: white;
            animation: slideDown 0.3s ease;
        `;
        
        // Add animation keyframes if not already added
        if (!document.querySelector('#alert-animations')) {
            const style = document.createElement('style');
            style.id = 'alert-animations';
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.prepend(banner);
        
        // Auto-hide after 10 seconds
        setTimeout(() => banner.remove(), 10000);
    },
    
    // Send browser push notification
    sendPushNotification: function(alerta) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('PYGANFLOR - Alerta de Horas', {
                body: alerta.mensaje,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                tag: 'horas-alert',
                renotify: true,
                vibrate: [200, 100, 200]
            });
            
            notification.onclick = () => {
                window.focus();
                this.navigate('comparativa');
                notification.close();
            };
        }
    }
};

// ========== Modal Functions ==========
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.querySelector('input')?.focus();
    }
}

function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
});

// App.init() se llama desde index.html después de registrar las vistas
