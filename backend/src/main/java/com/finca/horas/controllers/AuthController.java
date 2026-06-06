package com.finca.horas.controllers;

import com.finca.horas.config.JWTUtil;
import com.finca.horas.entities.Usuario;
import com.finca.horas.repositories.UsuarioRepository;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private JWTUtil jwtUtil;

    // Inicializar el usuario administrador por defecto si la base de datos está vacía
    @PostConstruct
    public void initDefaultAdmin() {
        if (usuarioRepository.count() == 0) {
            Usuario admin = new Usuario();
            admin.setUsername("admin");
            // Contraseña: admin123
            admin.setPassword(BCrypt.hashpw("admin123", BCrypt.gensalt()));
            admin.setEmail("admin@pyganflor.com");
            admin.setRol("ADMIN");
            admin.setModificarRendimientos(true);
            admin.setActividadesPermitidas(""); // Acceso a todas
            admin.setActivo(true);
            usuarioRepository.save(admin);
            System.out.println("[DB INITIALIZER] Creado usuario administrador por defecto: admin / admin123");
        }
    }

    // ==================== AUTENTICACIÓN ====================

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Faltan credenciales"));
        }

        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(username);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByEmail(username); // Permitir login por correo
        }

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Usuario no encontrado"));
        }

        Usuario usuario = usuarioOpt.get();
        if (!usuario.getActivo()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Cuenta inactiva"));
        }

        // Verificar contraseña
        if (!BCrypt.checkpw(password, usuario.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Contraseña incorrecta"));
        }

        // Generar token JWT
        String token = jwtUtil.generarToken(
                usuario.getUsername(),
                usuario.getRol(),
                usuario.getModificarRendimientos(),
                usuario.getActividadesPermitidas()
        );

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("username", usuario.getUsername());
        response.put("email", usuario.getEmail());
        response.put("rol", usuario.getRol());
        response.put("modificarRendimientos", usuario.getModificarRendimientos());
        response.put("actividadesPermitidas", usuario.getActividadesPermitidas());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/auth/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        String username = (String) request.getAttribute("username");
        if (username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No autenticado"));
        }

        return usuarioRepository.findByUsername(username)
                .map(usuario -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("username", usuario.getUsername());
                    response.put("email", usuario.getEmail());
                    response.put("rol", usuario.getRol());
                    response.put("modificarRendimientos", usuario.getModificarRendimientos());
                    response.put("actividadesPermitidas", usuario.getActividadesPermitidas());
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ==================== GESTIÓN DE USUARIOS (ADMIN ONLY) ====================

    @GetMapping("/admin/usuarios")
    public ResponseEntity<?> listUsers(HttpServletRequest request) {
        String rol = (String) request.getAttribute("rol");
        if (!"ADMIN".equals(rol)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Acceso denegado: Se requiere rol ADMIN"));
        }

        List<Usuario> usuarios = usuarioRepository.findAll();
        // Ocultar contraseñas en la respuesta por seguridad
        usuarios.forEach(u -> u.setPassword("[PROTEGIDO]"));
        return ResponseEntity.ok(usuarios);
    }

    @PostMapping("/admin/usuarios")
    public ResponseEntity<?> createUser(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        String rol = (String) request.getAttribute("rol");
        if (!"ADMIN".equals(rol)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Acceso denegado: Se requiere rol ADMIN"));
        }

        String username = (String) body.get("username");
        String password = (String) body.get("password");
        String email = (String) body.get("email");
        String userRol = (String) body.getOrDefault("rol", "SUPERVISOR");
        Boolean modificarRendimientos = (Boolean) body.getOrDefault("modificarRendimientos", false);
        String actividadesPermitidas = (String) body.getOrDefault("actividadesPermitidas", "");

        if (username == null || password == null || email == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Faltan campos obligatorios (username, password, email)"));
        }

        if (usuarioRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El nombre de usuario ya existe"));
        }

        if (usuarioRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El correo electrónico ya está registrado"));
        }

        Usuario nuevoUsuario = new Usuario();
        nuevoUsuario.setUsername(username);
        nuevoUsuario.setPassword(BCrypt.hashpw(password, BCrypt.gensalt()));
        nuevoUsuario.setEmail(email);
        nuevoUsuario.setRol(userRol);
        nuevoUsuario.setModificarRendimientos(modificarRendimientos);
        nuevoUsuario.setActividadesPermitidas(actividadesPermitidas);
        nuevoUsuario.setActivo(true);

        Usuario guardado = usuarioRepository.save(nuevoUsuario);
        guardado.setPassword("[PROTEGIDO]");

        return ResponseEntity.status(HttpStatus.CREATED).body(guardado);
    }

    @PutMapping("/admin/usuarios/{id}")
    public ResponseEntity<?> updateUser(HttpServletRequest request, @PathVariable Long id, @RequestBody Map<String, Object> body) {
        String adminRol = (String) request.getAttribute("rol");
        if (!"ADMIN".equals(adminRol)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Acceso denegado: Se requiere rol ADMIN"));
        }

        return usuarioRepository.findById(id)
                .map(usuario -> {
                    if (body.containsKey("username")) {
                        String username = (String) body.get("username");
                        if (!username.equals(usuario.getUsername()) && usuarioRepository.findByUsername(username).isPresent()) {
                            return ResponseEntity.badRequest().body(Map.of("error", "El nombre de usuario ya existe"));
                        }
                        usuario.setUsername(username);
                    }

                    if (body.containsKey("email")) {
                        String email = (String) body.get("email");
                        if (!email.equals(usuario.getEmail()) && usuarioRepository.findByEmail(email).isPresent()) {
                            return ResponseEntity.badRequest().body(Map.of("error", "El correo electrónico ya está registrado"));
                        }
                        usuario.setEmail(email);
                    }

                    if (body.containsKey("password") && body.get("password") != null && !((String) body.get("password")).isEmpty()) {
                        String newPassword = (String) body.get("password");
                        usuario.setPassword(BCrypt.hashpw(newPassword, BCrypt.gensalt()));
                    }

                    if (body.containsKey("rol")) {
                        usuario.setRol((String) body.get("rol"));
                    }

                    if (body.containsKey("modificarRendimientos")) {
                        usuario.setModificarRendimientos((Boolean) body.get("modificarRendimientos"));
                    }

                    if (body.containsKey("actividadesPermitidas")) {
                        usuario.setActividadesPermitidas((String) body.get("actividadesPermitidas"));
                    }

                    if (body.containsKey("activo")) {
                        usuario.setActivo((Boolean) body.get("activo"));
                    }

                    Usuario guardado = usuarioRepository.save(usuario);
                    guardado.setPassword("[PROTEGIDO]");
                    return ResponseEntity.ok(guardado);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/admin/usuarios/{id}")
    public ResponseEntity<?> deleteUser(HttpServletRequest request, @PathVariable Long id) {
        String adminRol = (String) request.getAttribute("rol");
        if (!"ADMIN".equals(adminRol)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Acceso denegado: Se requiere rol ADMIN"));
        }

        return usuarioRepository.findById(id)
                .map(usuario -> {
                    // En lugar de borrar físicamente, desactivamos por integridad referencial
                    usuario.setActivo(false);
                    usuarioRepository.save(usuario);
                    return ResponseEntity.ok(Map.of("mensaje", "Usuario desactivado exitosamente"));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
