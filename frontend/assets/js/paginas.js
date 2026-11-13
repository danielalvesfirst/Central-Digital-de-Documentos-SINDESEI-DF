const params = new URLSearchParams(location.search),
  main = $("#conteudo");
let cats = [];
const nomeCat = (id) => (cats.find((c) => c.id === id) || {}).nome || id;
const ICONES_CAT = {
  atas: "Atas",
  comunicacao: "Comunicacao",
  convencoes: "Convencoes-coletivas",
  administrativos: "iconFile",
  eventos: "Calendar2Check",
  oficios: "Oficios",
  parcerias: "Parcerias-Convenios",
  relatorios: "FileBarGraph",
};
const olho =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';

function tabela(itens, { aoFavorito, vazio } = {}) {
  if (!itens.length) return el("p", { className: "vazio", textContent: vazio || "Nenhum documento encontrado." });
  const t = el("table", { className: "tab" });
  t.append(
    el("caption", { className: "sr-only", textContent: "Documentos" }),
    el("thead", {}, el("tr", {},
      el("th", {}, el("span", { className: "sr-only", textContent: "Favorito" })),
      ...["Nome do documento", "Categoria", "Data de cadastro", "Assunto"].map((h) => el("th", { textContent: h })),
      el("th", {}, el("span", { className: "sr-only", textContent: "Ver" })))),
    el("tbody", {}, ...itens.map((d) => {
      const ver = el("a", { className: "ver", href: "documento.html?id=" + d.id, "aria-label": "Ver " + d.titulo });
      ver.innerHTML = olho;
      const tr = el("tr", { className: [d.classificacao === "confidencial" ? "conf" : "", d.favorito ? "fav" : ""].join(" ").trim() });
      tr.append(
        el("td", {}, botaoFavorito(d, { aoAlterar: (x) => { tr.classList.toggle("fav", !!x.favorito); if (aoFavorito) aoFavorito(x); } })),
        el("td", {}, el("a", { className: "nome", href: "documento.html?id=" + d.id, textContent: d.titulo }), seloClassificacao(d)),
        el("td", { textContent: nomeCat(d.categoria) }), el("td", { textContent: dataBR(d.data) }), el("td", { textContent: d.assunto }), el("td", {}, ver));
      return tr;
    })));
  return el("div", { className: "rolagem" }, t);
}
function pager(r, ir) {
  if (r.totalPaginas <= 1) return "";
  const b = (txt, p, off) => {
    const x = el("button", {
      type: "button",
      className: "btn btn-vazado",
      textContent: txt,
      disabled: off,
    });
    x.onclick = () => ir(p);
    return x;
  };
  return el(
    "nav",
    { className: "pager", "aria-label": "Paginação" },
    b("Anterior", r.pagina - 1, r.pagina <= 1),
    el("span", {
      textContent: `Página ${r.pagina} de ${r.totalPaginas} (${r.total} documentos)`,
    }),
    b("Próxima", r.pagina + 1, r.pagina >= r.totalPaginas),
  );
}
const erroTela = (e) =>
  main.replaceChildren(
    el("p", { className: "msg erro", textContent: e.negado ? "Você não tem autorização para visualizar este conteúdo." : e.message }),
    el("a", { href: "documentos.html", textContent: "Voltar para os documentos" }),
  );


