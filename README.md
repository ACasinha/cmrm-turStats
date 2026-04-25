# Registo Diário de Nacionalidades — PWA
**Município de Reguengos de Monsaraz**

---

## Estrutura de Ficheiros

```
pwa-nacionalidades/
│
├── index.html          ← Shell HTML da aplicação
├── manifest.json       ← Manifesto da PWA (ícones, cores, nome)
├── sw.js               ← Service Worker (cache, offline, updates)
│
├── css/
│   └── style.css       ← Todos os estilos da aplicação
│
├── js/
│   ├── data.js         ← Dados estáticos (lista de países, constantes)
│   ├── ui.js           ← Construção do DOM e atualizações visuais
│   ├── api.js          ← Comunicação com o Google Apps Script
│   ├── app.js          ← Lógica principal (login, guardar, verificar)
│   └── pwa.js          ← Registo do SW e banner de instalação
│
└── icons/
    ├── icon-192.png    ← Ícone PWA 192×192 px
    └── icon-512.png    ← Ícone PWA 512×512 px
```

---

## Responsabilidade de cada ficheiro JS

| Ficheiro | Responsabilidade |
|----------|-----------------|
| `data.js` | Lista de países e constantes (`NUM_LINHAS_OP`, `NUM_LINHAS_SUG`) |
| `ui.js` | Construção de tabelas, totais, toasts, banners, limpeza, carregamento de dados |
| `api.js` | Três funções de interface com o Apps Script: `apiAutenticar`, `apiVerificarDados`, `apiGuardarRegisto`. Degrada em modo demo se o `google.script.run` não estiver disponível |
| `app.js` | Lógica de negócio: login/logout, sessão, inicialização, debounce de verificação, recolha e envio de dados |
| `pwa.js` | Registo do Service Worker, banner "Add to Home Screen", deteção de standalone |

---

## Integração com o Google Apps Script

O código do backend (Google Apps Script) **não se altera**.  
Apenas o frontend foi reorganizado em ficheiros separados.

### Como publicar

#### Opção A — Copiar HTML para o Apps Script
Se quiser continuar a servir o frontend via `doGet()` no Apps Script:

1. Abra o editor do Apps Script
2. Crie um ficheiro HTML chamado `Index` e cole o conteúdo de `index.html`
3. Crie ficheiros HTML para cada recurso (ou use `HtmlService.createTemplateFromFile`)
4. Adapte o `doGet()` para servir o ficheiro `Index`

> **Nota:** O Apps Script não suporta nativamente ficheiros CSS/JS separados.  
> Nesse caso, utilize `<?!= include('css/style') ?>` com ficheiros `.html` para cada recurso,  
> ou volte a inlinar os ficheiros (o código modular facilita a manutenção).

#### Opção B — Hospedar externamente (recomendado para PWA completa)
Para tirar partido total das funcionalidades PWA (Service Worker, manifest, ícones):

1. Faça upload dos ficheiros para **GitHub Pages**, **Netlify**, **Firebase Hosting** ou similar
2. Certifique-se de que o domínio é servido via **HTTPS** (obrigatório para Service Workers)
3. O `sw.js` e o `manifest.json` devem estar na **raiz do domínio**

---

## Ícones

Gere os ícones PWA a partir do logótipo do município:

- `icons/icon-192.png` → 192 × 192 px (fundo #8B4A2B, logótipo centrado)
- `icons/icon-512.png` → 512 × 512 px (mesmas especificações)

Pode usar [https://maskable.app/editor](https://maskable.app/editor) para gerar ícones maskable.

---

## Funcionalidades PWA

| Funcionalidade | Estado |
|---------------|--------|
| Installable (Add to Home Screen) | ✅ |
| Offline shell | ✅ (via Service Worker) |
| Cache de assets estáticos | ✅ |
| Chamadas ao Apps Script em offline | ❌ (requer rede — comportamento esperado) |
| Tema de cor (status bar) | ✅ |
| Ícones iOS / Android | ✅ (após adicionar os PNGs) |

---

## Notas de Desenvolvimento

- O ficheiro `api.js` deteta automaticamente se `google.script.run` está disponível.  
  Se não estiver (desenvolvimento local, pré-visualização), entra em **modo demo** sem erros.
- A sessão do utilizador é guardada em `sessionStorage` e reposta automaticamente ao recarregar.
- O Service Worker usa uma estratégia **network-first** para o HTML e **cache-first** para assets estáticos e fontes.
