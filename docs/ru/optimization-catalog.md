# Каталог оптимизаций — общий индекс

Зонтичный справочник по всем рычагам снижения стоимости агента в этом воркшопе. Делит их на
три слоя и ссылается на детальные каталоги.

> **Связанные документы:** [charter.md](./charter.md) — архитектура воркшопа;
> [hygiene-methods.md](./hygiene-methods.md) — рычаги гигиены (L0–L10);
> [mcp-proxy-methods.md](./mcp-proxy-methods.md) — методы прокси (8 трансформаций).

---

## Три слоя

| Слой | Что настраивается | Где | Каталог | Эффект |
|---|---|---|---|---|
| **Гигиена (L0–L6)** | Model, Context Scoping, Output Discipline, File Hints, Cache, Up-front Prompt, минимальный CLAUDE.md | `.claude/settings.json`, `AGENTS.md`, `CLAUDE.md` | [hygiene-methods.md](./hygiene-methods.md) | ↓ ~75% токенов, ↓ ~93% стоимости |
| **Advanced (L7–L10)** | Subagents, Skills, Lazy Tool Loading, Hooks | `.claude/agents/`, `.claude/skills/`, `.claude/hooks/`, `.mcp*.json` | [hygiene-methods.md](./hygiene-methods.md) | ещё ↓ 40–85% на специфичных участках |
| **Tool layer (прокси)** | 8 трансформаций ответов инструментов | отдельный proxy-сервис **или** `PostToolUse`-хуки | [mcp-proxy-methods.md](./mcp-proxy-methods.md) | ↓ 40–99% на tool-ответах |

---

## Как это ложится на 3 прогона

- **Run 1 — раздутый baseline.** Ничего не оптимизировано: наивный промпт + раздутые MCP-ответы
  (jira/confluence/sentry/testrail) попадают в контекст каждый ход. Дорогой якорь.
- **Run 2 — гигиена.** Участник применяет L0–L6 (минимум L0 model + L1 scoping) к `AGENTS.md` /
  `.claude/settings.json`. Модест-выигрыш. **Потолок:** гигиена не сжимает раздутые MCP-ответы.
- **Run 3 — tool layer.** Прокси (Option A) или хуки (Option B) применяют методы из
  [mcp-proxy-methods.md](./mcp-proxy-methods.md) к ответам MCP до попадания в контекст. Самая
  большая дельта.

---

## Потолок и почему Run 3 — главный выигрыш

Рычаги L0–L10 находятся снаружи (или лишь частично внутри) цикла агента. Они сокращают промпт,
число чтений и ходов, но **раздутые ответы MCP-инструментов** остаются — и переотправляются каждый
ход. Их эффективно чинит только слой инструментов (прокси/хуки). Поэтому после Run 2 переходим к
Run 3: гигиена даёт ↓ 75–90% токенов, оставшиеся потери — это tool-ответы.
