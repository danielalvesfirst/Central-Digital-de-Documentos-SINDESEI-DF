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

function tabela(itens) {
  if (!itens.length)
    return el("p", {
      className: "vazio",
      textContent:
        "Nenhum documento encontrado. Ajuste a busca ou cadastre um novo documento.",
    });
  const t = el("table", { className: "tab" });
  t.append(
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        ...[
          "Nome do documento",
          "Categoria",
          "Data de cadastro",
          "Assunto",
        ].map((h) => el("th", { textContent: h })),
        el("th", {}, el("span", { className: "sr-only", textContent: "Ver" })),
      ),
    ),
  );
  t.append(
    el(
      "tbody",
      {},
      ...itens.map((d) => {
        const ver = el("a", {
          className: "ver",
          href: "documento.html?id=" + d.id,
          "aria-label": "Ver " + d.titulo,
        });
        ver.innerHTML = olho;
        return el(
          "tr",
          {},
          el(
            "td",
            {},
            el("a", {
              className: "nome",
              href: "documento.html?id=" + d.id,
              textContent: d.titulo,
            }),
          ),
          el("td", { textContent: nomeCat(d.categoria) }),
          el("td", { textContent: dataBR(d.data) }),
          el("td", { textContent: d.assunto }),
          el("td", {}, ver),
        );
      }),
    ),
  );
  return el("div", { className: "rolagem" }, t);
}
async function sessao() {
  const me = await Api.me();
  const pode = (p) => (me.permissoes || []).includes(p);
  pode.me = me;
  return pode;
} // só esconde botões (UX); quem protege é o servidor
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
    el("p", { className: "msg erro", textContent: e.message }),
  );

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
  async documentos() {
    const pode = await sessao();
    Shell.montar("documentos", "Central Digital de Documentos", "", pode);
    cats = await Api.categorias();
    let cat = params.get("categoria") || "",
      pagina = 1;
    const busca = el("input", {
      type: "search",
      placeholder: "Pesquisar por título, assunto ou palavra-chave",
      "aria-label": "Pesquisar documentos",
    });
    const novo = el("button", {
      type: "button",
      className: "btn btn-ouro",
      textContent: "+ Cadastrar novo documento",
    });
    const chips = el("div", { className: "chips" }),
      msg = el("p", { className: "msg", role: "status" }),
      lista = el("div");
    main.append(
      el("h2", { textContent: "Listagem geral de documentos" }),
      el("div", { className: "barra" }, busca, novo),
      chips,
      msg,
      lista,
    );
    const desenharChips = () =>
      chips.replaceChildren(
        ...[
          {
            id: "",
            nome: "Todos",
            total: cats.reduce((s, c) => s + c.total, 0),
          },
          ...cats,
        ].map((c) => {
          const b = el("button", {
            type: "button",
            className: "chip",
            textContent: `${c.nome} (${c.total})`,
            "aria-pressed": c.id === cat,
          });
          b.onclick = () => {
            cat = c.id;
            pagina = 1;
            desenharChips();
            carregar();
          };
          return b;
        }),
      );
    async function carregar() {
      try {
        const r = await Api.documentos({
          categoria: cat,
          busca: busca.value.trim(),
          pagina,
          limite: 20,
        });
        lista.replaceChildren(
          tabela(r.itens),
          pager(r, (p) => {
            pagina = p;
            carregar();
          }),
        );
        msg.textContent = "";
      } catch (e) {
        msg.textContent = e.message;
        msg.className = "msg erro";
      }
    }
    const salvo = async () => {
      pagina = 1;
      cats = await Api.categorias();
      desenharChips();
      carregar();
      msg.textContent = "Documento cadastrado.";
      msg.className = "msg ok";
    };
    let t;
    busca.oninput = () => {
      pagina = 1;
      clearTimeout(t);
      t = setTimeout(carregar, 300);
    };
    novo.hidden = !pode("documentos:cadastrar");
    novo.onclick = () => Cadastro.abrir(salvo);
    desenharChips();
    await carregar();
    if (params.has("novo") && pode("documentos:cadastrar"))
      Cadastro.abrir(salvo);
  },
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
    ed.onclick = () => Cadastro.abrir(() => location.reload(), d);
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
