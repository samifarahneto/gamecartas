# 🐳 Guia de Desenvolvimento com Docker

## ⚡ Hot Reload Automático

O projeto já está configurado com **hot reload automático**! Você **NÃO precisa** fazer `down` e `up --build` toda vez.

## 🚀 Como Usar

### **Primeira vez (ou quando mudar dependências):**

```bash
docker-compose up --build
```

### **Depois disso (desenvolvimento normal):**

```bash
docker-compose up
```

Ou simplesmente deixe rodando e faça suas alterações. O hot reload detecta automaticamente!

## 📝 Comandos Úteis

### **Usando o script helper (Windows):**

```bash
docker-dev.bat up      # Inicia containers
docker-dev.bat restart # Reinicia containers
docker-dev.bat logs    # Ver logs
docker-dev.bat down    # Parar containers
docker-dev.bat rebuild # Reconstruir (só quando necessário)
```

### **Comandos diretos:**

```bash
# Iniciar (hot reload ativo)
docker-compose up

# Parar
docker-compose down

# Reiniciar (sem rebuild)
docker-compose restart

# Ver logs em tempo real
docker-compose logs -f

# Reconstruir imagens (só quando mudar Dockerfiles ou dependências)
docker-compose up --build
```

## ✅ Quando Usar `--build`?

**Só use `--build` quando:**

- ✅ Primeira vez rodando
- ✅ Mudou `requirements.txt` (backend)
- ✅ Mudou `package.json` (frontend)
- ✅ Mudou algum `Dockerfile`
- ✅ Mudou configurações do `docker-compose.yml`

**NÃO precisa usar `--build` quando:**

- ❌ Mudou código Python (`.py`)
- ❌ Mudou código React/TypeScript (`.tsx`, `.ts`)
- ❌ Mudou arquivos de configuração do projeto
- ❌ Qualquer alteração de código normal

## 🔥 Hot Reload Configurado

### Backend (FastAPI):

- ✅ `uvicorn --reload` ativo
- ✅ Volume mapeado: `./backend:/app`
- ✅ Detecta mudanças em `.py` automaticamente

### Frontend (Vite):

- ✅ `npm run dev` com HMR (Hot Module Replacement)
- ✅ Volume mapeado: `./frontend:/web`
- ✅ Detecta mudanças em `.tsx`, `.ts`, `.css` automaticamente

## 🐛 Problemas Comuns

### Hot reload não funciona?

1. Verifique se os volumes estão mapeados corretamente no `docker-compose.yml`
2. Certifique-se de que está usando `Dockerfile.dev` (não `Dockerfile`)
3. Verifique os logs: `docker-compose logs -f`

### Precisa limpar tudo?

```bash
docker-compose down -v  # Remove volumes também
docker-compose up --build
```

## 💡 Dica

Deixe o terminal rodando com `docker-compose up` e faça suas alterações normalmente. O hot reload detecta e atualiza automaticamente! 🎉
