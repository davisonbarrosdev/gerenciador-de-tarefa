package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Tarefa struct {
	ID          int64  `json:"id"`
	Titulo      string `json:"titulo"`
	Descricao   string `json:"descricao"`
	Responsavel string `json:"responsavel"`
	Prazo       string `json:"prazo"`
	Status      string `json:"status"`
}

func gerenciarTarefas(banco *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			listarTarefas(banco, w, r)

		case http.MethodPost:
			criarTarefa(banco, w, r)

		default:
			w.Header().Set("Allow", "GET, POST")
			http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		}
	}
}

func listarTarefas(banco *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	ctx, cancelar := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancelar()

	linhas, err := banco.Query(ctx, `
		SELECT
			id,
			titulo,
			descricao,
			responsavel,
			COALESCE(to_char(prazo, 'YYYY-MM-DD'), ''),
			status
		FROM tarefas
		ORDER BY id DESC
	`)
	if err != nil {
		log.Println("Erro ao listar tarefas:", err)
		http.Error(w, "Erro ao listar tarefas", http.StatusInternalServerError)
		return
	}
	defer linhas.Close()

	tarefas := make([]Tarefa, 0)

	for linhas.Next() {
		var tarefa Tarefa

		err := linhas.Scan(
			&tarefa.ID,
			&tarefa.Titulo,
			&tarefa.Descricao,
			&tarefa.Responsavel,
			&tarefa.Prazo,
			&tarefa.Status,
		)
		if err != nil {
			log.Println("Erro ao ler tarefa:", err)
			http.Error(w, "Erro ao ler tarefas", http.StatusInternalServerError)
			return
		}

		tarefas = append(tarefas, tarefa)
	}

	if err := linhas.Err(); err != nil {
		log.Println("Erro na consulta:", err)
		http.Error(w, "Erro ao consultar tarefas", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(tarefas)
}

func criarTarefa(banco *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	var tarefa Tarefa

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	if err := json.NewDecoder(r.Body).Decode(&tarefa); err != nil {
		http.Error(w, "Envie uma tarefa em JSON válido", http.StatusBadRequest)
		return
	}

	tarefa.Titulo = strings.TrimSpace(tarefa.Titulo)
	tarefa.Descricao = strings.TrimSpace(tarefa.Descricao)
	tarefa.Responsavel = strings.TrimSpace(tarefa.Responsavel)
	tarefa.Prazo = strings.TrimSpace(tarefa.Prazo)

	if tarefa.Titulo == "" || tarefa.Responsavel == "" {
		http.Error(w, "Título e responsável são obrigatórios", http.StatusBadRequest)
		return
	}

	// Sem prazo, enviamos NULL ao PostgreSQL.
	var prazo *time.Time

	if tarefa.Prazo != "" {
		data, err := time.Parse("2006-01-02", tarefa.Prazo)
		if err != nil {
			http.Error(w, "Prazo deve estar no formato YYYY-MM-DD", http.StatusBadRequest)
			return
		}

		prazo = &data
	}

	tarefa.Status = "pendente"

	ctx, cancelar := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancelar()

	err := banco.QueryRow(ctx, `
		INSERT INTO tarefas (
			titulo, descricao, responsavel, prazo, status
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`,
		tarefa.Titulo,
		tarefa.Descricao,
		tarefa.Responsavel,
		prazo,
		tarefa.Status,
	).Scan(&tarefa.ID)

	if err != nil {
		log.Println("Erro ao cadastrar tarefa:", err)
		http.Error(w, "Erro ao cadastrar tarefa", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(tarefa)
}

func gerenciarTarefa(banco *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		textoID := strings.TrimPrefix(r.URL.Path, "/tarefas/")

		id, err := strconv.ParseInt(textoID, 10, 64)
		if err != nil || id <= 0 {
			http.Error(w, "ID inválido", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodPut:
			atualizarTarefa(banco, w, r, id)

		case http.MethodDelete:
			excluirTarefa(banco, w, r, id)

		default:
			w.Header().Set("Allow", "PUT, DELETE")
			http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		}
	}
}

func atualizarTarefa(
	banco *pgxpool.Pool,
	w http.ResponseWriter,
	r *http.Request,
	id int64,
) {
	var tarefa Tarefa

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	if err := json.NewDecoder(r.Body).Decode(&tarefa); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	tarefa.Titulo = strings.TrimSpace(tarefa.Titulo)
	tarefa.Descricao = strings.TrimSpace(tarefa.Descricao)
	tarefa.Responsavel = strings.TrimSpace(tarefa.Responsavel)
	tarefa.Prazo = strings.TrimSpace(tarefa.Prazo)

	if tarefa.Titulo == "" || tarefa.Responsavel == "" {
		http.Error(w, "Título e responsável são obrigatórios", http.StatusBadRequest)
		return
	}

	switch tarefa.Status {
	case "pendente", "em-andamento", "concluida":
		// Status válido.
	default:
		http.Error(w, "Status inválido", http.StatusBadRequest)
		return
	}

	var prazo *time.Time

	if tarefa.Prazo != "" {
		data, err := time.Parse("2006-01-02", tarefa.Prazo)
		if err != nil {
			http.Error(w, "Prazo deve estar no formato YYYY-MM-DD", http.StatusBadRequest)
			return
		}

		prazo = &data
	}

	ctx, cancelar := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancelar()

	resultado, err := banco.Exec(ctx, `
		UPDATE tarefas
		SET titulo = $1,
		    descricao = $2,
		    responsavel = $3,
		    prazo = $4,
		    status = $5
		WHERE id = $6
	`,
		tarefa.Titulo,
		tarefa.Descricao,
		tarefa.Responsavel,
		prazo,
		tarefa.Status,
		id,
	)

	if err != nil {
		log.Println("Erro ao atualizar tarefa:", err)
		http.Error(w, "Erro ao atualizar tarefa", http.StatusInternalServerError)
		return
	}

	if resultado.RowsAffected() == 0 {
		http.Error(w, "Tarefa não encontrada", http.StatusNotFound)
		return
	}

	tarefa.ID = id

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(tarefa)
}

func excluirTarefa(
	banco *pgxpool.Pool,
	w http.ResponseWriter,
	r *http.Request,
	id int64,
) {
	ctx, cancelar := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancelar()

	resultado, err := banco.Exec(
		ctx,
		"DELETE FROM tarefas WHERE id = $1",
		id,
	)

	if err != nil {
		log.Println("Erro ao excluir tarefa:", err)
		http.Error(w, "Erro ao excluir tarefa", http.StatusInternalServerError)
		return
	}

	if resultado.RowsAffected() == 0 {
		http.Error(w, "Tarefa não encontrada", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
