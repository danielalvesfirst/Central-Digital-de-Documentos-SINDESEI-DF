# Contrato da API (o que o front espera)

Base: `API_BASE` em `frontend/assets/js/config.js`. JSON em UTF-8, exceto upload (`multipart/form-data`).
Autenticação por **cookie de sessão** (`HttpOnly`, `Secure`, `SameSite=Lax`); o front envia `credentials: 'include'`.
Libere CORS para a origem do front com `Access-Control-Allow-Credentials: true`.
Erros: status HTTP adequado + `{ "mensagem": "texto em português para o usuário" }`. **401** faz o front voltar ao login.

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/auth/login` | `{ email, senha }` | 200 e cookie de sessão |
| POST | `/auth/logout` | n/a | 204 |
| POST | `/auth/recuperar` | `{ email }` | **204 sempre**, exista o e-mail ou não |
| POST | `/auth/redefinir` | `{ token, senha }` | 204. Token de uso único e expiração curta |
| GET | `/me` | n/a | `{ nome, email, cpf, telefone, cargo, nivelAcesso, departamento, fotoUrl, permissoes }` (CPF já mascarado). `permissoes` é uma lista como `['documentos:cadastrar','documentos:editar','documentos:excluir']`; o front só usa para **esconder botões** |
| POST | `/me/foto` | multipart: `foto` (imagem, até 5 MB) | 200 `{ fotoUrl }` |
| PATCH | `/me` | `{ nome, telefone }` | 200. Ignorar qualquer outro campo |
| GET | `/categorias` | n/a | `[{ id, nome, descricao, total }]` (`total` = nº de documentos, usado nos chips). Ids usados pelo front: atas, comunicacao, convencoes, administrativos, eventos, oficios, parcerias, relatorios |
| GET | `/documentos?categoria=&busca=&pagina=&limite=` | n/a | `{ itens: [Documento], total, pagina, limite, totalPaginas }`. O front pede `limite=20`. Filtros que o front envia (todos opcionais e combináveis): `categoria`, `tipo` (extensão, ex.: `pdf`), `de` e `ate` (`YYYY-MM-DD`, pela data do documento), `responsavel` (parte do nome de quem cadastrou), `classificacao` (`geral`/`confidencial`), `favoritos=1` (somente os favoritos do usuário), `ordem` (`recentes` padrão, `antigos`, `nome_asc`, `nome_desc`, `relevancia`) e `pagina`/`limite`. **Todo filtro e ordenação devem ser aplicados no servidor**; o front não filtra localmente. `relevancia` só é enviada junto com `busca`. `busca` deve procurar em **título, assunto, palavras-chave e nome da categoria** (idealmente, no futuro, também no conteúdo dos arquivos) |
| GET | `/documentos/:id` | n/a | `Documento` completo (abaixo) |
| PATCH | `/documentos/:id` | multipart, mesmos campos do cadastro; `arquivo` opcional (substitui o principal) | 200 |
| DELETE | `/documentos/:id` | n/a | 204 |
| POST | `/documentos` | multipart: `titulo`, `categoria`, `data` (`YYYY-MM-DD`), `palavrasChave` (separadas por vírgula), `assunto`, `descricao`, `arquivo` (**opcional**) | 201 |
| GET | `/documentos/:id/download` | `?inline=1` abre no navegador | arquivo principal, com checagem de permissão |
| GET | `/documentos/:id/arquivos/:arqId/download` | n/a | arquivo anexo |
| POST | `/me/senha` | `{ senhaAtual, novaSenha }` | 204; 400/403 se a senha atual estiver errada |

`Documento`: `{ id, titulo, categoria (id), data, assunto, descricao, palavrasChave: [texto], criadoPor, tipo (extensão do arquivo principal), tamanhoBytes, arquivos: [{ id, nome, tipo, tamanhoBytes, criadoEm }] }`. Datas em `YYYY-MM-DD`. Sem arquivo, `arquivos` vem vazio. **`arquivos[0]` é o arquivo principal** (o do botão Baixar/Abrir); os demais são anexos. Hoje o front só cadastra o principal; anexos são exibidos se o back os fornecer.

## Regras que o back deve garantir (o front não protege nada)
- Revalidar a senha (mín. 8, 1 número, 1 especial), tipos de arquivo (pdf, doc, docx, xls, xlsx, txt, png, jpg, zip) e tamanho (25 MB por arquivo; ver "Upload" abaixo) no servidor; checar o conteúdo real do arquivo e passar antivírus.
- Autorização por perfil em cada rota; `nivelAcesso`, `cargo` e `departamento` nunca vêm do front.
- Link de redefinição: `https://<front>/senhanova.html?token=<token>`.
- CPF e documentos são dados pessoais (LGPD): log de acesso, criptografia em repouso, não servir arquivos de pasta pública.

## Permissões
Cada rota acima precisa checar a permissão no servidor (o front só esconde botões). Definir com o SINDESEI os perfis (ex.: administrador, gestor, editor, visualizador) e o que cada um pode.

