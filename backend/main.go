package main

import (
	"encoding/json
	"log"
	"net/http"
)

func main(){
	mux := http.NewServeMux()

	mux.HandleFunc("/health",verificarServidor)

	log.Println("API disponível em http://localhost:8082")

	err := http.ListenAndServe("127.0,0.1:8082",mux)
	if err != nil {
		log.Fatal(err)
	}
}

func verificarServidor(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/health" {
		http.NotFound(w, r)
		return
	}

	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	resposta := map[string]string{
		"status":  "ok",
		"servico": "gerenciador-tarefas",
	}

	if err := json.NewEncoder(w).Encode(resposta); err != nil {
		log.Println("Erro ao enviar resposta:", err)
	}
}



	
	
	