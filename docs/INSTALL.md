# Install

## English

### Requirements
- Windows native shell: PowerShell plus Git Bash from Git for Windows.
- Node.js 20+.
- Claude Code CLI installed and authenticated.
- Codex CLI installed and authenticated.
- `ccusage` available through `ccusage` or `npx ccusage`.

### Install

```powershell
git clone https://github.com/pantagram1031/myorch.git
cd myorch
npm install
npm run build
npm run verify:all
```

Then open the folder in Claude Code and run:

```text
/goal add a simple function
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

### 설치

```powershell
git clone https://github.com/pantagram1031/myorch.git
cd myorch
npm install
npm run build
npm run verify:all
```

그 다음 Claude Code에서 폴더를 열고 실행합니다.

```text
/goal add a simple function
```

### 알림 설정

Windows toast 알림을 원하면:

```powershell
Install-Module BurntToast -Scope CurrentUser
```

BurntToast가 없으면 myorch는 알림 시도를 로그로 남기고 console/beep으로 폴백합니다.
