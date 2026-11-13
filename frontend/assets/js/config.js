// Configuração única. O time de back só precisa ajustar aqui.
window.APP_CONFIG = {
  API_BASE: "http://localhost:3000/api", // URL base da API (ver docs/API.md)
  USE_MOCK: true, // true = dados falsos, sem back. Mudar para false ao integrar.
};
// Limites de upload: ÚNICO lugar onde o valor é definido (todo o front lê daqui).
// 25 MB é um padrão PROVISÓRIO por arquivo; o limite definitivo precisa ser igual ao aceito pelo backend.
window.APP_CONFIG.MAX_MB = 25;
window.APP_CONFIG.MAX_FOTO_MB = 5; // foto de perfil
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
// true = mostra, nas telas administrativas, qual endpoint ainda falta (uso de quem desenvolve)
window.APP_CONFIG.MODO_DEV = false;