// Listagem de documentos com filtros combináveis, ordenação e paginação. Tudo é aplicado pelo servidor (nada de filtro local).
async function paginaDocumentos(soFav) {
  const pode = await sessao();
  Shell.montar(soFav ? "favoritos" : "documentos", "Central Digital de Documentos", "", pode);
  cats = await Api.categorias();
  const CAMPOS = ["busca", "categoria", "tipo", "de", "ate", "responsavel", "classificacao", "favoritos", "ordem"];
  const f = Object.fromEntries(CAMPOS.map((k) => [k, params.get(k) || ""]));
  if (soFav) f.favoritos = "1";
  let pagina = +params.get("pagina") || 1, tmr;
  const sel = (id, ops) => { const s = el("select", { id: "f-" + id }, ...ops.map(([v, x]) => el("option", { value: v, textContent: x }))); s.value = f[id]; return s; };
  const campo = (id, rotulo, ent) => el("div", { className: "campo" }, el("label", { htmlFor: "f-" + id, textContent: rotulo }), ent);

  const busca = el("input", { type: "search", id: "f-busca", value: f.busca, placeholder: "Pesquisar por título, assunto ou palavra-chave", "aria-label": "Pesquisar documentos" });
  const novo = el("button", { type: "button", className: "btn btn-ouro", textContent: "+ Cadastrar novo documento", hidden: soFav || !pode("documentos:cadastrar") });
  const toggle = el("button", { type: "button", className: "btn btn-vazado btn-filtros", "aria-expanded": "false", "aria-controls": "painel-filtros" });
  const chips = el("div", { className: "chips" }), ativos = el("div", { className: "ativos", role: "group", "aria-label": "Filtros ativos" });
  const contador = el("p", { className: "contador", role: "status" }), lista = el("div", { className: "resultado" });

  const catSel = soFav ? sel("categoria", [["", "Todas"], ...cats.map((c) => [c.id, c.nome])]) : null;
  const tipo = sel("tipo", [["", "Todos"], ...window.APP_CONFIG.TIPOS_ARQUIVO.map((x) => [x, x.toUpperCase()])]);
  const classif = sel("classificacao", [["", "Todas"], ["geral", "Acesso geral"], ["confidencial", "Confidencial"]]);
  const ordem = sel("ordem", [["", "Mais recentes"], ["antigos", "Mais antigos"], ["nome_asc", "Nome (A a Z)"], ["nome_desc", "Nome (Z a A)"], ["relevancia", "Relevância (com busca por texto)"]]);
  const de = el("input", { type: "date", id: "f-de", value: f.de }), ate = el("input", { type: "date", id: "f-ate", value: f.ate });
  const resp = el("input", { type: "text", id: "f-responsavel", value: f.responsavel, maxLength: 80 });
  const favChk = el("input", { type: "checkbox", id: "f-favoritos", checked: f.favoritos === "1" });
  const limpar = el("button", { type: "button", className: "btn btn-vazado btn-sm", textContent: "Limpar filtros" });
  const painel = el("aside", { id: "painel-filtros", className: "painel-filtros", "aria-label": "Filtros" }, el("h3", { textContent: "Filtros" }),
    ...[catSel && campo("categoria", "Categoria", catSel), campo("tipo", "Tipo de arquivo", tipo), campo("de", "Cadastrado de", de), campo("ate", "Cadastrado até", ate),
      campo("responsavel", "Responsável pelo cadastro", resp), campo("classificacao", "Classificação de acesso", classif),
      !soFav && el("label", { className: "chk", htmlFor: "f-favoritos" }, favChk, "Somente favoritos"), campo("ordem", "Ordenar por", ordem), limpar].filter(Boolean));

  const ler = () => { Object.assign(f, { busca: busca.value.trim(), tipo: tipo.value, de: de.value, ate: ate.value, responsavel: resp.value.trim(), classificacao: classif.value, ordem: ordem.value });
    if (!soFav) f.favoritos = favChk.checked ? "1" : ""; if (catSel) f.categoria = catSel.value; };
  const zerar = { busca: () => (busca.value = ""), tipo: () => (tipo.value = ""), de: () => (de.value = ""), ate: () => (ate.value = ""), responsavel: () => (resp.value = ""),
    classificacao: () => (classif.value = ""), favoritos: () => (favChk.checked = false), categoria: () => { if (catSel) catSel.value = ""; } };
  const descricao = { busca: (v) => `Busca: ${v}`, categoria: (v) => `Categoria: ${nomeCat(v)}`, tipo: (v) => `Tipo: ${v.toUpperCase()}`, de: (v) => `De: ${dataBR(v)}`, ate: (v) => `Até: ${dataBR(v)}`,
    responsavel: (v) => `Responsável: ${v}`, classificacao: (v) => (v === "geral" ? "Acesso geral" : "Confidencial"), favoritos: () => "Somente favoritos" };
  const chavesAtivas = () => Object.keys(descricao).filter((k) => f[k] && !(soFav && k === "favoritos"));
  const aplicar = () => { ler(); pagina = 1; desenharChips(); carregar(); };
  const limparTudo = () => { Object.keys(zerar).forEach((k) => zerar[k]()); aplicar(); };
  limpar.onclick = limparTudo;

  function desenharAtivos() {
    const ks = chavesAtivas();
    toggle.textContent = ks.length ? `Filtros (${ks.length})` : "Filtros";
    ativos.replaceChildren(...ks.map((k) => { const b = el("button", { type: "button", className: "chip-ativo", textContent: descricao[k](f[k]) + " ×", "aria-label": `Remover filtro: ${descricao[k](f[k])}` }); b.onclick = () => { zerar[k](); aplicar(); }; return b; }));
    ordem.querySelector("option[value=relevancia]").disabled = !f.busca;
  }
  function desenharChips() {
    if (soFav) return;
    chips.replaceChildren(...[{ id: "", nome: "Todos", total: cats.reduce((s, c) => s + c.total, 0) }, ...cats].map((c) => {
      const b = el("button", { type: "button", className: "chip", textContent: `${c.nome} (${c.total})`, "aria-pressed": c.id === f.categoria });
      b.onclick = () => { f.categoria = c.id; pagina = 1; desenharChips(); carregar(); }; return b; }));
  }
  const vazioEl = () => el("div", { className: "vazio" }, el("p", { textContent: chavesAtivas().length ? "Nenhum documento encontrado com esses filtros." : soFav ? "Você ainda não tem favoritos. Use a estrela nos documentos para guardá-los aqui." : "Nenhum documento cadastrado ainda." }),
    ...(chavesAtivas().length ? [(() => { const b = el("button", { type: "button", className: "btn btn-sm", textContent: "Limpar filtros" }); b.onclick = limparTudo; return b; })()] : []));
  const erroEl = (e) => { const b = el("button", { type: "button", className: "btn btn-sm", textContent: "Tentar novamente" }); b.onclick = carregar;
    return el("div", { className: "vazio" }, el("p", { className: "msg erro", role: "alert", textContent: e.negado ? "Você não tem permissão para ver estes documentos." : e.pendente ? "Esta função ainda não está disponível." : e.message }), b); };

  async function carregar() {
    const q = new URLSearchParams(); CAMPOS.forEach((k) => { if (f[k] && !(soFav && k === "favoritos")) q.set(k, f[k]); }); if (pagina > 1) q.set("pagina", pagina);
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "")); desenharAtivos();
    if (f.de && f.ate && f.de > f.ate) { contador.textContent = ""; return lista.replaceChildren(el("p", { className: "msg erro", role: "alert", textContent: "A data inicial é posterior à data final." })); }
    lista.replaceChildren(el("p", { className: "carregando", role: "status", textContent: "Carregando documentos..." }));
    try {
      const r = await Api.documentos({ ...f, favoritos: f.favoritos, pagina, limite: 20 });
      if (!r.itens.length && pagina > 1) { pagina = 1; return carregar(); }
      contador.textContent = `${r.total} ${r.total === 1 ? "documento encontrado" : "documentos encontrados"}`;
      lista.replaceChildren(r.itens.length ? tabela(r.itens, { aoFavorito: soFav ? carregar : null }) : vazioEl(), pager(r, (p) => { pagina = p; carregar(); }));
    } catch (e) { contador.textContent = ""; lista.replaceChildren(erroEl(e)); }
  }
  const salvo = async () => { pagina = 1; cats = await Api.categorias(); desenharChips(); carregar(); toast("Documento salvo."); };
  const opcoes = { classificar: pode("documentos:permissoes") };

  busca.oninput = () => { clearTimeout(tmr); tmr = setTimeout(aplicar, 300); };
  resp.oninput = busca.oninput;
  [tipo, classif, ordem, de, ate, favChk, catSel].forEach((c) => c && (c.onchange = aplicar));
  toggle.onclick = () => { const aberto = painel.classList.toggle("aberto"); toggle.setAttribute("aria-expanded", String(aberto)); };
  novo.onclick = () => Cadastro.abrir(salvo, null, opcoes);

  main.append(el("h2", { textContent: soFav ? "Meus favoritos" : "Listagem geral de documentos" }),
    soFav ? el("p", { className: "sub", textContent: "Documentos que você marcou com a estrela." }) : "",
    el("div", { className: "barra" }, busca, novo, toggle), chips, ativos, el("div", { className: "docs-layout" }, painel, el("div", { className: "docs-main" }, contador, lista)));
  desenharChips(); await carregar();
  if (params.has("novo") && pode("documentos:cadastrar")) Cadastro.abrir(salvo, null, opcoes);
}

