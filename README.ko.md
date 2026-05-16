# myorch

<!-- TODO: demo gif here -->

사용량 인식 멀티 AI 오케스트레이터입니다. 실시간 토큰 사용량을 보고 Claude Code와 Codex CLI 사이를 라우팅하고, 기계적 ratchet verifier가 PASS할 때만 진행합니다.

myorch는 Claude Code와 Codex CLI를 함께 쓰는 개발자를 위한 프로젝트 로컬 스캐폴드입니다. "완료된 것 같습니다" 같은 LLM 문장이 아니라 `plan.md`와 verifier 결과가 진행을 결정합니다. 계획/평가는 Claude 쪽으로, 구현/메타리뷰는 Codex 쪽으로 보내고, `ccusage`로 사용량 압력을 봅니다.

## 핵심 아이디어
- **Ratchet:** `plan.md` 체크박스는 verifier PASS로만 전진합니다.
- **Routing:** 작업 종류와 `ccusage`를 보고 Claude/Codex를 고릅니다. `/switch`로 수동 전환도 됩니다.
- **Metareview:** "looks good" 대신 verifier 증거를 인용한 리뷰만 받습니다.
- **Compact resilience:** compact hook이 ratchet 상태를 백업하고 handover reminder를 복구합니다.
- **Statusline:** 사용량과 현재 ratchet 진행이 매 turn 보입니다.

Statusline 예시:

```text
claude | $1.23 | 5h:50m | 6596 tok/min | 42% ctx | [5/7 done] Task 6
```

## 빠른 시작

```powershell
git clone https://github.com/pantagram1031/myorch.git
cd myorch
npm install
npm run build
npm run verify:all
```

전체 런타임 동작에는 아래 도구가 있으면 좋습니다.

```powershell
claude --version
codex --version
ccusage --json
```

Claude Code에서 이 폴더를 열고 실행하세요.

```text
/goal add a simple function
```

예상 동작: myorch가 `spec.md`와 `plan.md`를 만들거나 갱신하고, 라우팅을 수행하고, tool use 이후 verifier hook을 돌리며, PASS 뒤에만 진행 체크박스를 표시합니다.

## 문서
- [Install](docs/INSTALL.md)
- [Tutorial](docs/TUTORIAL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Limits](docs/LIMITS.md)
- [English README](README.md)

## 라이선스와 크레딧

MIT. Claude Code project commands/hooks, Codex CLI, `ccusage`, Superpowers 개발 워크플로를 바탕으로 만들었습니다. Anthropic, OpenAI, `ccusage` maintainers와는 독립적인 프로젝트입니다.

기여 방법은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.
