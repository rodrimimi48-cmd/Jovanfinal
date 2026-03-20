<?php
require_once __DIR__.'/../../../src/db.php';
require_once __DIR__.'/../../../src/session.php';
require_once __DIR__.'/../../../src/cors.php';
require_once __DIR__.'/../../../src/response.php';

cors();
start_session();

$body = json_decode(file_get_contents('php://input'), true);
$email = strtolower(trim($body['email'] ?? ''));
$pass  = $body['password'] ?? '';

$pdo = db();
$stmt = $pdo->prepare("SELECT * FROM users WHERE email=?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($pass, $user['password_hash'])) {
  json(['error'=>'Credenciales incorrectas'], 401);
}

$_SESSION['uid'] = $user['id'];
$_SESSION['qr_verified'] = false;

json(['ok'=>true, 'require_qr'=> true]);