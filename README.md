# gusan / 듣기 로그

Gusan 마이크의 오디오 스트림과 함께 지연의 듣기 기록이 페이지 단위로 나타났다 사라지는 웹페이지.

## 파일 구조

```
/
├── index.html         HTML 구조 + CSS
├── sketch.js          p5.js 스케치 (CONFIG, 로그 파서, 애니메이션)
├── log.txt            듣기 로그 (이 파일만 수정하면 내용 업데이트됨)
├── seoul_gusan.mp3    오디오 파일 (직접 추가)
└── README.md
```

## GitHub Pages 배포

1. 새 저장소 생성 후 위 파일들을 푸시
2. Settings → Pages → Source를 `main` 브랜치로 설정
3. 몇 분 뒤 `https://<username>.github.io/<repo>/`에서 접근 가능

## 로그 추가/수정

`log.txt`의 기존 형식을 그대로 따르면 됨:

```
YYYY. M.D 요일

  HH:MM  첫 줄 관찰
         이어지는 관찰
         또 다른 관찰
  HH:MM  다음 시각 관찰
         이 줄에 06:16 같이 시각을 섞어 써도 됨
```

- 날짜 줄은 한 줄 단독으로 (파서가 `\d{4}.\s*\d{1,2}.\s*\d{1,2}\s*[요일]` 패턴으로 감지)
- `HH:MM` 패턴은 줄 어디에 있어도 시각 마커로 분리됨
- 빈 줄은 무시됨, 들여쓰기는 영향 없음
- 코드 수정 불필요 — 푸시하면 바로 반영

## 오디오 설정

### (A) 녹음 파일 사용 — 권장
`seoul_gusan.mp3`를 저장소에 올리면 끝. GitHub Pages는 HTTPS라 로컬 파일은 문제 없음.

### (B) Icecast 라이브 스트림 사용
`index.html`의 `AUDIO_URL`을 `http://locus.creacast.com:9001/gusan.mp3`로 변경하려 하면 **mixed content 에러로 브라우저가 차단**함. 세 가지 대안:

1. **Icecast 서버에 HTTPS 세팅** — `locus.creacast.com`에 admin 권한이 있다면 Let's Encrypt + 리버스 프록시(nginx 등)로 HTTPS 포트를 열어 `https://...:9443/gusan.mp3` 같은 URL 사용
2. **Cloudflare Workers 프록시** — HTTP 스트림을 HTTPS로 감싸 중계 (무료 tier로 충분). Workers 스크립트 몇 줄이면 됨
3. **GitHub Pages 대신 HTTP 서버에 배포** — Netlify, Vercel, 또는 자체 서버. 자체 호스팅이면 로컬 HTTP도 허용되지만 Pages는 강제 HTTPS

## 타이밍 조정

`sketch.js` 상단 CONFIG 블록:

```js
const TARGET_CHARS = 280;   // 페이지당 목표 글자수
const FADE_MS      = 1400;  // 페이드 시간
const GAP_MS       = 700;   // markers ↔ observations 레이어 간 간격
const HOLD_MS      = 12000; // 완전히 표시된 채 머무는 시간
```

- 페이지가 너무 짧거나 너무 길면 `TARGET_CHARS` 조정 (240~320 범위 권장)
- 더 천천히 음미하게 하려면 `HOLD_MS`를 18000~25000으로
- 현재 설정 기준 한 페이지 사이클은 약 19초 (페이드 인·아웃 포함)
- 페이지네이션은 **블록 단위** (시각 마커 + 그 관찰들)로 끊어서 시각과 관찰이 페이지 경계에서 분리되지 않음

## 애니메이션 구조

p5.js canvas 기반. 각 페이지는 두 레이어로 나뉨:
- **markers** — 날짜와 시각 (type `t`)
- **observations** — 관찰 텍스트 (type `o`)

전환 순서:
```
markers 페이드인 → observations 페이드인 → HOLD
  → observations 페이드아웃 → markers 페이드아웃
  → 이전 페이지가 ghost로 남아 점점 희미하게 겹침
[다음 페이지로]
```

`millis()` 기반 state machine으로 alpha를 직접 계산 (`sketch.js` `p.draw()` 참고).
# sound-text
