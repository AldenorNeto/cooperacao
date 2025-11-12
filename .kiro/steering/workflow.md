# Workflow e Regras de Desenvolvimento

## Comandos de Build

### Regra: NUNCA use `npm start`

- **SEMPRE** use apenas `npm run build` para validar o código
- O usuário mantém um terminal dedicado rodando `npm start` continuamente
- Executar `npm start` via Kiro causará conflitos de porta e processos duplicados

### Comandos Permitidos

```bash
npm run build           # ✅ Use este para compilar e validar
npm run type-check      # ✅ Verificar tipos
npm run lint            # ✅ Verificar linting
npm run format          # ✅ Formatar código
```

### Comandos Proibidos

```bash
npm start               # ❌ NUNCA use - usuário roda manualmente
npm run dev             # ❌ NUNCA use - usuário roda manualmente
node dist/server.js     # ❌ NUNCA use - usuário roda manualmente
```

## Fluxo de Trabalho

1. Fazer modificações nos arquivos TypeScript em `js/`
2. Executar `npm run build` para compilar
3. Verificar erros de compilação
4. Usuário testa manualmente no navegador (servidor já está rodando)

## Testes

- Não há framework de testes configurado
- Testes são feitos manualmente no navegador em `http://localhost:3000`
- Usuário observa comportamento da simulação em tempo real
