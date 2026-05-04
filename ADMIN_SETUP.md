# 📋 SISTEMA DE ADMINISTRAÇÃO — Implementação Completa

## ✅ O que foi implementado

### 1. **Módulo de Administração (admin.js)**
- ✓ Verificação de role de admin para cada utilizador
- ✓ Gestão de utilizadores (promover/despromover a admin, eliminar)
- ✓ Cálculo de estatísticas básicas
- ✓ Operações de gestão de utilizadores no Firestore

### 2. **Interface de Administração**
- ✓ Seção oculta por padrão, apenas visível para admins
- ✓ Botão "⚙️ Admin" no header (apenas para admins)
- ✓ Painel com 3 abas:
  - **Utilizadores**: Gestão de contas, roles e permissões
  - **Dados Inseridos**: Placeholder (dados estão na Google Sheet)
  - **Estatísticas**: Placeholder (estatísticas na Google Sheet)

### 3. **Armazenamento de Dados**
- ✓ **Registos de Visitantes**: Guardados APENAS na Google Sheet via Cloud Function (sem mudanças)
- ✓ **Gestão de Utilizadores**: Guardados no Firestore
- ✓ **Auditoria**: Timestamps automáticos no Firestore

### 4. **Segurança**
- ✓ Verificação de admin via role no Firestore
- ✓ Acesso restrito apenas para utilizadores autenticados
- ✓ Confirmação antes de eliminar utilizadores

---

## 🔧 Configuração necessária no Firebase

### A. Criar colecção `utilizadores`

1. No Firebase Console, ir a **Firestore Database**
2. Criar colecção chamada `utilizadores`
3. Documento de exemplo:
```json
{
  "email": "admin@exemplo.pt",
  "nome": "Administrador",
  "isAdmin": true,
  "dataCriacaoDaTarefa": Timestamp(2024-05-04),
  "ultimoLogin": Timestamp(2024-05-04)
}
```

### B. Dados de Registos (Google Sheet)

Os dados de visitantes **continuam a ser guardados APENAS na Google Sheet** através da Cloud Function já configurada. **Nenhuma mudança é necessária no fluxo de dados**.

---

## 🚀 Como usar o sistema

### Para Utilizadores Normais
1. Login com credenciais
2. Preenchimento do formulário como habitualmente
3. Guardar dados (gravados na Google Sheet via Cloud Function, como antes)

### Para Administradores
1. Login com credenciais de admin
2. Um botão "⚙️ Admin" aparece no header (canto superior direito)
3. Clicar para abrir o painel de administração

#### Aba 1: Utilizadores
- **Ver lista** de todos os utilizadores registados
- **Promover** utilizador normal a administrador (⭐)
- **Despromover** admin de volta a utilizador (👤)
- **Eliminar** utilizador do sistema (🗑)

#### Aba 2: Dados Inseridos
- Placeholder no painel
- Dados continuam na Google Sheet (acessível via exportação manual)
- Futuro: Pode ser expandida com endpoint da Cloud Function

#### Aba 3: Estatísticas
- Placeholder no painel
- Estatísticas podem ser consultadas diretamente na Google Sheet
- Futuro: Pode ser expandida com endpoint da Cloud Function

---

## 📁 Ficheiros criados/modificados

### Novos ficheiros:
- `js/admin.js` - Módulo de administração (gestão de utilizadores)

### Ficheiros modificados:
- `index.html` - Adicionado botão admin e seção admin
- `js/app.js` - Verificação de role e funções de gestão do painel
- `js/api.js` - Revertido para usar apenas Cloud Function (sem Firestore)
- `css/style.css` - Estilos para o painel de administração

---

## 🔐 Considerações de Segurança

1. ✓ Firestore com rules de segurança restritivas (apenas utilizadores)
2. ✓ Autenticação via Firebase Auth obrigatória
3. ✓ Apenas admins podem gerir utilizadores
4. ✓ Auditoria com timestamps automáticos
5. ✓ Confirmação antes de operações destrutivas
6. ✓ Registos continuam seguros na Google Sheet (sem mudanças)

---

## 🧪 Testes Recomendados

1. **Teste de Login**
   - Login com conta normal
   - Verificar que botão "Admin" não aparece
   
2. **Teste de Admin**
   - Promover utilizador a admin (manualmente no Firebase Console)
   - Login com conta de admin
   - Verificar que botão "Admin" aparece

3. **Teste de Gravação de Dados**
   - Guardar alguns registos como utilizador normal
   - Verificar que aparecem na Google Sheet (não no Firestore)
   - Funcionamento idêntico ao anterior

---

## 🔄 Fluxo de Dados

```
Utilizador Normal
├─ Login → Firestore
├─ Preenche Formulário
└─ Guardar → Cloud Function → Google Sheet

Administrador
├─ Login → Firestore
├─ Painel Admin
│  ├─ Gestão Utilizadores → Firestore
│  ├─ Dados Inseridos → Google Sheet (futura integração)
│  └─ Estatísticas → Google Sheet (futura integração)
└─ Dados estão seguros
```

---

## 📞 Desenvolvimento Futuro

Para expandir o sistema no futuro:
- Endpoint na Cloud Function para ler dados da Google Sheet
- Gestão de permissões granulares
- Relatórios avançados com gráficos
- Histórico de alterações (audit log)

Consulte o código em `js/admin.js` para entender a estrutura.

