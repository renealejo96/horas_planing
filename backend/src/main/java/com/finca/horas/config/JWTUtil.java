package com.finca.horas.config;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Date;

@Component
public class JWTUtil {

    @Value("${app.jwt.secret:pyganflor_secret_key_2026_super_secure_key_123456}")
    private String secret;

    // Token expira en 24 horas
    private static final long EXPIRE_MS = 24 * 60 * 60 * 1000;

    public String generarToken(String username, String rol, Boolean modificarRendimientos, String actividadesPermitidas) {
        Algorithm algorithm = Algorithm.HMAC256(secret);
        return JWT.create()
                .withSubject(username)
                .withClaim("rol", rol)
                .withClaim("modificarRendimientos", modificarRendimientos != null ? modificarRendimientos : false)
                .withClaim("actividadesPermitidas", actividadesPermitidas != null ? actividadesPermitidas : "")
                .withIssuedAt(new Date())
                .withExpiresAt(new Date(System.currentTimeMillis() + EXPIRE_MS))
                .sign(algorithm);
    }

    public DecodedJWT verificarToken(String token) {
        Algorithm algorithm = Algorithm.HMAC256(secret);
        JWTVerifier verifier = JWT.require(algorithm).build();
        return verifier.verify(token);
    }

    public String getUsername(DecodedJWT jwt) {
        return jwt.getSubject();
    }

    public String getRol(DecodedJWT jwt) {
        return jwt.getClaim("rol").asString();
    }
}
