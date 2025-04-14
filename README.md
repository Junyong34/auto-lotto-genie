# Auto-Lotto-Genie (자동 로또 구매 프로그램)

로또 번호를 AI로 추천받고 동행복권 사이트에서 자동으로 구매하는 프로그램입니다.

## 🎯 주요 기능

- AI(Google Gemini, OpenAI)를 활용한 로또 번호 추천
- 동행복권 사이트 자동 로그인 및 구매
- 구매 결과 Slack 알림
- 과거 당첨 번호 데이터 분석 및 활용

## 🚀 시작하기

### 필수 요구사항

- Node.js 20.x 이상
- PNPM 패키지 관리자
- 동행복권 계정
- Google Gemini API 키 또는 OpenAI API 키
- (선택 사항) Slack Webhook URL

### 설치 방법

1. 저장소 클론

```bash
git clone https://github.com/your-username/auto-lotto-genie.git
cd auto-lotto-genie
```

2. 의존성 설치

```bash
pnpm install
```

3. 환경 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 정보를 입력하세요:

```bash
cp .env.example .env
```

`.env` 파일을 열고 다음 정보를 입력하세요:

```
# 동행복권 계정 정보
LOTTO_USER_ID=your_id
LOTTO_USER_PW=your_password
LOTTO_COUNT=3 # 구매할 로또 개수

# AI API 키
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# Slack 알림 설정 (선택 사항)
SLACK_API_URL=your_slack_webhook_url

# 크롬 브라우저 경로 (필요시 설정)
# CHROME_PATH=/path/to/chrome
```

## 💡 사용 방법

다음 명령어로 로또를 자동으로 구매할 수 있습니다:

```bash
# 일반 모드
pnpm run lotto

# 헤드리스 모드 (브라우저 화면 표시 없음)
pnpm run lotto:headless

# 디버그 모드 (상세 로그 출력)
pnpm run lotto:debug

# 헤드리스 + 디버그 모드
pnpm run lotto:headless-debug

# 로또 데이터 분석만 실행
pnpm run lotto:data

# AI 추천 테스트
pnpm run lotto:ai
```

## 📁 프로젝트 구조

```
auto-lotto-genie/
├── src/
│   ├── index.ts             # 프로그램 진입점
│   ├── utils.ts             # 유틸리티 함수
│   ├── ai/                  # AI 관련 로직 디렉토리
│   ├── config/              # 설정 파일 디렉토리
│   ├── controllers/         # 컨트롤러
│   ├── data/                # 데이터 처리 관련 로직
│   ├── prompts/             # AI 프롬프트 정의
│   ├── puppeteer/           # 웹 자동화 관련 로직
│   ├── screens-images/      # 스크린샷 저장 디렉토리
│   ├── tests/               # 테스트 코드
│   ├── types/               # 타입 정의
│   └── utils/               # 유틸리티 함수 모듈
├── .env.example             # 환경 변수 예제 파일
├── .env                     # 환경 변수 파일 (개인 설정)
├── package.json             # 프로젝트 설정 및 의존성
├── docker-compose.yml       # Docker 구성 파일
├── Dockerfile               # Docker 이미지 정의
└── tsconfig.json            # TypeScript 설정
```

## 🔧 기술 스택

- TypeScript
- Puppeteer (웹 자동화)
- Google Generative AI (Gemini)
- OpenAI API
- Axios (HTTP 요청)
- Dayjs (날짜 처리)
- Express (웹 서버)

## 🔒 보안 주의사항

- `.env` 파일에 저장된 개인 정보와 API 키는 절대 공개 저장소에 업로드하지 마세요.
- 본 프로그램은 개인적인 용도로만 사용하세요.
- 동행복권 사이트의 이용약관을 준수하는 범위 내에서 사용하세요.

## 📝 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

## 👥 기여하기

버그 리포트, 기능 요청 또는 PR은 언제나 환영합니다.
