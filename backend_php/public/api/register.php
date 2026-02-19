<?php
/**
 * POST /api/register.php
 * Crea un usuario nuevo con email y password.
 * Body (JSON): { "email": "user@dominio.com", "password": "TuPassSegura" }
 * Respuestas:
 *  - 200: {"ok":true}
 *  - 4xx/5xx: {"error":"mensaje"}
 */

require_once __DIR__ . '/../../src/db.php';
require_once __DIR__ . '/../../src/session.php';
require_once __DIR__ . '/../../src/response.php';
require_once __DIR__ . '/../../src/cors.php';

cors();
start_session();

try {
  // Leer body JSON
  $bodyRaw = file_get_contents('php://input');
  $body = json_decode($bodyRaw, true);

  $email = strtolower(trim($body['email'] ?? ''));
  $pass  = $body['password'] ?? '';

  // Validaciones básicas
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json(['error' => 'Email inválido'], 422);
  }
  if (strlen($pass) < 8) {
    json(['error' => 'Contraseña muy corta (mínimo 8 caracteres)'], 422);
  }

  // ¿Ya existe?
  $pdo = db();
  $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
  $stmt->execute([$email]);
  if ($stmt->fetch()) {
    json(['error' => 'El email ya está registrado'], 409);
  }

  // Crear usuario
  $hash = password_hash($pass, PASSWORD_DEFAULT);
  $ins = $pdo->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
  $ins->execute([$email, $hash]);

  json(['ok' => true], 200);

} catch (Throwable $e) {
  // Log opcional: error_log($e->getMessage());
  json(['error' => 'Error interno'], 500);
}