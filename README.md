# Stremio Web para TVs LG (webOS) anteriores a 2020

App webOS simples (um *wrapper*) que abre o **web.stremio.com** na TV, com ecrã de
arranque, deteção de compatibilidade e definições controláveis pelo comando.

## Aviso importante: compatibilidade

O Stremio Web atual (v5) usa **WebAssembly**, que só existe a partir do Chromium 57.
O motor web das TVs LG é:

| Ano da TV | webOS | Motor web | Stremio Web v5 |
|-----------|-------|-----------|----------------|
| 2014–2015 | 1.x / 2.x | WebKit / Chromium 34 | ❌ |
| 2016–2017 | 3.x | Chromium 38 | ❌ |
| 2018–2019 | 4.x | Chromium 53 | ❌ (provável ecrã preto) |
| 2020+     | 5.x+ | Chromium 68+ | ✅ |

Por isso a app:
- mostra no arranque a versão do Chromium e se há WebAssembly;
- avisa quando a TV não é compatível, em vez de abrir uma página em branco;
- permite escolher a **interface legada v4** (`https://app.strem.io/shell-v4.4/`)
  ou um **endereço personalizado** (por exemplo uma instância própria do
  [stremio-web](https://github.com/Stremio/stremio-web) compilada para browsers antigos).

> O endereço da interface v4 é antigo e pode já não estar disponível. Confirme-o
> num PC antes de o usar.

## Utilização na TV

- **Arranque:** abre o endereço escolhido após 3 s (configurável).
- **OK / botão verde:** abrir já.
- **▲ / botão vermelho:** definições.
- **Back:** no arranque sai da app; dentro do Stremio volta à página anterior.
- O ponteiro do **Magic Remote** funciona em todo o lado.

Para voltar ao ecrã de arranque depois de o Stremio abrir, feche a app por completo
(mantenha o Back premido ou feche-a na lista de apps) e abra-a de novo.

**Torrents:** o Stremio Web precisa de um *streaming server*. A TV não tem um, por isso
os torrents só funcionam se apontar o Stremio (Definições → Streaming server) para o
servidor Stremio a correr num PC/NAS da rede local. Links HTTP (por exemplo debrid)
não precisam do servidor.

## Compilar o IPK

Precisa de Node.js 18+.

```bash
npm install
```

```bash
npm run package
```

O ficheiro fica em `dist/io.github.geneiros.stremiowrapper_1.0.0_all.ipk`.
Cada push para o GitHub também gera o IPK automaticamente (separador **Actions** →
artefacto `stremio-wrapper-ipk`).

## Instalar na TV

### Opção A — Developer Mode (oficial)
1. Crie uma conta em <https://webostv.developer.lge.com>.
2. Na TV, instale a app **Developer Mode** da LG Content Store, inicie sessão,
   ative *Dev Mode Status* e *Key Server*, e reinicie a TV.
3. No PC (mesma rede):

```bash
npx ares-setup-device --add tv --info "{'host':'IP_DA_TV','port':'9922','username':'prisoner'}"
```

```bash
npx ares-novacom --device tv --getkey
```

(use a *passphrase* mostrada na app Developer Mode)

```bash
npm run install-tv
```

A sessão de Developer Mode expira ao fim de ~50 h; renove-a na app (botão *Extend*)
ou a app instalada deixa de abrir.

### Opção B — Homebrew Channel (TV com root)
Se a TV tiver root (ex. [RootMyTV](https://rootmy.tv)), instale o IPK com o
[webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop) ou pelo Homebrew
Channel. Não há limite de 50 h.

## Depurar

```bash
npm run inspect
```

Abre as DevTools remotas da app (só em Developer Mode).

## Estrutura

```
app/
  appinfo.json   metadados webOS
  index.html     ecrã de arranque + definições
  css/style.css  estilos (compatíveis com motores antigos)
  js/main.js     lógica em ES5 puro
  img/           ícones
```
