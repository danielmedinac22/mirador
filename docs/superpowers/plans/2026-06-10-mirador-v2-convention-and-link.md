# Mirador V2 — una convención + un link

**Fecha:** 2026-06-10 · **Estado:** aprobado (grill con Daniel) · **Veredicto del test:** antes del 2026-06-19

## Por qué se re-funda

El test de dogfood de V1 falló: Daniel —el autor— necesitó colaborar sobre un PRD real con el PO
y eligió GitHub pelado + Claude en vez de mirador. El diagnóstico es estructural, no de pulido:

- **El valor central que vendía V1 ("dos cerebros → dos briefs distintos") lo produce el agente,
  no mirador.** Claude ya lee la memoria del usuario y ya enmarca un diff por su contexto.
  Mirador no habilita esa capacidad: la empaqueta.
- Lo que mirador agrega de verdad son **convenciones** — intent notes, estado por sección,
  visión del owner — y esas convenciones no justifican el costo de activación de V1:
  CLI global + `init` + workspace + shim install + repo-por-artefacto.
- El momento que más duele —el **primer contacto** del colaborador con el doc— V1 lo resolvía
  con "instala un CLI". El principio "no hosted frontend" no sobrevivió el contacto con la realidad.
- Evidencia: `mirador-cli@1.0.0` en npm es la versión publish-era (la convergence nunca se
  publicó), ~0 descargas orgánicas, 3 repos huérfanos "Shared via mirador", demo §17 nunca corrida.

**V2 reduce el producto a dos piezas: una convención que vive dentro del repo compartido
(cero install) y un link hospedado que hace el primer contacto (el view).**

## Decisiones (grill 2026-06-10)

| Decisión | Resolución |
|---|---|
| Artefacto del test | `versiones-2026/version-2.9/close-management-cli/` en `epic/v2.9` de `simetrik-inc/accounting-operation-docs` (definición funcional + RFC BE). Colaborador: el PO, con Claude Code |
| Convención | Por-artefacto: `.mirador/` **dentro de la carpeta del doc** (vision.md, state.yml, intents/, config.json). Skill global del repo en `.claude/skills/mirador/`. Entra por PR. Muere el modelo repo-por-artefacto de V1 |
| Viewer | **Modelo push** — cero credenciales de GitHub en el server (PAT corporativo bloqueado). Multi-tenant desde v0: registrar artefacto → slug no-adivinable + write token; el token vive en `.mirador/config.json` del repo privado → *poder actualizar la vista = tener acceso al repo*. URL unlisted, sin login en v0 |
| Hosting | Railway, proyecto `mirador-viewer`, dominio default, un proceso Node + volumen. Sin Postgres/Redis |
| CLI | `mirador-cli@2.0.0`: comandos `view init` / `view push` que operan sobre el repo actual vía `npx` — sin install global, sin workspace `~/.mirador`, sin `init`, sin shim install. Reutiliza el document seam (`parse`/`render`/`renderShell`) y los temas |
| Naming | Se mantiene **mirador**. Rebranding solo si el test pasa |

## Arquitectura

### La convención (in-repo, cero install)

```
<repo>/
  .claude/skills/mirador/SKILL.md     ← el protocolo; Claude Code lo descubre solo
  <ruta>/<artefacto>/                  ← la carpeta del doc ES el artefacto
    definicion-funcional.md            ← markdown(++) con anchors estables
    rfc-be.md
    .mirador/
      vision.md                        ← la visión del owner (una pantalla máx)
      state.yml                        ← secciones: open | contested | locked (+ owner)
      intents/<fecha>-<autor>-<slug>.md← el porqué de cada cambio (frontmatter + prosa corta)
      config.json                      ← viewer URL + slug + writeToken (repo privado)
```

- El skill enseña dos protocolos: **brief** (leer `.mirador/` + `git diff` + la memoria propia
  del agente → brief de una pantalla) y **refine** (editar → actualizar state → escribir intent
  → commit → `npx -y mirador-cli view push` → `git push`).
- **Invariante de privacidad intacto:** la memoria del agente jamás se copia a archivos del
  repo ni a intents. Solo sus efectos.
- Intents keyed por fecha+autor (no por sha): se escriben en el mismo commit del cambio,
  sin malabares post-commit.

### El link (viewer en Railway)

El viewer es **almacenamiento + serve, nada más**. Toda la inteligencia de producto queda en
el CLI (motor determinista) que renderiza la **página completa** localmente y la sube.

| Endpoint | Hace |
|---|---|
| `POST /api/artifacts` | Crea artefacto → `{slug, writeToken, url}` (slug 16 bytes, token 32 bytes) |
| `PUT /api/artifacts/:slug` | `Authorization: Bearer <writeToken>` · body = HTML completo · cap 5 MB |
| `GET /v/:slug` | Sirve la página verbatim |
| `GET /healthz` | Para Railway |

Storage: filesystem en `DATA_DIR` (volumen Railway), un par `<slug>.html` / `<slug>.json` (meta).

### La página que sirve el link (la arma `view push`)

Header con título + visión + última actualización → badges de estado por sección →
timeline de intents (el porqué, por autor) → el doc renderizado con tema de V1 →
bloque **"ábrelo con tu agente"**: el seed copy-paste (`@mirador-view`) que le dice al agente
del lector cómo clonar el repo, leer el skill y entrar al loop. El link onboardea solo —
ese es el test.

## Slices

| Slice | Qué | Acceptance |
|---|---|---|
| VL-01 | `viewer/` package (Node 20 ESM + TS, mismo stack que v1) | Suite HTTP: register → push → get; auth rechazada; cap de tamaño; healthz |
| VL-02 | `mirador view init` / `view push` en v1/ → `mirador-cli@2.0.0` | init scaffoldea `.mirador/` desde headings y registra; push renderiza carpeta multi-doc + chrome y hace PUT; corre vía `npx` sin workspace |
| VL-03 | Skill in-repo (template instalable, `v1/convention/`) | Protocolo brief/refine completo; privacidad del brain explícita; `view init` lo copia al repo destino |
| VL-04 | Deploy Railway + npm publish 2.0.0 | `! railway login` y `! npm login` de Daniel; healthz verde; `npx -y mirador-cli@2 --version` |
| VL-05 | PR a `accounting-operation-docs` (epic/v2.9) + link al PO | Convención + view del artefacto real; visión drafteada del PRD §1 (Daniel aprueba en PR); línea de Slack lista |

## El test binario (kill criteria)

1. PR mergeado; link en frío al PO por Slack — **una línea, sin explicación**. Si hay que
   explicarle el sistema por llamada, dato en contra.
2. El PO refina ≥1 sección vía su Claude y pushea con intent.
3. Daniel abre con su Claude y recibe el brief (qué cambió · por qué · estado · qué sigue).
4. Pregunta a ambos: *¿mejor que GitHub pelado + Claude?*

**Kill:** si en la siguiente iteración real del doc cualquiera de los dos vuelve al flujo
GitHub-pelado, se archiva con post-mortem y se rescatan document seam + brain privacy como
aprendizajes. **Fecha límite del veredicto: viernes 2026-06-19.**
