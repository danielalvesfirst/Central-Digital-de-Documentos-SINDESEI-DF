// Única camada que fala com o back. Contrato completo em docs/API.md
const Api = (() => {
  const { API_BASE, USE_MOCK } = window.APP_CONFIG;

  // Recurso que o backend ainda não oferece: a tela mostra qual endpoint falta (nada é simulado)
  const pendente = (metodo, endpoint) =>
    Object.assign(new Error("Esta funcionalidade ainda não está disponível."), { pendente: true, metodo, endpoint });

  async function req(path, { method = "GET", body, form } = {}) {
    if (USE_MOCK) return mock(method, path, body, form);
    const res = await fetch(API_BASE + path, {
      method,
      credentials: "include", // sessão via cookie HttpOnly
      headers: body ? { "Content-Type": "application/json" } : {},
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    if (res.status === 401 && !location.pathname.endsWith("index.html"))
      location.href = "index.html";
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      if (res.status === 403) throw Object.assign(new Error(e.mensagem || "Acesso negado."), { negado: true });
      if (path.startsWith("/admin") && (res.status === 501 || (res.status === 404 && !e.mensagem) || e.codigo === "ENDPOINT_NAO_IMPLEMENTADO")) throw pendente(method, path);
      throw new Error(e.mensagem || "Erro " + res.status);
    }
    return res.status === 204 ? null : res.json();
  }

  const q = (o) =>
    new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();
  const url = (p) => (USE_MOCK ? "#" : API_BASE + p);
  return {
    login: (email, senha) =>
      req("/auth/login", { method: "POST", body: { email, senha } }),
    logout: () => req("/auth/logout", { method: "POST" }),
    recuperar: (email) =>
      req("/auth/recuperar", { method: "POST", body: { email } }),
    redefinir: (token, senha) =>
      req("/auth/redefinir", { method: "POST", body: { token, senha } }),
    me: () => req("/me"),
    // Área administrativa: contrato proposto em docs/API-ADMIN.md
    admin: {
      resumo: () => req("/admin/resumo"),
      usuarios: (f) => req("/admin/usuarios?" + q(f)),
      usuario: (id) => req("/admin/usuarios/" + encodeURIComponent(id)),
      criarUsuario: (d) => req("/admin/usuarios", { method: "POST", body: d }),
      editarUsuario: (id, d) => req("/admin/usuarios/" + encodeURIComponent(id), { method: "PATCH", body: d }),
      bloquearUsuario: (id) => req(`/admin/usuarios/${encodeURIComponent(id)}/bloquear`, { method: "POST" }),
      reativarUsuario: (id) => req(`/admin/usuarios/${encodeURIComponent(id)}/reativar`, { method: "POST" }),
      perfis: () => req("/admin/perfis"),
      salvarPermissoes: (id, permissoes) => req(`/admin/perfis/${encodeURIComponent(id)}/permissoes`, { method: "PUT", body: { permissoes } }),
      categorias: () => req("/categorias?incluirInativas=1"),
      criarCategoria: (d) => req("/admin/categorias", { method: "POST", body: d }),
      editarCategoria: (id, d) => req("/admin/categorias/" + encodeURIComponent(id), { method: "PATCH", body: d }),
      ordenarCategorias: (ids) => req("/admin/categorias/ordem", { method: "PUT", body: { ids } }),
      auditoria: (f) => req("/admin/auditoria?" + q(f)),
      configuracoes: () => req("/admin/configuracoes"),
      salvarConfiguracoes: (d) => req("/admin/configuracoes", { method: "PUT", body: d }),
      // Acesso a documentos confidenciais
      acessoDocumento: (id) => req(`/admin/documentos/${encodeURIComponent(id)}/acesso`),
      classificarDocumento: (id, classificacao) => req(`/admin/documentos/${encodeURIComponent(id)}/classificacao`, { method: "PUT", body: { classificacao } }),
      conceder: (id, d) => req(`/admin/documentos/${encodeURIComponent(id)}/autorizacoes`, { method: "POST", body: d }),
      alterarAutorizacao: (id, aut, d) => req(`/admin/documentos/${encodeURIComponent(id)}/autorizacoes/${encodeURIComponent(aut)}`, { method: "PATCH", body: d }),
      revogarAutorizacao: (id, aut) => req(`/admin/documentos/${encodeURIComponent(id)}/autorizacoes/${encodeURIComponent(aut)}`, { method: "DELETE" }),
      grupos: (f) => req("/admin/grupos?" + q(f)),
    },
    atualizarMe: (dados) => req("/me", { method: "PATCH", body: dados }),
    enviarFoto: (f) => {
      const fd = new FormData();
      fd.append("foto", f);
      return req("/me/foto", { method: "POST", form: fd });
    },
    trocarSenha: (senhaAtual, novaSenha) =>
      req("/me/senha", { method: "POST", body: { senhaAtual, novaSenha } }),
    categorias: () => req("/categorias"),
    documentos: (filtros) => req("/documentos?" + q(filtros)),
    documento: (id) => req("/documentos/" + encodeURIComponent(id)),
    cadastrarDocumento: (formData) =>
      req("/documentos", { method: "POST", form: formData }),
    editarDocumento: (id, formData) =>
      req("/documentos/" + id, { method: "PATCH", form: formData }),
    excluirDocumento: (id) => req("/documentos/" + id, { method: "DELETE" }),
    urlDownload: (id) => url(`/documentos/${id}/download`),
    urlAbrir: (id) => url(`/documentos/${id}/download?inline=1`),
    urlArquivo: (id, arqId) =>
      url(`/documentos/${id}/arquivos/${arqId}/download`),
  };

  // ---------- MOCK (apagar quando o back existir) ----------
  async function mock(method, path, body, form) {
    await new Promise((r) => setTimeout(r, 200));
    const db = JSON.parse(sessionStorage.getItem("mock") || "null") || {
      docs: [],
    }; // sem exemplos: a lista começa vazia (cadastros de teste ficam só na aba aberta)
    const save = () => sessionStorage.setItem("mock", JSON.stringify(db));
    const CATS = [
      ["atas", "Atas", "Registro de reuniões e decisões."],
      ["comunicacao", "Comunicação", "Materiais e comunicados institucionais."],
      ["convencoes", "Convenções coletivas", "Acordos e normas trabalhistas."],
      [
        "administrativos",
        "Documentos administrativos",
        "Gestão interna e documentos do sindicato.",
      ],
      ["eventos", "Eventos", "Informações sobre eventos e atividades."],
      ["oficios", "Ofícios", "Comunicações oficiais e formais."],
      [
        "parcerias",
        "Parcerias e convênios",
        "Acordos com instituições parceiras.",
      ],
      ["relatorios", "Relatórios", "Dados, análises e resultados."],
    ];
    if (
      [
        "/auth/login",
        "/auth/logout",
        "/auth/recuperar",
        "/auth/redefinir",
        "/me/senha",
        "/me/foto",
      ].includes(path)
    )
      return null;
    if (path === "/me" && method === "PATCH") return { ...body };
    if (path === "/me")
      return {
        nome: "Exemplo da Silva",
        email: "exemplo@sindesei.org.br",
        cpf: "***.456.789-**",
        telefone: "(61) 99999-0000",
        cargo: "Gerente de Documentação",
        nivelAcesso: "Administrador",
        departamento: "Administrativo",
        permissoes: [
          "documentos:cadastrar",
          "documentos:editar",
          "documentos:excluir",
        "documentos:visualizar", "usuarios:gerenciar", "configuracoes:administrar", "auditoria:consultar", "documentos:permissoes",
        ],
      };
    if (path.startsWith("/admin")) return mockAdmin(method, path, body, db, save, CATS);
    if (path.split("?")[0] === "/categorias") {
      const todas = db.adm && db.adm.cats ? db.adm.cats : CATS.map(([id, nome, descricao]) => ({ id, nome, descricao, ativa: true }));
      const inativas = path.includes("incluirInativas=1");
      return todas.filter((c) => inativas || c.ativa !== false).map((c) => ({ ...c, total: db.docs.filter((d) => d.categoria === c.id).length }));
    }
    if (path === "/documentos" && method === "POST") {
      const f = form.get("arquivo"),
        ext = f ? f.name.split(".").pop().toLowerCase() : "";
      db.docs.unshift({
        id: Date.now(),
        titulo: form.get("titulo"),
        categoria: form.get("categoria"),
        data: form.get("data"),
        assunto: form.get("assunto"),
        descricao: form.get("descricao"),
        palavrasChave: form
          .get("palavrasChave")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        classificacao: form.get("classificacao") || "geral",
        criadoPor: "Exemplo da Silva",
        tipo: ext,
        tamanhoBytes: f ? f.size : 0,
        arquivos: f
          ? [
              {
                id: Date.now() + 1,
                nome: f.name,
                tipo: ext,
                tamanhoBytes: f.size,
                criadoEm: form.get("data"),
              },
            ]
          : [],
      });
      save();
      return null;
    }
    const um = path.match(/^\/documentos\/(\d+)$/);
    if (um && method === "DELETE") {
      db.docs = db.docs.filter((x) => x.id != um[1]);
      save();
      return null;
    }
    if (um && method === "PATCH") {
      const d = db.docs.find((x) => x.id == um[1]);
      if (!d) throw new Error("Documento não encontrado.");
      Object.assign(d, {
        classificacao: form.get("classificacao") || d.classificacao || "geral",
        titulo: form.get("titulo"),
        categoria: form.get("categoria"),
        data: form.get("data"),
        assunto: form.get("assunto"),
        descricao: form.get("descricao"),
        palavrasChave: form
          .get("palavrasChave")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      const f = form.get("arquivo");
      if (f && f.name) {
        const ext = f.name.split(".").pop().toLowerCase();
        d.tipo = ext;
        d.tamanhoBytes = f.size;
        d.arquivos = [
          {
            id: Date.now(),
            nome: f.name,
            tipo: ext,
            tamanhoBytes: f.size,
            criadoEm: d.data,
          },
          ...(d.arquivos || []).slice(1),
        ];
      }
      save();
      return null;
    }
    if (um) {
      const d = db.docs.find((x) => x.id == um[1]);
      if (!d) throw new Error("Documento não encontrado.");
      return d;
    }
    if (path.startsWith("/documentos")) {
      const p = new URLSearchParams(path.split("?")[1] || ""),
        c = p.get("categoria"),
        t = (p.get("busca") || "").toLowerCase(),
        lim = +p.get("limite") || 20,
        pag = +p.get("pagina") || 1;
      const cat = (d) =>
        (CATS.find((x) => x[0] === d.categoria) || [])[1] || "";
      const todos = db.docs.filter(
        (d) =>
          (!c || d.categoria === c) &&
          (!p.get("classificacao") || (d.classificacao || "geral") === p.get("classificacao")) &&
          (!t ||
            [d.titulo, d.assunto, (d.palavrasChave || []).join(" "), cat(d)]
              .join(" ")
              .toLowerCase()
              .includes(t)),
      );
      return {
        itens: todos.slice((pag - 1) * lim, pag * lim).map((d) => (d.classificacao === "confidencial" ? { ...d, autorizados: resumoAut(db, d.id) } : d)),
        total: todos.length,
        pagina: pag,
        limite: lim,
        totalPaginas: Math.max(1, Math.ceil(todos.length / lim)),
      };
    }
  }

  // ---------- MOCK ADMIN: só com USE_MOCK (apagar quando o backend existir) ----------
  // Os dados ficam na aba (sessionStorage). Com o backend real (USE_MOCK: false) nada disso é usado.
  function semente() {
    const TODAS_PERMISSOES = ["documentos:visualizar", "documentos:cadastrar", "documentos:editar", "documentos:excluir", "documentos:permissoes", "usuarios:gerenciar", "configuracoes:administrar", "auditoria:consultar"];
    // Sem registros de exemplo. Só os dois níveis de acesso do requisito, para os formulários funcionarem.
    return {
      perfis: [
        { id: "adm", nome: "Administrador", descricao: "Gerencia usuários, permissões e o acesso aos documentos, inclusive os confidenciais.", permissoes: [...TODAS_PERMISSOES] },
        { id: "com", nome: "Usuário comum", descricao: "Visualiza documentos de acesso geral e os confidenciais para os quais foi autorizado.", permissoes: ["documentos:visualizar"] },
      ],
      usuarios: [], grupos: [], cats: null, auts: {}, auditoria: [],
      config: { limiteUploadMb: 100, tiposArquivo: ["pdf", "doc", "docx", "xls", "xlsx", "txt", "png", "jpg", "zip"] },
    };
  }
  function resumoAut(db, id) {
    const l = (db.adm && db.adm.auts[id]) || [];
    return { usuarios: l.filter((a) => a.tipo === "usuario").length, grupos: l.filter((a) => a.tipo === "grupo").length };
  }
  function mockAdmin(method, path, body, db, save, CATS) {
    if (!db.adm) db.adm = semente();
    const A = db.adm, [rota, qs] = path.split("?"), p = new URLSearchParams(qs || "");
    const [, recurso, id, acao, sub] = rota.split("/").filter(Boolean); // ["admin", recurso, id, acao, sub]
    const nomePerfil = (pid) => (A.perfis.find((x) => x.id === pid) || {}).nome || "";
    const pag = (lista) => { const lim = +p.get("limite") || 20, n = +p.get("pagina") || 1; return { itens: lista.slice((n - 1) * lim, n * lim), total: lista.length, pagina: n, limite: lim, totalPaginas: Math.max(1, Math.ceil(lista.length / lim)) }; };
    const log = (a, r, d) => A.auditoria.unshift({ id: "e" + Date.now() + Math.random().toString(36).slice(2, 6), quando: new Date().toISOString(), usuario: "Exemplo da Silva", acao: a, recurso: r, detalhes: d || "" });
    const ok = () => { save(); return null; };
    const nada = () => { throw new Error("Registro não encontrado."); };

    if (recurso === "resumo") return { usuarios: { total: A.usuarios.length, ativos: A.usuarios.filter((x) => x.situacao === "ativo").length, bloqueados: A.usuarios.filter((x) => x.situacao === "bloqueado").length }, atividadesRecentes: A.auditoria.slice(0, 5) };

    if (recurso === "usuarios") {
      if (!id && method === "GET") {
        const b = (p.get("busca") || "").toLowerCase(), dp = (p.get("departamento") || "").toLowerCase();
        return pag(A.usuarios.filter((x) => (!b || (x.nome + " " + x.email).toLowerCase().includes(b)) && (!p.get("perfil") || x.perfilId === p.get("perfil")) && (!dp || (x.departamento || "").toLowerCase().includes(dp)) && (!p.get("situacao") || x.situacao === p.get("situacao"))).map((x) => ({ ...x, perfil: nomePerfil(x.perfilId) })));
      }
      if (!id && method === "POST") {
        if (A.usuarios.some((x) => x.email.toLowerCase() === String(body.email).toLowerCase())) throw new Error("Já existe um usuário com este e-mail.");
        const n = { id: "u" + Date.now(), situacao: "ativo", ultimoAcesso: null, criadoEm: new Date().toISOString(), ...body, cpf: "***." + String(body.cpf || "").replace(/\D/g, "").slice(3, 6) + ".***-**" };
        A.usuarios.push(n); log("usuario.cadastro", { tipo: "usuario", id: n.id, nome: n.nome }); return ok();
      }
      const x = A.usuarios.find((y) => y.id === id); if (!x) nada();
      const ref = { tipo: "usuario", id: x.id, nome: x.nome };
      if (!acao && method === "GET") return { ...x, perfil: nomePerfil(x.perfilId) };
      if (!acao && method === "PATCH") { const troca = body.perfilId && body.perfilId !== x.perfilId; Object.assign(x, body); log(troca ? "permissao.alteracao" : "usuario.edicao", ref); return ok(); }
      if (acao === "bloquear" || acao === "reativar") { x.situacao = acao === "bloquear" ? "bloqueado" : "ativo"; log(acao === "bloquear" ? "usuario.bloqueio" : "usuario.reativacao", ref); return ok(); }
    }

    if (recurso === "perfis") {
      if (!id) return A.perfis.map((x) => ({ ...x, usuarios: A.usuarios.filter((y) => y.perfilId === x.id).length }));
      const f = A.perfis.find((x) => x.id === id); if (!f) nada();
      if (acao === "permissoes" && method === "PUT") { f.permissoes = body.permissoes; log("permissao.alteracao", { tipo: "perfil", id: f.id, nome: f.nome }); return ok(); }
    }

    if (recurso === "categorias") {
      const cs = A.cats || (A.cats = CATS.map(([cid, nome, descricao]) => ({ id: cid, nome, descricao, ativa: true })));
      if (!id && method === "POST") { cs.push({ id: "c" + Date.now(), nome: body.nome, descricao: body.descricao || "", ativa: true }); return ok(); }
      if (id === "ordem" && method === "PUT") { A.cats = body.ids.map((i) => cs.find((c) => c.id === i)).filter(Boolean); return ok(); }
      const c = cs.find((x) => x.id === id); if (!c) nada();
      if (method === "PATCH") { Object.assign(c, body); return ok(); }
    }

    if (recurso === "auditoria") {
      const us = (p.get("usuario") || "").toLowerCase(), dc = (p.get("documento") || "").toLowerCase(), de = p.get("de"), ate = p.get("ate");
      return pag(A.auditoria.filter((e) => (!us || e.usuario.toLowerCase().includes(us)) && (!p.get("acao") || e.acao === p.get("acao")) &&
        (!dc || (e.recurso && e.recurso.tipo === "documento" && (String(e.recurso.id) === dc || (e.recurso.nome || "").toLowerCase().includes(dc)))) &&
        (!de || e.quando.slice(0, 10) >= de) && (!ate || e.quando.slice(0, 10) <= ate)));
    }

    if (recurso === "configuracoes") { if (method === "PUT") { A.config = { ...body }; return ok(); } return A.config; }

    if (recurso === "grupos") { const b = (p.get("busca") || "").toLowerCase(); return pag(A.grupos.filter((g) => !b || g.nome.toLowerCase().includes(b))); }

    if (recurso === "documentos") {
      const d = db.docs.find((x) => String(x.id) === id); if (!d) nada();
      const lista = A.auts[d.id] || (A.auts[d.id] = []), ref = { tipo: "documento", id: d.id, nome: d.titulo };
      if (acao === "acesso") return { classificacao: d.classificacao || "geral", autorizacoes: lista };
      if (acao === "classificacao" && method === "PUT") { d.classificacao = body.classificacao; log("documento.classificacao", ref); return ok(); }
      if (acao === "autorizacoes" && method === "POST") {
        if (lista.some((a) => a.tipo === body.tipo && a.sujeitoId === body.sujeitoId)) throw new Error("Esta autorização já existe.");
        const s = (body.tipo === "grupo" ? A.grupos : A.usuarios).find((y) => y.id === body.sujeitoId); if (!s) nada();
        lista.push({ id: "a" + Date.now(), tipo: body.tipo, sujeitoId: body.sujeitoId, nome: s.nome, concedidoPor: "Exemplo da Silva", concedidoEm: new Date().toISOString(), validaAte: body.validaAte });
        log("documento.acesso.concessao", ref, s.nome); return ok();
      }
      if (acao === "autorizacoes") {
        const a = lista.find((y) => y.id === sub); if (!a) nada();
        if (method === "PATCH") { a.validaAte = body.validaAte; log("documento.acesso.alteracao", ref, a.nome); return ok(); }
        if (method === "DELETE") { A.auts[d.id] = lista.filter((y) => y !== a); log("documento.acesso.revogacao", ref, a.nome); return ok(); }
      }
    }
    return nada();
  }
})();
