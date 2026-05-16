# Install

## English

### Requirements
- Windows native shell: PowerShell plus Git Bash from Git for Windows.
- Node.js 20+.
- Claude Code CLI installed and authenticated.
- Codex CLI installed and authenticated.
- `ccusage` available through `ccusage` or `npx ccusage`.

### Install For Any Project

```powershell
npm install -g github:pantagram1031/myorch
cd your-project
myorch init
claude
```

Then type in Claude Code:

```text
/goal "add a simple function"
```

No separate build command is needed. The npm `prepare` script runs `npm run build` during git/global install.

### Local Development Install

```powershell
git clone https://github.com/pantagram1031/myorch.git
cd myorch
npm install
npm run verify:all
npm install -g .
```

### Optional Notification Setup

For native Windows toast notifications:

```powershell
Install-Module BurntToast -Scope CurrentUser
```

If BurntToast is not installed, myorch logs notification attempts and falls back to console/beep output.

## 한국어

### 요구 사항
- Windows native shell: PowerShell + Git for Windows의 Git Bash.
- Node.js 20 이상.
- Claude Code CLI 설치 및 로그인.
- Codex CLI 설치 및 로그인.
- `ccusage` 또는 `npx ccusage` 사용 가능.

### 아무 프로젝트에 적용하기

```powershell
npm install -g github:pantagram1031/myorch
cd your-project
myorch init
claude
```

Claude Code에서 다음을 입력하세요.

```text
/goal "add a simple function"
```

별도 build 명령은 필요 없습니다. npm `prepare` 스크립트가 git/global install 중 `npm run build`를 실행합니다.

### 로컬 개발 설치

```powershell
git clone https://github.com/pantagram1031/myorch.git
cd myorch
npm install
npm run verify:all
npm install -g .
```

### 알림 설정

Windows toast 알림을 원하면:

```powershell
Install-Module BurntToast -Scope CurrentUser
```

BurntToast가 없으면 myorch는 알림 시도를 로그에 남기고 console/beep으로 대체합니다.
