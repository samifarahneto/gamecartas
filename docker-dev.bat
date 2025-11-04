@echo off
REM Script para desenvolvimento com Docker no Windows
REM Uso: docker-dev.bat [comando]

if "%1"=="up" (
    echo Iniciando containers (hot reload ativo)...
    docker-compose up
    goto :end
)

if "%1"=="down" (
    echo Parando containers...
    docker-compose down
    goto :end
)

if "%1"=="restart" (
    echo Reiniciando containers...
    docker-compose restart
    goto :end
)

if "%1"=="logs" (
    echo Mostrando logs...
    docker-compose logs -f
    goto :end
)

if "%1"=="rebuild" (
    echo Reconstruindo imagens...
    docker-compose down
    docker-compose up --build
    goto :end
)

echo Uso: docker-dev.bat [up^|down^|restart^|logs^|rebuild]
echo.
echo Comandos:
echo   up      - Inicia os containers (hot reload ativo)
echo   down    - Para os containers
echo   restart - Reinicia os containers
echo   logs    - Mostra os logs em tempo real
echo   rebuild - Reconstruir imagens (só quando necessário)

:end

