process.env.NODE_ENV ??= "test";
process.env.LOG_LEVEL ??= "silent";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5173";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/trailnav_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??=
  "test-secret-key-at-least-32-characters-long";
process.env.ARCJET_KEY ??= "ajkey_test_local_placeholder";
process.env.ARCJET_ENV ??= "development";
