// Configuração única. O time de back só precisa ajustar aqui.
window.APP_CONFIG = {
  API_BASE: "http://localhost:3000/api", // URL base da API (ver docs/API.md)
  USE_MOCK: true, // true = dados falsos, sem back. Mudar para false ao integrar.
};
// Limites de upload (o protótipo cita 5 GB, mas isso não é viável pelo navegador; combinar o valor final com o back)
window.APP_CONFIG.MAX_MB = 100;
window.APP_CONFIG.TIPOS_ARQUIVO = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "zip",
];
