#!/bin/bash

# Script para desenvolvimento com Docker
# Uso: ./docker-dev.sh [comando]
# Comandos: up, down, restart, logs, rebuild

case "$1" in
  up)
    echo "🚀 Iniciando containers (hot reload ativo)..."
    docker-compose up
    ;;
  down)
    echo "🛑 Parando containers..."
    docker-compose down
    ;;
  restart)
    echo "🔄 Reiniciando containers..."
    docker-compose restart
    ;;
  logs)
    echo "📋 Mostrando logs..."
    docker-compose logs -f
    ;;
  rebuild)
    echo "🔨 Reconstruindo imagens..."
    docker-compose down
    docker-compose up --build
    ;;
  *)
    echo "Uso: ./docker-dev.sh [up|down|restart|logs|rebuild]"
    echo ""
    echo "Comandos:"
    echo "  up      - Inicia os containers (hot reload ativo)"
    echo "  down    - Para os containers"
    echo "  restart - Reinicia os containers"
    echo "  logs    - Mostra os logs em tempo real"
    echo "  rebuild - Reconstruir imagens (só quando necessário)"
    exit 1
    ;;
esac

