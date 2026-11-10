# Windows에서 BT 개발 이어가기

저장소는 코드·설정 양식·테스트를 공유합니다. 실제 키, 휴대폰 기록·사진, Supabase 데이터는 Git으로 복제되지 않습니다.
Windows 실기에서 전체 절차를 검증한 문서는 아니며, 첫 실행 시 Android 도구 경로와 기기 동작을 확인해야 합니다.

## 1. 준비

- Git, VS Code, Node.js 24 계열. 검증 기준 버전은 `bt/.nvmrc` 참고.
- Android 작업 시 Android Studio, Android SDK·Platform Tools, 생성된 Gradle 빌드에 맞는 JDK.
- SDK·Java 경로는 Windows PC의 실제 경로로 설정합니다. Mac의 경로나 node_modules를 복사하지 않습니다.
- 한글 경로로 인한 네이티브 빌드 문제를 피하려면 짧은 영문 경로를 사용합니다.

## 2. 최초 가져오기

PowerShell 예시입니다. GitHub 로그인은 Git Credential Manager 등으로 처리하고 URL에 토큰을 넣지 않습니다.

```powershell
git clone https://github.com/wjdrbs0433/beautiful-times.git C:\dev\beautiful-times
cd C:\dev\beautiful-times\bt
node --version
npm ci
Copy-Item .env.example .env.local
Copy-Item .env.route.example .env.route.local
```

복사 명령은 새 clone에서만 실행합니다. 기존 env 파일을 덮어쓰지 않습니다.
비밀번호 관리자 등으로 별도 관리하는 개발용 값을 각 PC에서 직접 입력합니다.

| 파일 | 설정 |
| --- | --- |
| `.env.local` | Supabase 공개 URL·Publishable 키, 카카오 JavaScript 키, 개발 서버 주소 |
| `.env.route.local` | 로컬 이동시간 서버용 카카오 REST API 키·JavaScript 키 |

Supabase 서버 secret/service_role·DB 비밀번호·카카오 Client Secret은 클라이언트 앱에 넣지 않습니다.
비밀을 `EXPO_PUBLIC_` 변수로 만들면 앱 번들에서 노출됩니다.

## 3. 실행 및 검사

```powershell
npm run lint
npm run typecheck
npm test
```

웹 개발:

```powershell
npm run web -- --port 8082
```

필요하면 다른 터미널에서 이동시간 개발 서버를 실행합니다.

```powershell
npm run routes
```

개발 서버는 인터넷에 공개하지 않습니다. 카카오 JavaScript SDK 도메인과 Supabase Redirect URL에는 실제 사용하는 localhost 주소·포트를 등록합니다.

Android USB 디버깅 허용 후:

```powershell
adb devices
npx expo run:android --device --no-bundler
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8090 tcp:8090
npm start
```

`npm run android`는 현재 Mac 전용 도우미이므로 Windows에서는 위 Expo 명령을 직접 사용합니다.
기기 여러 대가 연결됐다면 대상을 선택하고 `adb -s`로 기기를 지정합니다.
개발 컴퓨터마다 debug 서명이 달라 설치 충돌이 생길 수 있으므로, 앱을 삭제하기 전에 기록·사진 백업을 확인합니다.

Windows에서도 iOS 소스 편집은 가능하지만 iOS 로컬 빌드·시뮬레이터에는 Mac/Xcode가 필요합니다.
네이티브 모듈을 변경했으면 개발용 앱을 다시 빌드합니다.

## 4. 컴퓨터를 오갈 때

작업 시작 전 저장소 최상위에서 미커밋 변경을 확인하고 가져옵니다.

```sh
git status
git pull --ff-only
```

lock 파일이 바뀌었으면 `bt/`에서 `npm ci`를 다시 실행합니다.
작업 종료 시 변경 파일과 비밀 포함 여부를 검토하고 commit/push한 뒤 다른 PC에서 pull합니다.
같은 파일을 양쪽 PC에서 따로 수정했으면 충돌을 해결하며 합치고 강제 push로 덮어쓰지 않습니다.

## 5. DB와 사진

DB 구조·RLS 변경 SQL은 `bt/supabase/migrations/`에서 관리하지만 실제 서버 적용은 별도 작업입니다.
Git clone이나 pull은 SQL을 실행하지 않으며 사용자 계정·사진·DB 행을 복사하지 않습니다.
현재 migration 파일명 형식이 혼재하므로 자동 정렬을 가정하지 말고 파일 간 의존 순서와 기존 서버 적용 이력을 확인해야 합니다.

참고: [Expo 개발 빌드](https://docs.expo.dev/guides/local-app-development/), [Expo 환경변수](https://docs.expo.dev/guides/environment-variables/).
