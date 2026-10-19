alert("JavaScript conectado!");
const formulario = document.querySelector("#form-tarefa");
const campoTitulo = document.querySelector("#titulo");
const campoDescricao = document.querySelector("#descricao");
const campoResponsavel = document.querySelector("#responsavel");
const campoPrazo = document.querySelector("#prazo");

const lista = document.querySelector(".lista-tarefas");
const filtroStatus = document.querySelector("#filtro-status");
const filtroResponsavel = document.querySelector("#filtro-responsavel");
const contador = document.querySelector(".tarefas > p");
const botaoSalvar = formulario.querySelector('button[type="submit"]');

const CHAVE = "gerenciador-tarefas";
let idEmEdicao = null;

// Carrega as tarefas salvas ou começa com uma lista vazia.
function carregarTarefas() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE));

    if (!Array.isArray(dados)) return [];

    return dados.filter(tarefa =>
      tarefa &&
      typeof tarefa.id === "string" &&
      typeof tarefa.titulo === "string" &&
      typeof tarefa.descricao === "string" &&
      typeof tarefa.responsavel === "string" &&
      typeof tarefa.prazo === "string" &&
      ["pendente", "em-andamento", "concluida"].includes(tarefa.status)
    );
  } catch {
    return [];
  }
}

let tarefas = carregarTarefas();

function salvarTarefas() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(tarefas));
  } catch {
    alert("Não foi possível salvar no navegador. As alterações ficam disponíveis nesta página até você fechá-la.");
  }
}

function formatarPrazo(prazo) {
  if (!prazo) return "sem prazo";

  const [ano, mes, dia] = prazo.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Usa a data local do computador para comparar os prazos.
function dataDeHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);

  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;

  return elemento;
}

function criarBotao(texto, acao, id) {
  const botao = criarElemento("button", "", texto);

  botao.type = "button";
  botao.dataset.acao = acao;
  botao.dataset.id = id;

  return botao;
}

function renderizarTarefas() {
  const statusSelecionado = filtroStatus.value;
  const nomePesquisado = filtroResponsavel.value.trim().toLocaleLowerCase("pt-BR");

  const tarefasFiltradas = tarefas.filter(tarefa => {
    const correspondeStatus =
      !statusSelecionado || tarefa.status === statusSelecionado;

    const correspondeResponsavel = tarefa.responsavel
      .toLocaleLowerCase("pt-BR")
      .includes(nomePesquisado);

    return correspondeStatus && correspondeResponsavel;
  });

  lista.replaceChildren();

  contador.textContent =
    `Mostrando ${tarefasFiltradas.length} de ${tarefas.length} tarefas`;

  if (tarefasFiltradas.length === 0) {
    lista.append(criarElemento("li", "", "Nenhuma tarefa encontrada."));
    return;
  }

  const nomesStatus = {
    pendente: "Pendente",
    "em-andamento": "Em andamento",
    concluida: "Concluída"
  };

  tarefasFiltradas.forEach(tarefa => {
    const item = criarElemento("li");
    const artigo = criarElemento("article", "tarefa");
    const cabecalho = criarElemento("header", "tarefa-cabecalho");
    const titulo = criarElemento("h3", "", tarefa.titulo);
    const indicadores = criarElemento("div", "indicadores");

    indicadores.append(
      criarElemento("span", "status", nomesStatus[tarefa.status])
    );

    if (
      tarefa.prazo &&
      tarefa.prazo < dataDeHoje() &&
      tarefa.status !== "concluida"
    ) {
      indicadores.append(criarElemento("span", "atrasada", "Atrasada"));
    }

    cabecalho.append(titulo, indicadores);
    artigo.append(cabecalho);

    if (tarefa.descricao) {
      artigo.append(criarElemento("p", "", tarefa.descricao));
    }

    const rodape = criarElemento("footer", "tarefa-rodape");
    const detalhes = criarElemento("div", "tarefa-detalhes");

    detalhes.append(
      criarElemento("span", "", `Responsável: ${tarefa.responsavel}`),
      criarElemento("span", "", `Prazo: ${formatarPrazo(tarefa.prazo)}`)
    );

    const acoes = criarElemento("div", "tarefa-acoes");

    // Permite mudar o status diretamente no cartão.
    const seletorStatus = criarElemento("select");
    seletorStatus.dataset.id = tarefa.id;
    seletorStatus.setAttribute(
      "aria-label",
      `Status da tarefa: ${tarefa.titulo}`
    );

    Object.entries(nomesStatus).forEach(([valor, nome]) => {
      const opcao = criarElemento("option", "", nome);
      opcao.value = valor;
      seletorStatus.append(opcao);
    });

    seletorStatus.value = tarefa.status;

    acoes.append(
      seletorStatus,
      criarBotao("Editar", "editar", tarefa.id),
      criarBotao("Excluir", "excluir", tarefa.id)
    );

    rodape.append(detalhes, acoes);
    artigo.append(rodape);
    item.append(artigo);
    lista.append(item);
  });
}

function encerrarEdicao() {
  idEmEdicao = null;
  formulario.reset();
  botaoSalvar.textContent = "Adicionar tarefa";
}

// Adiciona uma tarefa ou salva a edição.
formulario.addEventListener("submit", evento => {
  evento.preventDefault();

  const titulo = campoTitulo.value.trim();
  const responsavel = campoResponsavel.value.trim();

  if (!titulo || !responsavel) {
    alert("Preencha o título e o responsável.");

    if (!titulo) campoTitulo.focus();
    else campoResponsavel.focus();

    return;
  }

  const dados = {
    titulo,
    descricao: campoDescricao.value.trim(),
    responsavel,
    prazo: campoPrazo.value
  };

  if (idEmEdicao !== null) {
    tarefas = tarefas.map(tarefa =>
      tarefa.id === idEmEdicao ? { ...tarefa, ...dados } : tarefa
    );
  } else {
    tarefas.push({
      id: crypto.randomUUID(),
      ...dados,
      status: "pendente"
    });
  }

  salvarTarefas();
  encerrarEdicao();
  renderizarTarefas();
});

// Identifica qual botão da lista foi clicado.
lista.addEventListener("click", evento => {
  const botao = evento.target.closest("button[data-acao]");

  if (!botao) return;

  const { id, acao } = botao.dataset;
  const tarefa = tarefas.find(tarefa => tarefa.id === id);

  if (!tarefa) return;

  if (acao === "editar") {
    idEmEdicao = id;

    campoTitulo.value = tarefa.titulo;
    campoDescricao.value = tarefa.descricao;
    campoResponsavel.value = tarefa.responsavel;
    campoPrazo.value = tarefa.prazo;

    botaoSalvar.textContent = "Salvar alterações";
    campoTitulo.focus();
  }

  if (acao === "excluir") {
    if (!confirm(`Excluir a tarefa "${tarefa.titulo}"?`)) return;

    tarefas = tarefas.filter(tarefa => tarefa.id !== id);

    if (idEmEdicao === id) encerrarEdicao();

    salvarTarefas();
    renderizarTarefas();
  }
});

// Atualiza o status de uma tarefa.
lista.addEventListener("change", evento => {
  const seletor = evento.target;

  if (!seletor.matches("select[data-id]")) return;

  const tarefa = tarefas.find(tarefa => tarefa.id === seletor.dataset.id);

  if (!tarefa) return;

  tarefa.status = seletor.value;

  salvarTarefas();
  renderizarTarefas();
});

filtroStatus.addEventListener("change", renderizarTarefas);
filtroResponsavel.addEventListener("input", renderizarTarefas);

renderizarTarefas();