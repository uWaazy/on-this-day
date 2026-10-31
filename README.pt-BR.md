<div align="center">

<img src="./assets/logo.png" alt="On This Day" width="260">

# On This Day

### Descubra os álbuns lançados neste dia na história da música — direto no Spotify.

[![English](https://img.shields.io/badge/language-English-555555?style=for-the-badge)](README.md)
[![Português](https://img.shields.io/badge/idioma-Portugu%C3%AAs-1DB954?style=for-the-badge)](README.pt-BR.md)
[![Español](https://img.shields.io/badge/idioma-Espa%C3%B1ol-555555?style=for-the-badge)](README.es.md)

[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FuWaazy%2Fon-this-day%2Fmain%2Fmanifest.json&query=%24.version&label=vers%C3%A3o&color=1DB954&style=flat-square)](https://github.com/uWaazy/on-this-day)
[![Spicetify](https://img.shields.io/badge/Spicetify-custom%20app-1DB954?style=flat-square)](https://spicetify.app/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Recursos](#recursos) · [Instalação](#instalação) · [Atualização](#atualização) · [Como usar](#como-usar) · [Problemas comuns](#problemas-comuns)

</div>

---

## Recursos

- **Álbuns do dia** — todos os álbuns lançados na data de hoje em anos anteriores, agrupados por aniversário ("12 anos atrás · 2014"), dos mais populares aos menos. Um botão inverte a ordem dos anos.
- **Notas reais** — a nota dos usuários vem das avaliações do MusicBrainz (0–100, com a quantidade de votos). Álbum sem votos mostra *indisponível*, nunca um número inventado.
- **Filtros de gênero** — combine até cinco gêneros, com contadores em tempo real. Sua escolha fica salva.
- **Só artistas que eu sigo** — um botão flutuante à direita ativa a visão só com os artistas que você segue no Spotify (sem login). Na primeira abertura o app já começa assim; ele lembra sua última escolha.
- **Fundos dinâmicos** — fotos dos artistas dos álbuns na tela, alternando com as capas a cada 8 segundos (até 6 artistas ao mesmo tempo). Acompanham seus filtros e o dia.
- **Abrir o álbum no Spotify** — um clique na capa amplia; **duplo clique** (ou o botão **Spotify**) abre exatamente aquele álbum dentro do Spotify. Se o app não tiver certeza de qual é, abre a pesquisa do Spotify já na aba *Álbuns*.
- **Barra de anos** — aparece ao encostar o mouse na lateral esquerda, destaca o ano que você está lendo e leva a qualquer ano.
- **Aviso de atualização** — o número da versão no canto superior direito fica verde quando há versão nova, com as instruções para copiar e colar.
- Interface em **Português, English e Español**.

## Aba Artistas e dia anterior

A aba **Artistas** lista quem nasceu no dia exibido (foto, nome, data de nascimento, idade, país e gêneros); clicar na foto abre o artista no Spotify. O botão **Dia anterior** (abaixo do seletor de idioma) volta um dia por clique. Os aniversários vêm do dump de artistas do MusicBrainz e são publicados junto com o catálogo em `catalog/birthdays/MM-DD.json`. Gere localmente com `npm run catalog:birthdays`; o workflow mensal "Publish daily catalog" faz isso automaticamente.

## Instalação

> Precisa do aplicativo desktop do Spotify e do [Spicetify](https://spicetify.app/docs/getting-started) já instalados.

### Recomendado: um comando (RAW)

Abra o **PowerShell** e execute:

```powershell
irm https://raw.githubusercontent.com/uWaazy/on-this-day/main/install.ps1 | iex
```

Ele baixa o app deste repositório, confere os arquivos, ativa o `on-this-day` e roda o `spicetify apply`. Só isso.

### Método manual (se o RAW não funcionar)

1. Baixe `manifest.json`, `index.js` e `style.css` deste repositório (abra cada arquivo → **Raw** → *Salvar como…*, ou **Code → Download ZIP**).
2. Crie a pasta e coloque os três arquivos dentro dela:
   - Windows: `%appdata%\spicetify\CustomApps\on-this-day`
   - macOS / Linux: `~/.config/spicetify/CustomApps/on-this-day`
3. Ative e aplique:

   ```bash
   spicetify config custom_apps on-this-day
   spicetify apply
   ```

   Primeira vez com Spicetify? Rode `spicetify backup apply` uma vez.

## Atualização

- Quando sai uma versão nova, o **número da versão no canto superior direito do app fica verde**. Clique nele para ver as instruções.
- Para atualizar, rode de novo o mesmo comando RAW (ele substitui os arquivos antigos) ou repita o método manual.
- Para desinstalar: `spicetify config custom_apps on-this-day-` e depois `spicetify apply`.

## Como usar

| Ação | O que acontece |
|---|---|
| **Clique na capa** | Amplia a arte do álbum (Esc ou clique fora fecha). |
| **Duplo clique na capa** / botão **Spotify** | Abre o álbum no Spotify. Se não der para identificar com segurança, abre a pesquisa do Spotify em *Álbuns*. |
| **Filtrar por gênero** | Escolha até 5 gêneros; os contadores atualizam na hora. |
| **Botão flutuante de pessoa** (borda direita) | Liga/desliga *só artistas que eu sigo*. |
| **↓ Mais recentes primeiro / ↑ Mais antigos primeiro** | Inverte a ordem das seções de ano. |
| **Mouse na borda esquerda** | Mostra a barra de anos. |
| **Botão PT / EN / ES** | Troca o idioma. |
| **Número da versão** (canto superior direito) | Mostra se há atualização e como instalar. |

## Problemas comuns

- **O app não aparece no Spotify:** confira se a pasta `CustomApps/on-this-day` tem `manifest.json`, `index.js` e `style.css`, rode `spicetify config custom_apps on-this-day` e `spicetify apply` e reinicie o Spotify.
- **Sem o ícone do app na barra superior:** o `manifest.json` instalado precisa ser o deste repositório (ele tem os campos `icon`). Reinstale com o comando RAW.
- **"Só artistas que eu sigo" mostra erro:** clique no botão para tentar de novo; se persistir, desligue — todos os álbuns continuam aparecendo.
- **Algumas capas não carregam:** o app tenta Cover Art Archive, depois Spotify e depois iTunes; poucos lançamentos obscuros não têm capa em lugar nenhum.
- **O PowerShell bloqueia o script:** use o método manual, ou rode `Set-ExecutionPolicy -Scope Process Bypass` e tente de novo.

## Dados e privacidade

Os dados dos álbuns vêm do [MusicBrainz](https://musicbrainz.org/) (publicados em arquivos diários no GitHub Pages deste repositório); as capas, do Cover Art Archive, Spotify e iTunes; as fotos de artistas, do Spotify (e da Wikipedia quando preciso). O app fala com o Spotify apenas pela sua própria sessão já aberta (nenhuma senha, token ou login é pedido ou guardado) e consulta este repositório para saber de novas versões. Não há rastreamento nem analytics. O código que você executa é o `index.js` legível, sem minificação, deste repositório.

## Licença

Distribuído sob a **Licença MIT** — veja [LICENSE](LICENSE).