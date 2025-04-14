# 앱 실행을 위한 베이스 이미지
FROM node:20-alpine

# 앱 디렉토리 생성
WORKDIR /app

# Puppeteer에 필요한 Chrome 의존성 설치
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tzdata \
    curl

# Chrome 환경변수 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# pnpm 설치
RUN npm install -g pnpm

# 앱 의존성 설치
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# 앱 소스 추가
COPY . .

# start.sh 스크립트에 실행 권한 부여
RUN chmod +x start.sh

# 앱 실행 커맨드
CMD ["./start.sh"]
