package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if err := executar(); err != nil {
		log.Fatal(err)
	}
}

func executar() error {
	enderecoBanco := os.Getenv("DATABASE_URL")

	if enderecoBanco == "" {
		log.Println("Configure a variável DATABASE_URL antes de iniciar.")
		return nil
	}

	ctx, cancelar := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelar()

	banco, err := pgxpool.New(ctx, enderecoBanco)
	if err != nil {
		return err
	}
	defer banco.Close()

	if err := banco.Ping(ctx); err != nil {
		return err
	}

	log.Println("Conexão com PostgreSQL confirmada")

	mux := http.NewServeMux()

	mux.HandleFunc("/tarefas", gerenciarTarefas(banco))
	mux.HandleFunc("/tarefas/", gerenciarTarefa(banco))

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			http.NotFound(w, r)
			return
		}

		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
			return
		}

		ctx, cancelar := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancelar()

		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		if err := banco.Ping(ctx); err != nil {
			log.Println("Falha ao verificar PostgreSQL:", err)

			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"status": "erro",
				"banco":  "indisponível",
			})
			return
		}

		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"servico": "gerenciador-tarefas",
			"banco":   "conectado",
		})
	})

	servidor := &http.Server{
		Addr:              "127.0.0.1:8082",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Println("Iniciando API em http://localhost:8082")

	return servidor.ListenAndServe()
}
