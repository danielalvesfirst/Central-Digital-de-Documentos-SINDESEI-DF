# Banco de dados PostgreSQL — SINDESEI-DF

## Objetivo e escopo

Este diretório contém a camada PostgreSQL da Central Digital de Documentos. O projeto enviado tem frontend HTML/CSS/JavaScript puro e um contrato da API em `docs/API.md`; a API ainda não existe. A modelagem foi baseada nas páginas e no contrato já documentado, sem implementar backend.

Requisitos: PostgreSQL 14 ou superior. Não são necessárias extensões adicionais. O `schema.sql` cria as tabelas dentro do schema `app_sindesei`, sem criar nem apagar o banco inteiro.

## Arquivos

- `schema.sql`: tabelas, chaves, regras e índices.
- `seed.sql`: categorias, perfis/permissões e documentos fictícios para teste; não cria contas de login nem arquivos físicos.
- `queries.sql`: consultas de referência para as operações esperadas pela API.

## Como criar e executar

### Opção A — pgAdmin

1. Crie um banco chamado `sindesei_documentos` (clique direito em **Databases > Create > Database**).
2. Selecione esse banco no navegador do pgAdmin.
3. Abra **Tools > Query Tool**.
4. Abra/copie o conteúdo de `schema.sql` e execute (ícone ▶ ou F5).
5. Na mesma conexão, execute `seed.sql`.
6. Para verificar, execute:
   ```sql
   SELECT current_database();
   SELECT table_schema, table_name
   FROM information_schema.tables
   WHERE table_schema = 'app_sindesei'
   ORDER BY table_name;
   SELECT id, nome, ativa FROM app_sindesei.categorias ORDER BY nome;
   SELECT titulo, categoria_id, data_documento FROM app_sindesei.documentos ORDER BY id;
   ```

### Opção B — terminal

Crie o banco uma única vez:
```bash
createdb -U postgres sindesei_documentos
```
Execute os scripts:
```bash
psql -U postgres -d sindesei_documentos -v ON_ERROR_STOP=1 -f database/schema.sql
psql -U postgres -d sindesei_documentos -v ON_ERROR_STOP=1 -f database/seed.sql
```
Se os arquivos estiverem dentro da pasta `database`, rode os comandos a partir da raiz do repositório. Ajuste usuário/host conforme a instalação. Não coloque senha na linha de comando nem em scripts versionados.

> Os scripts podem ser executados em um banco de desenvolvimento vazio. O `schema.sql` usa `CREATE TABLE IF NOT EXISTS`, mas não é uma ferramenta de migração: ele não altera automaticamente tabelas antigas se a modelagem mudar.

## Estrutura e relacionamentos

- `departamentos`: departamentos exibidos no perfil do usuário.
- `perfis_acesso`, `permissoes`, `perfil_permissoes`: perfis e permissões do sistema; a API deve aplicar a autorização no servidor, não apenas esconder botões.
- `usuarios`: conta, e-mail, hash da senha, CPF opcional, telefone, cargo, departamento, perfil, foto privada e datas de atividade. `senha_hash` guarda somente hash forte, nunca a senha original.
- `categorias`: IDs estáveis usados no frontend (`atas`, `comunicacao`, `convencoes`, `administrativos`, `eventos`, `oficios`, `parcerias`, `relatorios`). Categorias são desativadas com `ativa = false`, em vez de apagadas quando já usadas.
- `documentos`: título, categoria, data do documento, assunto, descrição e autor/criador.
- `palavras_chave` e `documento_palavras_chave`: relação muitos-para-muitos entre documentos e termos de busca.
- `arquivos_documento`: metadados dos arquivos principais/anexos. O conteúdo binário fica fora do PostgreSQL, em armazenamento privado; `storage_key` é a chave interna e não deve ser um caminho público.
- `tokens_redefinicao_senha`: hash do token de uso único, prazo de validade e data de consumo.
- `auditoria`: eventos de criação, alteração, exclusão, visualização/download e outras ações relevantes.

Modelo textual resumido:

```text
departamentos 1 ─── N usuarios N ─── 1 perfis_acesso
perfis_acesso N ─── N permissoes (via perfil_permissoes)
categorias 1 ─── N documentos N ─── 0..1 usuarios (criador)
documentos N ─── N palavras_chave (via documento_palavras_chave)
documentos 1 ─── N arquivos_documento
usuarios 1 ─── N tokens_redefinicao_senha
usuarios 1 ─── N auditoria; documentos 1 ─── N auditoria
```

## Decisões e regras relevantes