## Pendências para o back (levantadas na avaliação)
- Armazenamento privado dos arquivos (nome interno aleatório, download só via API com autorização) e validação de tipo real/antivírus.
- Auditoria: registrar quem visualizou/baixou/alterou cada documento e quando.
- LGPD: base legal, retenção, criptografia em repouso, mascaramento de CPF.
- Limite de upload: o front usa **25 MB por arquivo** (provisório); ver "Upload" abaixo.
- Recuperação de senha: e-mail, token de uso único, expiração, limite de tentativas.
- Escalabilidade da busca (índice de texto) e das listagens.

## Classificação de documentos
`Documento` ganha o campo `classificacao` (`geral` | `confidencial`). Listas, detalhe, busca, contadores e downloads devem respeitar a autorização do usuário; sem autorização, 403. Detalhes e endpoints de gestão de acesso em [`API-ADMIN.md`](API-ADMIN.md).

## Favoritos (⏳ dependem do backend)
Favoritos são **individuais**: pertencem ao usuário autenticado e o servidor não pode permitir alterar os de outra pessoa.

| Método e rota | Resposta |
|---|---|
| `PUT /favoritos/:documentoId` | 204 (idempotente). 403/404 se o usuário não puder ver o documento |
| `DELETE /favoritos/:documentoId` | 204 (idempotente) |

`Documento` ganha `favorito` (boolean, do usuário autenticado) na lista e no detalhe. A área "Meus favoritos" usa `GET /documentos?favoritos=1`. Um documento confidencial que o usuário perdeu o direito de ver deve sair da lista de favoritos.

## Upload
- **Limite único no front: `APP_CONFIG.MAX_MB = 25` (MB por arquivo)** em `frontend/assets/js/config.js`; foto de perfil: `MAX_FOTO_MB = 5`. É um padrão **provisório**: o limite definitivo precisa ser o mesmo aceito pelo backend (e pelo proxy/servidor web, se houver limite menor).
- Formatos: `APP_CONFIG.TIPOS_ARQUIVO` (pdf, doc, docx, xls, xlsx, txt, png, jpg, jpeg, zip).
- O front valida tipo e tamanho antes de enviar, mostra nome e tamanho do arquivo e informa o limite antes da seleção. **Isso é só prevenção**: o servidor deve aplicar o mesmo limite, validar o tipo real do arquivo e passar antivírus.
- Falha de rede aparece como "Não foi possível conectar ao servidor"; erro do servidor usa o campo `mensagem`.
- A tela de configurações do admin só aceita limite entre 1 MB e o limite do front (25 MB).

## Assistente IA (⏳ interface pronta; depende do backend e do serviço de IA)
Não existia contrato de IA. A interface (`assistente.html`) segue o contrato abaixo e, enquanto o servidor responder 501 (ou não existir), mostra "Assistente IA em implantação" e desabilita o envio. **Nenhuma resposta, fonte ou sugestão é simulada**, nem no modo de demonstração.

| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /assistente/conversas` | n/a | `[{ id, titulo, atualizadaEm }]` do usuário autenticado |
| `GET /assistente/conversas/:id` | n/a | `{ id, titulo, mensagens: [Mensagem] }` |
| `POST /assistente/mensagens` | `{ conversaId \| null, texto }` (até 2000 caracteres) | `{ conversaId, mensagem: Mensagem }` |
| `POST /assistente/resumo` | `{ documentoId }` | `{ resumo, fontes: [Fonte] }` |
| `POST /assistente/sugestoes` | `{ documentoId }` | `{ categoria (id), palavrasChave: [texto], assunto, descricao }` |

`Mensagem`: `{ id, papel: "usuario"\|"assistente", texto, criadaEm, fontes: [Fonte] }`. `Fonte`: `{ documentoId, titulo, trecho? }`. Respostas sem fontes devem trazer `fontes: []` (a interface então informa que nenhum documento foi citado). O texto é exibido como texto puro (sem HTML/markdown).

**Segurança (responsabilidade do backend):** a busca/recuperação de documentos feita pela IA deve considerar **as permissões do usuário que perguntou**, incluindo a classificação confidencial e as autorizações por documento. Fontes só podem citar documentos que esse usuário pode ver, e `documentoId`/`titulo` em fontes não podem vazar documentos sem autorização. Abrir uma fonte usa as rotas normais de documento (403 se não autorizado). Sugestões nunca são salvas pela IA: o front abre o formulário de edição do documento para o usuário revisar e confirmar (`PATCH /documentos/:id`).

## Modo de demonstração
Com `USE_MOCK: true` o sistema mostra a faixa "Modo demonstração: os dados são de teste e não são salvos no servidor". Favoritos, filtros, cadastros e a área administrativa funcionam com dados de teste guardados só na aba. O Assistente IA **não** é simulado. Com `USE_MOCK: false` a faixa desaparece e tudo vai para a API.
