# Central Digital de Documentos - SINDESEI-DF

Frontend estático (HTML, CSS e JS puro). Telas: login, recuperar/editar senha, início, documentos (lista, busca, chips por categoria e cadastro em popup), categorias, detalhe do documento (informações e arquivos) e minha conta.

## Rodar
Abra `frontend/index.html` com o Live Server (ou `npx serve frontend`). Por padrão usa **dados falsos** (`USE_MOCK: true`); qualquer e-mail e senha entra.

## Integrar com o back
1. Em `frontend/assets/js/config.js`: `USE_MOCK: false` e ajustar `API_BASE`.
2. Implementar os endpoints de [`docs/API.md`](docs/API.md). Todo acesso ao back passa por `assets/js/api.js`; o bloco MOCK no fim do arquivo pode ser apagado.

## Observações
- O mock guarda os cadastros de teste só na aba (`sessionStorage`); ao fechar a aba, somem. É de propósito.
- Botões de cadastrar/editar/excluir aparecem conforme `permissoes` vindas de `/me`. Isso é só conveniência: a autorização real é do servidor.
- As validações de arquivo no front (extensão e tamanho) são só para orientar o usuário; o servidor deve revalidar tudo.
