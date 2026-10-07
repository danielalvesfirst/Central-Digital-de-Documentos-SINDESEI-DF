// Única camada que fala com o back. Contrato completo em docs/API.md
const Api = (() => {
  const { API_BASE, USE_MOCK } = window.APP_CONFIG;

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
        ],
      };
    if (path === "/categorias")
      return CATS.map(([id, nome, descricao]) => ({
        id,
        nome,
        descricao,
        total: db.docs.filter((d) => d.categoria === id).length,
      }));
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
          (!t ||
            [d.titulo, d.assunto, (d.palavrasChave || []).join(" "), cat(d)]
              .join(" ")
              .toLowerCase()
              .includes(t)),
      );
      return {
        itens: todos.slice((pag - 1) * lim, pag * lim),
        total: todos.length,
        pagina: pag,
        limite: lim,
        totalPaginas: Math.max(1, Math.ceil(todos.length / lim)),
      };
    }
  }
})();