const telas = {
  async inicio() {
    const pode = await sessao();
    Shell.montar("inicio", "Central Digital de Documentos", "", pode);
    cats = await Api.categorias();
    const r = await Api.documentos({ pagina: 1, limite: 5 });
    const total = cats.reduce((s, c) => s + c.total, 0);
    const stat = (valor, rotulo) =>
      el("div", { className: "stat" }, el("strong", { textContent: String(valor) }), el("span", { textContent: rotulo }));
    const nome = (pode.me.nome || "").split(" ")[0];
    const atalhos = el("div", { className: "atalhos" },
      el("a", { className: "btn", href: "documentos.html", textContent: "Ver todos os documentos" }),
      el("a", { className: "btn btn-vazado", href: "categorias.html", textContent: "Ver categorias" }));
    if (pode("documentos:cadastrar"))
      atalhos.append(el("a", { className: "btn btn-ouro", href: "documentos.html?novo=1", textContent: "+ Cadastrar documento" }));
    main.append(
      el("h2", { textContent: nome ? `Olá, ${nome}` : "Início" }),
      el("p", { className: "sub", textContent: "Veja o resumo da central e os documentos mais recentes." }),
      el("div", { className: "stats" }, stat(total, "documentos cadastrados"), stat(cats.length, "categorias"),
        stat(cats.filter((c) => c.total).length, "categorias com documentos")),
      el("div", { className: "secao" }, el("h3", { textContent: "Últimos documentos" })),
      el("div", { className: "caixa" }, tabela(r.itens)),
      atalhos,
    );
  },
  documentos: () => paginaDocumentos(false),
  favoritos: () => paginaDocumentos(true),
  async categorias() {
    const pode = await sessao();
    Shell.montar("categorias", "Central Digital de Documentos", "", pode);
    const cs = await Api.categorias();
    main.append(
      el("h2", { textContent: "Categorias" }),
      el("p", {
        textContent: "Documentos agrupados por categoria.",
        style: "margin-bottom:20px",
      }),
      el(
        "div",
        { className: "cards" },
        ...cs.map((c) =>
          el(
            "a",
            { className: "card", href: "documentos.html?categoria=" + c.id },
            el("img", {
              src: `assets/icons/${ICONES_CAT[c.id] || "iconFile"}.svg`,
              alt: "",
            }),
            el("strong", { textContent: c.nome }),
            el("span", { textContent: c.descricao }),
          ),
        ),
      ),
    );
  },
  async documento() {
    const pode = await sessao();
    Shell.montar("documentos", "Central Digital de Documentos", "", pode);
    cats = await Api.categorias();
    const d = await Api.documento(params.get("id")),
      arqs = d.arquivos || [];
    const btns = el("div", { className: "btns" });
    btns.append(botaoFavorito(d, { rotulo: true }));
    if (arqs.length)
      btns.append(
        el("a", {
          className: "btn btn-vazado",
          href: Api.urlAbrir(d.id),
          target: "_blank",
          rel: "noopener",
          textContent: "Abrir documento",
        }),
        el("a", {
          className: "btn",
          href: Api.urlDownload(d.id),
          textContent: "Baixar",
        }),
      );
    const tags = el(
      "div",
      {},
      el("span", { className: "tag", textContent: nomeCat(d.categoria) }),
      d.tipo
        ? el("span", { className: "tag", textContent: d.tipo.toUpperCase() })
        : "",
      seloClassificacao(d),
    );
    const info = el(
      "div",
      { className: "painel", role: "tabpanel" },
      el("h3", { textContent: "Assunto" }),
      el("p", { textContent: d.assunto }),
      el("h3", { textContent: "Descrição", style: "color:#000" }),
      el("p", { textContent: d.descricao || "Sem descrição." }),
      el("h3", { textContent: "Palavras-chave", style: "color:#000" }),
      el(
        "div",
        {},
        ...(d.palavrasChave || []).map((k) =>
          el("span", { className: "kw", textContent: k }),
        ),
      ),
    );
    const arq = el(
      "div",
      { className: "painel", role: "tabpanel", hidden: true },
      ...(arqs.length
        ? arqs.map((a, i) =>
            el(
              "div",
              { className: "arq" },
              el("img", { src: iconeTipo(a.tipo), alt: "" }),
              el(
                "div",
                {},
                el("strong", { textContent: a.nome }),
                el("small", {
                  textContent: `${i === 0 ? "Arquivo principal" : "Anexo"} · ${tamanho(a.tamanhoBytes)} · ${dataBR(a.criadoEm)}`,
                }),
              ),
              el("a", {
                className: "btn",
                href: Api.urlArquivo(d.id, a.id),
                textContent: "Baixar",
              }),
            ),
          )
        : [
            el("p", {
              className: "vazio",
              textContent: "Este documento não tem arquivos anexados.",
            }),
          ]),
    );
    const abas = ["Informações", "Arquivos"].map((n, i) =>
      el("button", {
        type: "button",
        role: "tab",
        textContent: n,
        "aria-selected": i === 0,
      }),
    );
    abas.forEach(
      (b, i) =>
        (b.onclick = () => {
          abas.forEach((x, j) => x.setAttribute("aria-selected", i === j));
          info.hidden = i !== 0;
          arq.hidden = i !== 1;
        }),
    );
    const ed = el("button", {
      type: "button",
      className: "btn btn-vazado",
      textContent: "Editar documento",
      hidden: !pode("documentos:editar"),
    });
    ed.onclick = () => Cadastro.abrir(() => location.reload(), d, { classificar: pode("documentos:permissoes") });
    const ex = el("button", {
      type: "button",
      className: "btn btn-perigo",
      textContent: "Excluir documento",
      hidden: !pode("documentos:excluir"),
    });
    ex.onclick = async () => {
      if (!confirm(`Excluir "${d.titulo}"? Esta ação não pode ser desfeita.`))
        return;
      try {
        await Api.excluirDocumento(d.id);
        location.href = "documentos.html";
      } catch (e) {
        alert(e.message);
      }
    };
    const acoes = el(
      "div",
      { className: "barra", style: "margin-top:14px" },
      ed,
      ex,
      el("a", { className: "btn btn-vazado", href: "admin-documentos.html?acesso=" + d.id, textContent: "Gerenciar acesso", hidden: !pode("documentos:permissoes") }),
    );
    main.append(
      el(
        "div",
        { className: "ficha" },
        el(
          "div",
          { className: "quem" },
          el("img", { src: iconeTipo(d.tipo), alt: "" }),
          el("div", {}, el("h2", { textContent: d.titulo }), tags),
        ),
        btns,
      ),
      acoes,
      el("p", {
        className: "meta",
        textContent: [
          dataBR(d.data),
          "Criado por " + d.criadoPor,
          d.tamanhoBytes ? tamanho(d.tamanhoBytes) : "",
        ]
          .filter(Boolean)
          .join(" | "),
      }),
      el("div", { className: "abas", role: "tablist" }, ...abas),
      info,
      arq,
    );
  },
};
telas[document.body.dataset.pagina]().catch(erroTela);
