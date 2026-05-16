# Migration

## English

### From Project-Local v1.3.5 To Global v1.4.1

v1.4.1 changes the default application model:

```powershell
npm install -g github:pantagram1031/myorch
cd your-project
myorch init
```

`myorch init` installs project-local Claude Code files, but the commands and hooks call the global `myorch` CLI instead of `node dist/src/cli.js`.

### CLAUDE.md Import Pattern

myorch does not rewrite your existing `CLAUDE.md`. It appends this import line once if it is missing:

```text
@.claude/myorch.md
```

The file `.claude/myorch.md` is owned by myorch and may be refreshed on every `myorch init`. Do not put personal edits there unless you are comfortable losing them on the next init.

For project-specific customization, use one of these instead:

- normal sections in your existing `CLAUDE.md`;
- `.claude/myorch.local.md` for local myorch-adjacent notes.

myorch never writes `.claude/myorch.local.md`.

### Idempotency

Running `myorch init` multiple times is safe. Existing command, rule, hook, statusline, and settings files are preserved unless you pass `--force`. The myorch-owned `.claude/myorch.md` file is the exception and is refreshed each time.

## 한국어

### 프로젝트 로컬 v1.3.5에서 글로벌 v1.4.1로

v1.4.1부터 기본 적용 방식은 다음입니다.

```powershell
npm install -g github:pantagram1031/myorch
cd your-project
myorch init
```

`myorch init`은 프로젝트 안에 Claude Code 파일을 설치하지만, 슬래시 명령과 hook은 `node dist/src/cli.js` 대신 전역 `myorch` CLI를 호출합니다.

### CLAUDE.md import 패턴

myorch는 기존 `CLAUDE.md` 본문을 다시 쓰지 않습니다. 아래 import 줄이 없을 때 한 번만 끝에 추가합니다.

```text
@.claude/myorch.md
```

`.claude/myorch.md`는 myorch가 소유하는 파일이며 `myorch init` 때마다 갱신될 수 있습니다. 사용자가 직접 수정하면 다음 init에서 덮어써질 수 있습니다.

커스터마이즈가 필요하면 다음 영역을 사용하세요.

- 기존 `CLAUDE.md`의 일반 섹션;
- `.claude/myorch.local.md`에 적는 로컬 myorch 관련 메모.

myorch는 `.claude/myorch.local.md`를 절대 쓰지 않습니다.

### 멱등성

`myorch init`은 여러 번 실행해도 안전합니다. 기존 command, rule, hook, statusline, settings 파일은 `--force`가 없으면 보존됩니다. 단, myorch 소유 파일인 `.claude/myorch.md`는 매번 갱신됩니다.
