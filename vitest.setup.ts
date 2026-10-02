try {
  process.loadEnvFile();
} catch {
  // sin .env: los tests de API se saltean si falta TEST_DATABASE_URL
}
