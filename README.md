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

## Área administrativa
Acesso em `frontend/admin.html` (link "Administração" no menu para quem tem permissão). Telas: painel, usuários, perfis e permissões, documentos, categorias, auditoria e configurações. Os endpoints e o que ainda depende do backend estão em [`docs/API-ADMIN.md`](docs/API-ADMIN.md). Com `USE_MOCK: true` as telas abrem vazias (sem registros de exemplo) e o que for cadastrado fica só na aba aberta. Com o backend real, se uma rota ainda não existir (501 ou 404 sem `mensagem`), a tela esconde a tabela e mostra "Funcionalidade em implantação".

Para ver quais recursos ainda não têm endpoint durante o desenvolvimento, use `MODO_DEV: true` em `frontend/assets/js/config.js` (deixe `false` em produção).

## Documentos confidenciais
Documentos podem ser de **acesso geral** ou **confidenciais** (selo vermelho). Administradores (permissão `documentos:permissoes`) definem quem pode ver cada confidencial em Administração > Documentos > **Acesso**. A filtragem real é feita pelo servidor; veja `docs/API-ADMIN.md`.
