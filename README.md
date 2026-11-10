# BT · Beautiful Times

커플·가족의 일정, 사진, 글과 기념일을 기록하는 모바일 앱입니다.
Expo SDK 58, React Native, TypeScript를 사용하며 Android·iOS 및 웹을 대상으로 개발 중입니다.

## 현재 구현

- 일정과 방문 장소, 지도 및 장소 검색
- 사진·글·기념일과 홈 배경 관리
- 카카오 로그인과 Supabase를 이용한 같은 계정의 기록 동기화
- 오프라인 기기 보관 및 동기화 충돌 처리

서로 다른 계정 간 초대·공동 편집과 공개 서비스 운영 기능은 개발 중입니다.
현재 코드는 개발용이며, 실제 서비스 배포 전에는 서버 설정과 접근 권한, 개인정보 처리 및 실제 기기 동작을 별도로 검증해야 합니다.

## 개발 시작

앱 프로젝트는 `bt/`에 있습니다. Node 버전 기준은 `bt/.nvmrc`에 기록합니다.

```sh
cd bt
npm ci
```

각 컴퓨터에서 `.env.example`을 `.env.local`로, `.env.route.example`을 `.env.route.local`로 복사하고 자신의 개발 환경에 맞게 설정합니다.
실제 키 파일과 사용자 기록·사진은 저장소에 포함하지 않습니다.
`EXPO_PUBLIC_` 설정은 앱에서 읽을 수 있는 공개 설정이며 서버 비밀 키를 넣으면 안 됩니다.

- [Windows 개발 시작 안내](docs/Windows-개발-시작하기.md)
- [앱 개발 설명](bt/README.md)

## 검증

`bt/`에서 실행합니다.

```sh
npm run lint
npm run typecheck
npm test
npm run test:security
npm run security:secrets
npm audit
```

보안 테스트는 가짜 데이터와 로컬 격리 환경을 사용합니다. 운영 서버에 적용된 정책이나 실제 사용자 계정의 안전성을 대신 보증하지 않습니다.
