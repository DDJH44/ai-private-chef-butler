/**
 * 兼容层 — 从 http.ts re-export，保持现有 import 不破坏
 */
export { apiPath, apiOrigin, apiPort, getBase } from './http';
