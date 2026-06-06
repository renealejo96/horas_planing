package com.finca.horas.config;

import com.auth0.jwt.interfaces.DecodedJWT;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Autowired
    private JWTUtil jwtUtil;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // Permitir solicitudes preflight de CORS
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String uri = request.getRequestURI();

        // Solo proteger rutas que empiecen con /api y excluir login
        if (!uri.startsWith("/api") || uri.equals("/api/auth/login")) {
            return true;
        }

        // Obtener cabecera de autorización
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"Acceso no autorizado: Token faltante\"}");
            response.setContentType("application/json");
            return false;
        }

        String token = authHeader.substring(7);
        try {
            DecodedJWT jwt = jwtUtil.verificarToken(token);
            
            // Adjuntar información del usuario a la solicitud
            request.setAttribute("username", jwt.getSubject());
            request.setAttribute("rol", jwt.getClaim("rol").asString());
            request.setAttribute("modificarRendimientos", jwt.getClaim("modificarRendimientos").asBoolean());
            request.setAttribute("actividadesPermitidas", jwt.getClaim("actividadesPermitidas").asString());
            
            return true;
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"Acceso no autorizado: Token inválido o expirado\"}");
            response.setContentType("application/json");
            return false;
        }
    }
}
