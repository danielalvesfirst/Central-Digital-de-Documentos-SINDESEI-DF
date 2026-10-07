// Login, recuperar senha e definir nova senha (uma página por form, detecta pelo id)
const $ = (s) => document.querySelector(s);
function aviso(texto, tipo) {
  const m = $("#msg");
  m.textContent = texto;
  m.className = "msg " + tipo;
}
async function enviar(form, acao, ok) {
  const btn = form.querySelector("button");
  btn.disabled = true;
  aviso("", "");
  try {
    await acao();
    ok();
  } catch (e) {
    aviso(e.message, "erro");
  } finally {
    btn.disabled = false;
  }
}
$("#form-login")?.addEventListener("submit", (e) => {
  e.preventDefault();
  enviar(
    e.target,
    () => Api.login($("#email").value.trim(), $("#senha").value),
    () => (location.href = "inicio.html"),
  );
});
$("#form-recuperar")?.addEventListener("submit", (e) => {
  e.preventDefault();
  // Mensagem sempre igual, exista o e-mail ou não (evita descobrir contas)
  enviar(
    e.target,
    () => Api.recuperar($("#email").value.trim()),
    () =>
      aviso(
        "Se o e-mail estiver cadastrado, você receberá o link em instantes.",
        "ok",
      ),
  );
});
// Dois usos: link do e-mail (?token=...) redefine; sem token, o usuário logado troca informando a senha atual
const token = new URLSearchParams(location.search).get("token"),
  trocar = !token;
if ($("#form-nova-senha") && trocar) {
  $("#linha-atual").hidden = false;
  $("#senha-atual").required = true;
  $("#titulo").textContent = "Editar senha";
}
$("#form-nova-senha")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if ($("#nova-senha").value !== $("#confirmar-senha").value)
    return aviso("As senhas não são iguais.", "erro");
  const acao = trocar
    ? () => Api.trocarSenha($("#senha-atual").value, $("#nova-senha").value)
    : () => Api.redefinir(token, $("#nova-senha").value);
  enviar(e.target, acao, () => {
    aviso("Senha alterada. Redirecionando...", "ok");
    setTimeout(
      () => (location.href = trocar ? "conta.html" : "index.html"),
      1500,
    );
  });
});
