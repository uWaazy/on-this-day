<div align="center">

<img src="./assets/logo.png" alt="On This Day" width="260">

# On This Day

### Descubre los álbumes lanzados en este día de la historia de la música — dentro de Spotify.

[![English](https://img.shields.io/badge/language-English-555555?style=for-the-badge)](README.md)
[![Português](https://img.shields.io/badge/idioma-Portugu%C3%AAs-555555?style=for-the-badge)](README.pt-BR.md)
[![Español](https://img.shields.io/badge/idioma-Espa%C3%B1ol-1DB954?style=for-the-badge)](README.es.md)

[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FuWaazy%2Fon-this-day%2Fmain%2Fmanifest.json&query=%24.version&label=versi%C3%B3n&color=1DB954&style=flat-square)](https://github.com/uWaazy/on-this-day)
[![Spicetify](https://img.shields.io/badge/Spicetify-custom%20app-1DB954?style=flat-square)](https://spicetify.app/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Funciones](#funciones) · [Instalación](#instalación) · [Actualización](#actualización) · [Cómo usar](#cómo-usar) · [Problemas comunes](#problemas-comunes)

</div>

---

## Vista previa

<p align="center">
  <img src="./assets/preview.jpg" alt="On This Day preview" width="900">
</p>

## Funciones

- **Álbumes del día** — todos los álbumes lanzados en la fecha de hoy en años anteriores, agrupados por aniversario ("hace 12 años · 2014"), de más a menos populares. Un botón invierte el orden de los años.
- **Notas reales** — la nota de los usuarios viene de las valoraciones de MusicBrainz (0–100, con la cantidad de votos). Un álbum sin votos muestra *no disponible*, nunca un número inventado.
- **Filtros de género** — combina hasta cinco géneros, con contadores en vivo. Tu elección queda guardada.
- **Solo artistas que sigo** — un botón flotante a la derecha activa la vista con solo los artistas que sigues en Spotify (sin iniciar sesión). En la primera apertura la app ya empieza así y recuerda tu última elección.
- **Fondos dinámicos** — fotos de los artistas de los álbumes en pantalla, alternando con las portadas cada 8 segundos (hasta 6 artistas a la vez). Siguen tus filtros y el día.
- **Abrir el álbum en Spotify** — un clic en la portada la amplía; **doble clic** (o el botón **Spotify**) abre exactamente ese álbum dentro de Spotify. Si la app no está segura de cuál es, abre la búsqueda de Spotify en la pestaña *Álbumes*.
- **Barra de años** — aparece al acercar el ratón al borde izquierdo, resalta el año que estás leyendo y salta a cualquier año.
- **Aviso de actualización** — el número de versión arriba a la derecha se pone verde cuando hay una versión nueva, con instrucciones para copiar y pegar.
- Interfaz en **Español, English y Português**.

## Instalación

> Necesitas la aplicación de escritorio de Spotify y [Spicetify](https://spicetify.app/docs/getting-started) ya instalados.

### Recomendado: un comando (RAW)

Abre **PowerShell** y ejecuta:

```powershell
irm https://raw.githubusercontent.com/uWaazy/on-this-day/main/install.ps1 | iex
```

Descarga la app de este repositorio, comprueba los archivos, activa `on-this-day` y ejecuta `spicetify apply`. Nada más.

### Método manual (si RAW no funciona)

1. Descarga `manifest.json`, `index.js` y `style.css` de este repositorio (abre cada archivo → **Raw** → *Guardar como…*, o **Code → Download ZIP**).
2. Crea la carpeta y coloca los tres archivos dentro:
   - Windows: `%appdata%\spicetify\CustomApps\on-this-day`
   - macOS / Linux: `~/.config/spicetify/CustomApps/on-this-day`
3. Actívala y aplica:

   ```bash
   spicetify config custom_apps on-this-day
   spicetify apply
   ```

   ¿Primera vez con Spicetify? Ejecuta `spicetify backup apply` una vez.

## Actualización

- Cuando sale una versión nueva, el **número de versión arriba a la derecha de la app se pone verde**. Haz clic para ver las instrucciones.
- Para actualizar, ejecuta otra vez el mismo comando RAW (reemplaza los archivos antiguos) o repite el método manual.
- Para desinstalar: `spicetify config custom_apps on-this-day-` y luego `spicetify apply`.

## Cómo usar

| Acción | Qué ocurre |
|---|---|
| **Clic en la portada** | Amplía la portada (Esc o clic fuera la cierra). |
| **Doble clic en la portada** / botón **Spotify** | Abre el álbum en Spotify. Si no se puede identificar con seguridad, abre la búsqueda de Spotify en *Álbumes*. |
| **Filtrar por género** | Elige hasta 5 géneros; los contadores se actualizan al instante. |
| **Botón flotante de persona** (borde derecho) | Activa/desactiva *solo artistas que sigo*. |
| **↓ Más recientes primero / ↑ Más antiguos primero** | Invierte el orden de las secciones por año. |
| **Ratón en el borde izquierdo** | Muestra la barra de años. |
| **Botón PT / EN / ES** | Cambia el idioma. |
| **Número de versión** (arriba a la derecha) | Muestra si hay actualización y cómo instalarla. |

## Problemas comunes

- **La app no aparece en Spotify:** comprueba que la carpeta `CustomApps/on-this-day` tenga `manifest.json`, `index.js` y `style.css`, ejecuta `spicetify config custom_apps on-this-day` y `spicetify apply`, y reinicia Spotify.
- **Falta el icono de la app en la barra superior:** el `manifest.json` instalado debe ser el de este repositorio (tiene los campos `icon`). Reinstala con el comando RAW.
- **"Solo artistas que sigo" muestra un error:** haz clic en el botón para reintentar; si persiste, desactívalo — todos los álbumes siguen apareciendo.
- **Algunas portadas no cargan:** la app prueba Cover Art Archive, luego Spotify y luego iTunes; unos pocos lanzamientos oscuros no tienen portada en ningún sitio.
- **PowerShell bloquea el script:** usa el método manual, o ejecuta `Set-ExecutionPolicy -Scope Process Bypass` e inténtalo de nuevo.

## Datos y privacidad

Los datos de los álbumes vienen de [MusicBrainz](https://musicbrainz.org/) (publicados como archivos diarios en el GitHub Pages de este repositorio); las portadas, de Cover Art Archive, Spotify e iTunes; las fotos de artistas, de Spotify (y de Wikipedia cuando hace falta). La app habla con Spotify solo a través de tu propia sesión ya iniciada (no se piden ni guardan contraseñas, tokens ni inicios de sesión) y consulta este repositorio para saber si hay versiones nuevas. No hay rastreo ni analíticas. El código que ejecutas es el `index.js` legible, sin minificar, de este repositorio.

<a href="https://ko-fi.com/uwaazy" target="_blank">
  <img src="https://img.shields.io/badge/Support%20my%20Work-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white" alt="Ko-fi Donate">
</a>

## Licencia

Publicado bajo la **Licencia MIT** — consulta [LICENSE](LICENSE).

## Pestaña Artistas y día anterior

La pestaña **Artistas** lista a quienes nacieron el día mostrado (foto, nombre, fecha de nacimiento, edad, país y géneros); al hacer clic en la foto se abre el artista en Spotify. El botón **Día anterior** (debajo del selector de idioma) retrocede un día por clic. Los cumpleaños provienen del volcado de artistas de MusicBrainz y se publican con el catálogo en `catalog/birthdays/MM-DD.json`. Genéralos localmente con `npm run catalog:birthdays`; el workflow mensual "Publish daily catalog" lo hace automáticamente.
