-- SINDESEI-DF | PostgreSQL
-- Requer PostgreSQL 14+. Execute conectado ao banco criado para o projeto.
-- Este arquivo pode ser executado novamente: remove e recria o schema app_sindesei.
BEGIN;

CREATE SCHEMA IF NOT EXISTS app_sindesei;
SET search_path TO app_sindesei, public;

CREATE TABLE IF NOT EXISTS departamentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_departamentos_nome UNIQUE (nome),
    CONSTRAINT ck_departamentos_nome_nao_vazio CHECK (btrim(nome) <> '')
);

CREATE TABLE IF NOT EXISTS perfis_acesso (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_perfis_codigo UNIQUE (codigo),
    CONSTRAINT uq_perfis_nome UNIQUE (nome),
    CONSTRAINT ck_perfis_codigo_nao_vazio CHECK (btrim(codigo) <> ''),
    CONSTRAINT ck_perfis_nome_nao_vazio CHECK (btrim(nome) <> '')
);

CREATE TABLE IF NOT EXISTS permissoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(80) NOT NULL,
    descricao TEXT NOT NULL,
    CONSTRAINT uq_permissoes_codigo UNIQUE (codigo),
    CONSTRAINT ck_permissoes_codigo_nao_vazio CHECK (btrim(codigo) <> '')
);

CREATE TABLE IF NOT EXISTS perfil_permissoes (
    perfil_id BIGINT NOT NULL REFERENCES perfis_acesso(id) ON DELETE CASCADE,
    permissao_id BIGINT NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
    PRIMARY KEY (perfil_id, permissao_id)
);

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL,
    cpf CHAR(11),
    telefone VARCHAR(30),
    cargo VARCHAR(120),
    departamento_id BIGINT REFERENCES departamentos(id) ON DELETE SET NULL,
    perfil_id BIGINT NOT NULL REFERENCES perfis_acesso(id) ON DELETE RESTRICT,
    senha_hash TEXT NOT NULL,
    foto_storage_key TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    email_verificado_em TIMESTAMPTZ,
    ultimo_login_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_usuarios_nome_nao_vazio CHECK (btrim(nome) <> ''),
    CONSTRAINT ck_usuarios_email_nao_vazio CHECK (btrim(email) <> ''),
    CONSTRAINT ck_usuarios_cpf_digitos CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_case_insensitive ON usuarios (lower(email));
CREATE INDEX IF NOT EXISTS ix_usuarios_perfil_id ON usuarios(perfil_id);
CREATE INDEX IF NOT EXISTS ix_usuarios_departamento_id ON usuarios(departamento_id);

CREATE TABLE IF NOT EXISTS categorias (
    id VARCHAR(40) PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_categorias_nome UNIQUE (nome),
    CONSTRAINT ck_categorias_id_nao_vazio CHECK (btrim(id) <> ''),
    CONSTRAINT ck_categorias_nome_nao_vazio CHECK (btrim(nome) <> '')
);

CREATE TABLE IF NOT EXISTS documentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo VARCHAR(240) NOT NULL,
    categoria_id VARCHAR(40) NOT NULL REFERENCES categorias(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    data_documento DATE NOT NULL,
    assunto VARCHAR(300) NOT NULL,
    descricao TEXT,
    criado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_documentos_titulo_nao_vazio CHECK (btrim(titulo) <> ''),
    CONSTRAINT ck_documentos_assunto_nao_vazio CHECK (btrim(assunto) <> '')
);
CREATE INDEX IF NOT EXISTS ix_documentos_categoria_data ON documentos(categoria_id, data_documento DESC);
CREATE INDEX IF NOT EXISTS ix_documentos_criado_em ON documentos(criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_documentos_criado_por ON documentos(criado_por);

CREATE TABLE IF NOT EXISTS palavras_chave (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    termo VARCHAR(100) NOT NULL,
    termo_normalizado VARCHAR(100) NOT NULL,
    CONSTRAINT uq_palavras_chave_normalizado UNIQUE (termo_normalizado),
    CONSTRAINT ck_palavras_chave_termo_nao_vazio CHECK (btrim(termo) <> '')
);

CREATE TABLE IF NOT EXISTS documento_palavras_chave (
    documento_id BIGINT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    palavra_chave_id BIGINT NOT NULL REFERENCES palavras_chave(id) ON DELETE CASCADE,
    PRIMARY KEY (documento_id, palavra_chave_id)
);
CREATE INDEX IF NOT EXISTS ix_documento_palavras_chave_palavra ON documento_palavras_chave(palavra_chave_id);

-- Metadados somente. O conteúdo deve ficar em armazenamento privado, nunca em pasta pública.
CREATE TABLE IF NOT EXISTS arquivos_documento (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    documento_id BIGINT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    nome_original VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL,
    extensao VARCHAR(10) NOT NULL,
    mime_type VARCHAR(150),
    tamanho_bytes BIGINT NOT NULL,
    sha256 CHAR(64),
    principal BOOLEAN NOT NULL DEFAULT FALSE,
    enviado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_arquivos_storage_key UNIQUE (storage_key),
    CONSTRAINT ck_arquivos_nome_nao_vazio CHECK (btrim(nome_original) <> ''),
    CONSTRAINT ck_arquivos_extensao CHECK (extensao = lower(extensao) AND extensao ~ '^[a-z0-9]{1,10}$'),
    CONSTRAINT ck_arquivos_tamanho CHECK (tamanho_bytes >= 0),
    CONSTRAINT ck_arquivos_sha256 CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-fA-F]{64}$')
);
-- No máximo um arquivo principal por documento; documento sem arquivo também é permitido.
CREATE UNIQUE INDEX IF NOT EXISTS uq_arquivos_documento_principal
    ON arquivos_documento(documento_id) WHERE principal;
CREATE INDEX IF NOT EXISTS ix_arquivos_documento_id ON arquivos_documento(documento_id);

CREATE TABLE IF NOT EXISTS tokens_redefinicao_senha (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL,
    expira_em TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tokens_redefinicao_hash UNIQUE (token_hash),
    CONSTRAINT ck_tokens_redefinicao_hash CHECK (token_hash ~ '^[0-9a-fA-F]{64}$')
);
CREATE INDEX IF NOT EXISTS ix_tokens_redefinicao_usuario_expira ON tokens_redefinicao_senha(usuario_id, expira_em);

CREATE TABLE IF NOT EXISTS auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    documento_id BIGINT REFERENCES documentos(id) ON DELETE SET NULL,
    acao VARCHAR(60) NOT NULL,
    entidade VARCHAR(60) NOT NULL,
    entidade_id TEXT,
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip INET,
    user_agent TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_auditoria_acao_nao_vazia CHECK (btrim(acao) <> ''),
    CONSTRAINT ck_auditoria_entidade_nao_vazia CHECK (btrim(entidade) <> '')
);
CREATE INDEX IF NOT EXISTS ix_auditoria_usuario_data ON auditoria(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_documento_data ON auditoria(documento_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_acao_data ON auditoria(acao, criado_em DESC);

-- A busca inicial da API pode usar ILIKE. Para grandes volumes, medir e adicionar
-- pg_trgm ou adaptar a consulta para full-text search antes de criar índices específicos.

COMMIT;