- E-mail único sem distinção entre maiúsculas/minúsculas por índice único funcional em `lower(email)`; a API ainda deve remover espaços e normalizar o endereço antes de gravar.
- CPF é opcional e armazenado apenas com 11 dígitos quando conhecido; a API deve mascará-lo na resposta `/me`. Validar os dígitos verificadores no backend.
- IDs de categoria são strings estáveis porque o frontend usa os slugs como IDs. Nome de categoria é único. A desativação preserva o histórico.
- O arquivo principal é identificado por `principal = true`; um índice único parcial impede dois principais para o mesmo documento. Um documento pode não ter arquivo, como prevê o contrato da API.
- Palavras-chave são normalizadas pelo backend (minúsculas, espaços consistentes e, se desejado, remoção de acentos) e associadas pelas tabelas de junção.
- `ON DELETE CASCADE` remove associações e metadados dependentes ao excluir documento, mas não apaga o objeto físico do storage. A API precisa fazer a limpeza do storage com retentativas.
- Os índices cobrem FKs usadas em joins, listagem por categoria/data e auditoria. A busca inicial por `ILIKE` não usa índice B-tree de forma eficiente; para maior volume, considerar `pg_trgm` ou adaptar a consulta para full-text search.
- `atualizado_em` não se atualiza sozinho em `UPDATE`; a API deve defini-lo explicitamente ou a equipe pode adicionar triggers.
- Os perfis/permissões do `seed.sql` são uma matriz inicial demonstrativa. Confirmar formalmente os níveis de acesso e permissões com o sindicato.

## Informações para integração com o backend

O contrato esperado pelo frontend está em `docs/API.md`. A API deve conectar-se com credenciais próprias, via variáveis de ambiente/secret manager, e usar consultas parametrizadas.

| Endpoint esperado | Tabelas principais |
|---|---|
| `POST /auth/login`, `POST /auth/logout` | `usuarios`, mais mecanismo de sessão escolhido pelo backend |
| `POST /auth/recuperar`, `POST /auth/redefinir` | `usuarios`, `tokens_redefinicao_senha` |
| `GET /me`, `PATCH /me`, `POST /me/foto`, `POST /me/senha` | `usuarios`, `departamentos`, `perfis_acesso`, `perfil_permissoes`, `permissoes` |
| `GET /categorias` | `categorias`, `documentos` |
| `GET /documentos`, `GET /documentos/:id` | `documentos`, `categorias`, `usuarios`, `palavras_chave`, `documento_palavras_chave`, `arquivos_documento` |
| `POST /documentos`, `PATCH /documentos/:id`, `DELETE /documentos/:id` | tabelas de documentos, palavras-chave e arquivos; executar operações relacionadas em transação |
| Downloads | `arquivos_documento` para localizar o objeto privado e verificar autorização |
| Auditoria | `auditoria` |

### Cuidados importantes para quem implementa a API

1. Use transações para salvar um documento, palavras-chave e metadados de arquivo como uma única operação lógica.
2. Use `RETURNING id` para obter IDs gerados. Nunca dependa de IDs fixos de identidade.
3. `documentos.data_documento` corresponde ao campo `data` do contrato; `categoria_id` corresponde a `categoria`; `criado_por` deve vir da sessão autenticada, nunca do formulário.
4. O contrato do frontend devolve `palavrasChave` como array de strings e `arquivos` como array. A API precisa montar esses arrays a partir das tabelas relacionadas.
5. O frontend envia `palavrasChave` como texto separado por vírgulas em `multipart/form-data`. A API deve dividir, limpar, normalizar, deduplicar e associar os termos.
6. `tipo`, `tamanhoBytes`, `nome`, `criadoEm` e `id` dos arquivos são derivados de `arquivos_documento`. O primeiro arquivo na resposta deve ser o principal.
7. Para redefinição, gere token aleatório forte, envie o token bruto por e-mail e armazene apenas seu hash. Consuma o token uma única vez e com expiração curta, na mesma transação da atualização de senha.
8. O banco não autentica nem autoriza por si só. Use Argon2id ou bcrypt para senhas, sessão segura (cookie `HttpOnly`, `Secure` em HTTPS, `SameSite` adequado), proteção contra CSRF quando aplicável, limitação de tentativas e checagem de permissão em cada rota.
9. Nunca exponha `senha_hash`, `token_hash`, `storage_key`, CPF integral ou detalhes internos de auditoria em respostas públicas.
10. O limite de arquivo está inconsistente entre comentários do frontend e o contrato (5 MB para foto; 100 MB para documentos). Definir um limite final; validar tipo real, tamanho e antivírus no servidor.
11. O índice único funcional em `lower(email)` impede duplicatas que diferem apenas por caixa. A API também deve remover espaços e normalizar o endereço antes de gravar.
12. O backend deve decidir como persistir sessões. O esquema atual não inclui tabela de sessões porque o mecanismo depende da tecnologia escolhida; sessões em memória não são adequadas para múltiplas instâncias/produção.

## Como testar consultas

Execute `queries.sql` no pgAdmin Query Tool ou `psql`. As consultas principais estão escritas para executar diretamente no pgAdmin/psql e usam valores de demonstração (por exemplo, categoria `atas` e termo `reunião`). No backend, substitua esses valores por parâmetros preparados do driver; nunca concatene valores recebidos do usuário ao SQL.

## Dados de teste e produção

O `seed.sql` contém apenas dados fictícios, categorias e perfis. Não cria usuário autenticável nem arquivos físicos; isso é intencional para não embutir senha padrão ou fingir que arquivos existem. Para testar login, crie usuário por fluxo administrativo seguro ou gere um hash de senha na API e insira-o por ambiente local.

Antes de produção, revisar LGPD, retenção, backups, controle de acesso ao banco, criptografia em repouso, logs de acesso e política de exclusão.
