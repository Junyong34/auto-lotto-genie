import { Browser, BrowserContext, Page, chromium } from 'playwright';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/ko'; // 한국어 로케일 추가
import weekOfYear from 'dayjs/plugin/weekOfYear'; // 주차 계산을 위한 플러그인
import dotenv from 'dotenv';

// dayjs 플러그인 설정
dayjs.extend(weekOfYear);

// .env 파일 로드
dotenv.config();

// dayjs 한국어 설정
dayjs.locale('ko');

interface ISlackMessage {
  text: string;
}

// 명령행 인자 처리
const args = process.argv.slice(2);
const headlessMode = args.includes('--headless') || args.includes('-h');
const debugMode = args.includes('--debug') || args.includes('-d');

// 설정값
const CONFIG = {
  USER_ID: process.env.LOTTO_USER_ID || '',
  USER_PW: process.env.LOTTO_USER_PW || '',
  COUNT: Number(process.env.LOTTO_COUNT || 5),
  SLACK_API_URL: process.env.SLACK_API_URL || '',
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
};

// 환경변수 검증
if (!CONFIG.USER_ID || !CONFIG.USER_PW) {
  console.error(
    '오류: .env 파일에 LOTTO_USER_ID와 LOTTO_USER_PW를 설정해주세요.',
  );
  process.exit(1);
}

// 디버깅 로그 함수
function debug(...args: any[]): void {
  console.log(`[DEBUG ${dayjs().format('HH:mm:ss')}]`, ...args);
}

// 오류 발생 시 스크린샷 저장 함수
async function captureErrorScreenshot(
  page: Page | null,
  stepName: string,
  error: Error | unknown,
): Promise<void> {
  if (!page) return;

  try {
    const errorScreenshotPath = `./src/screens-images/errors/${stepName}-error-${dayjs().format(
      'YYYYMMDD-HHmmss',
    )}.png`;
    await page.screenshot({
      path: errorScreenshotPath,
      fullPage: true,
    });
    debug(`[${stepName}] 오류 발생 스크린샷 저장: ${errorScreenshotPath}`);
    await hookAlert(
      `[${stepName}] 오류 발생: ${
        error instanceof Error ? error.message : String(error)
      } - 스크린샷: ${errorScreenshotPath}`,
    );
  } catch (screenshotError) {
    debug(`[${stepName}] 오류 발생 스크린샷 저장 실패:`, screenshotError);
  }
}

// 랜덤 로또 번호 생성 함수
function generateRandomLottoNumbers(): number[][] {
  const result: number[][] = [];

  // 5세트의 로또 번호 생성
  for (let i = 0; i < 5; i++) {
    const numbers = new Set<number>();

    // 각 세트는 6개의 번호로 구성
    while (numbers.size < 6) {
      // 1~45 사이의 랜덤 번호 생성
      const randomNumber = Math.floor(Math.random() * 45) + 1;
      numbers.add(randomNumber);
    }

    // 숫자를 오름차순으로 정렬
    result.push(Array.from(numbers).sort((a, b) => a - b));
  }

  return result;
}

// 텔레그램 로또 번호 추천 메시지 생성
function formatLottoRecommendation(lottoSets: number[][]): string {
  let message = '🎲 추천 로또 번호:\n';

  lottoSets.forEach((set, index) => {
    message += `세트 ${index + 1}: [${set.join(', ')}]\n`;
  });

  return message;
}

// 텔레그램 메시지 콜백 처리
async function handleTelegramCallback(
  callback_query_id: string,
  data: string,
): Promise<void> {
  if (!CONFIG.TELEGRAM_TOKEN) {
    debug('텔레그램 토큰이 설정되지 않았습니다.');
    return;
  }

  try {
    // 콜백 쿼리 응답 (버튼 로딩 상태 제거)
    await axios.post(
      `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/answerCallbackQuery`,
      {
        callback_query_id,
        text: '로또 번호를 생성하는 중...',
      },
    );

    // 랜덤 로또 번호 생성
    const randomLottoNumbers = generateRandomLottoNumbers();
    const lottoMessage = formatLottoRecommendation(randomLottoNumbers);

    // 결과 메시지 전송
    await hookTelegram(lottoMessage);

    debug('텔레그램 콜백 처리 성공');
  } catch (error) {
    console.error('텔레그램 콜백 처리 실패:', error);
  }
}

// 텔레그램 메시지 업데이트 확인 함수
async function startTelegramUpdates(): Promise<void> {
  if (!CONFIG.TELEGRAM_TOKEN) {
    debug('텔레그램 토큰이 설정되지 않았습니다.');
    return;
  }
}

// 텔레그램으로 메시지 전송 함수
async function hookTelegram(message: string): Promise<void> {
  if (!CONFIG.TELEGRAM_TOKEN) {
    debug('텔레그램 토큰이 설정되지 않았습니다.');
    return;
  }

  const koreaTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const formattedMessage = `
<b>🎯 로또 자동 구매 봇 알림</b>
<i>${koreaTime}</i>
───────────────
${message}
───────────────`;

  try {
    // 텔레그램 API 엔드포인트: sendMessage 메서드 사용
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;

    await axios.post(url, {
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: formattedMessage,
      parse_mode: 'HTML',
    });

    debug('텔레그램 메시지 전송 성공');
  } catch (error) {
    console.error('텔레그램 메시지 전송 실패:', error);
  }
}

async function hookSlack(message: string): Promise<void> {
  const koreaTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const payload: any = {
    attachments: [
      {
        title: '알람',
        text: `> ${koreaTime} *로또 자동 구매 봇 알림* \n ${message}`,
        color: '#36a64f',
      },
    ],
  };

  try {
    // Slack으로 메시지 전송
    if (CONFIG.SLACK_API_URL) {
      await axios.post(CONFIG.SLACK_API_URL, payload);
    }
  } catch (error) {
    console.error('슬랙 메시지 전송 실패:', error);
  }
}

async function hookAlert(message: string): Promise<void> {
  try {
    // 슬랙으로 메시지 전송
    // await hookSlack(message);
    // 텔레그램으로 메시지 전송
    await hookTelegram(message);
  } catch (error) {
    console.error('알람 전송 실패:', error);
  }
}

// 각 단계를 별도 함수로 분리
interface IStep {
  name: string;
  execute: (page: Page, data?: any) => Promise<any>;
  skip?: boolean; // 단계 건너뛰기 여부
}

// 1. 브라우저 초기화 단계
async function initializeBrowser(): Promise<Browser> {
  debug('브라우저 실행 모드:', headlessMode ? '헤드리스' : '일반');

  return await chromium.launch({
    headless: headlessMode,
    slowMo: debugMode ? 100 : 50,
    args: [
      '--window-size=1920,1080',
      '--disable-popup-blocking',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
    devtools: debugMode,
  });
}

// 2. 컨텍스트 및 페이지 설정 단계
async function setupPage(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // 디버그 모드에서 네트워크 요청 로깅
  if (debugMode) {
    page.on('console', (msg) => debug('브라우저 콘솔:', msg.text()));
    page.on('pageerror', (err) => debug('페이지 에러:', err));
  }

  // 윈도우 팝업창 닫기 설정
  context.on('page', async (popup) => {
    debug('팝업 감지됨, 닫는 중...');
    await popup.close();
  });

  // 기본 타임아웃 설정
  page.setDefaultTimeout(10000); // 10초로 설정

  return { context, page };
}

// 3. 로그인 단계
async function loginStep(page: Page): Promise<void> {
  debug('로그인 단계 시작');

  try {
    debug('로그인 페이지로 이동');
    await page.goto('https://dhlottery.co.kr/login');

    // 디버그 모드 처리
    if (debugMode) {
      const screenshotPath = `./src/screens-images/debug/login-debug-${dayjs().format(
        'YYYYMMDD-HHmmss',
      )}.png`;
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });
      debug(`스크린샷 저장: ${screenshotPath}`);
    }

    debug('페이지 로딩 상태 확인');
    const pageTitle = await page.title();
    debug('현재 페이지 제목:', pageTitle);

    // 로그인 폼이 실제로 존재하는지 확인
    const idInput = await page.locator('[placeholder="아이디"]');
    const pwInput = await page.locator('[placeholder="비밀번호"]');

    const idVisible = await idInput.isVisible();
    const pwVisible = await pwInput.isVisible();

    debug('로그인 폼 상태:', {
      idInputExists: idVisible,
      pwInputExists: pwVisible,
    });

    if (!idVisible || !pwVisible) {
      debug('로그인 폼을 찾을 수 없음.');
      throw new Error('로그인 폼을 찾을 수 없습니다.');
    }

    debug('로그인 시도...');
    await idInput.fill(CONFIG.USER_ID);
    debug('아이디 입력 완료');

    await pwInput.fill(CONFIG.USER_PW);
    debug('비밀번호 입력 완료, 로그인 버튼 클릭');

    await Promise.all([
      //   page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.locator('form[name="loginForm"] #btnLogin').click(),
    ]);
    debug('로그인 완료');
  } catch (error) {
    debug('로그인 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '로그인', error);
    throw error;
  }
}

// 4. 예치금 확인 단계
async function checkBalanceStep(
  page: Page,
): Promise<{ userName: string; balance: number }> {
  debug('예치금 확인 단계 시작');

  try {
    debug('메인 페이지로 이동하여 예치금 확인');
    await page.goto(
      'https://dhlottery.co.kr/mypage/home',
    );
    // 사용자 이름 추출
    const userName =
      (await page
        .locator('#divUserNm')
        .textContent()) || '';

    // 예치금 추출
    let balanceText = '';
    let retries = 0;
    const maxRetries = 10;

    while (retries < maxRetries) {
      balanceText = (await page.locator('#divCrntEntrsAmt').textContent()) || '';

      // 숫자가 포함되어 있고 "원"이 포함되어 있으면 성공
      if (balanceText.trim() && balanceText.includes('원') && /\d/.test(balanceText)) {
        debug('예치금 정보 로드 성공:', balanceText);
        break;
      }

      debug(`예치금 정보 대기 중... (${retries + 1}/${maxRetries})`);
      await page.waitForTimeout(1000); // 1초 대기
      retries++;
    }

    if (!balanceText.trim() || !balanceText.includes('원') || !/\d/.test(balanceText)) {
      throw new Error('예치금 정보를 가져올 수 없습니다.');
    }

    const balance = parseInt(balanceText.replace(/[,원]/g, ''));
    debug(`사용자: ${userName.replace('*', '*')}, 예치금: ${balance}원`);
    // if (balance < 5000) {
    //   await hookAlert(
    //     `⚠️ 예치금 부족 알림\n로그인 사용자: ${userName.replace(
    //       '*',
    //       '*',
    //     )}\n현재 예치금: ${balance}원\n예치금을 충전해주세요!\n충전하기 👉 https://dhlottery.co.kr/payment.do?method=payment`,
    //   );
    // } else {
    //   await hookAlert(`로그인 사용자: ${userName.replace('*', '*')}`);
    // }
    //
    // if (1000 * CONFIG.COUNT > balance) {
    //   throw new Error(
    //     '예치금이 부족합니다! 충전해주세요! - https://dhlottery.co.kr/payment.do?method=payment',
    //   );
    // }

    return { userName, balance };
  } catch (error) {
    debug('예치금 확인 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '예치금확인', error);
    throw error;
  }
}

// 5. 로또 구매결과 페이지 이동 단계
async function navigateToLottoReslutPageStep(page: Page): Promise<void> {
  debug('로또 구매결과 페이지 이동 단계 시작');

  try {
    // 로또 구매결과 페이지
    await page.goto(
      'https://dhlottery.co.kr/mypage/mylotteryledger',
    );

    // 1주일 버튼 클릭
    await page.getByRole('button', { name: '1주일' }).click();
    debug('1주일 기간 선택 완료');

    // 조회 버튼 클릭
    await page.locator('#btnSrch').click();
    debug('조회 버튼 클릭 완료');

    const firstRow = await page.locator('#winning-history-list .whl-body .whl-row').first();

// 구입일자
    const date = await firstRow.locator('.col-date1 .whl-txt').textContent();

// 당첨결과
    const drawStatus = await firstRow.locator('.col-result .whl-txt').textContent();

// 추가로 필요하다면 다른 정보도 가져올 수 있습니다:
// 복권명
    const lotteryName = await firstRow.locator('.col-name .whl-txt').textContent();

// 회차
    const round = await firstRow.locator('.col-th .whl-txt').textContent();

// 선택번호
    const numbers = await firstRow.locator('.col-num .whl-txt').textContent();

// 구입매수
    const quantity = await firstRow.locator('.col-ea .whl-txt').textContent();

// 당첨금
    const prize = await firstRow.locator('.col-am .whl-txt').textContent();

// 추첨일자
    const drawDate = await firstRow.locator('.col-date2 .whl-txt').textContent();
    // 결과 출력
    debug(`구매 날짜: ${date?.trim()}, 당첨 상태: ${drawStatus?.trim()}`);
    const isWin = drawStatus?.trim() === '당첨';
    await hookAlert(
      isWin
        ? '🎉 축하드립니다! 당첨되셨습니다!' + ' 당첨금 : ' + prize + '일까? 아닐까?'
        : '😅 아쉽게도 낙첨되었습니다. 다음주에 재도전하세요!',
    );
  } catch (error) {
    debug('로또 구매 페이지 이동 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '페이지이동', error);
    throw error;
  }
}

// 단계 실행 관리자
async function executeSteps(
  steps: IStep[],
  initialData: any = {},
): Promise<void> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let stepData = { ...initialData };

  try {
    // 브라우저 초기화
    browser = await initializeBrowser();
    const setup = await setupPage(browser);
    context = setup.context;
    page = setup.page;

    // 모든 단계 순차적 실행
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // skip이 true인 단계는 건너뜀
      if (step.skip) {
        debug(`${i + 1}/${steps.length} 단계 건너뜀: ${step.name}`);
        continue;
      }

      debug(`${i + 1}/${steps.length} 단계 실행: ${step.name}`);

      try {
        const result = await step.execute(page, stepData);
        // 단계 실행 결과 데이터 업데이트
        if (result) {
          stepData = { ...stepData, ...result };
        }
        debug(`${step.name} 단계 완료`);
      } catch (error) {
        debug(`${step.name} 단계 실패:`, error);
        throw error;
      }
    }
  } catch (error) {
    console.error('상세 에러:', error);
    debug('에러 발생:', error);
    await hookAlert(error instanceof Error ? error.message : String(error));
    process.exit(1); // Git Action에서 실패로 인식되도록 종료 코드 1 반환
  } finally {
    if (debugMode) {
      debug(
        '디버그 모드에서는 브라우저를 자동으로 닫지 않습니다. 수동으로 닫아주세요.',
      );
    }
    if (context) await context.close();
    if (browser) await browser.close();
    debug('브라우저 종료');
  }
}

// 메인 실행 함수
async function resultLotto(): Promise<void> {
  try {
    // 실행할 단계 정의
    const steps: IStep[] = [
      { name: '로그인', execute: async (page) => await loginStep(page) },
      {
        name: '예치금 확인',
        execute: async (page) => await checkBalanceStep(page),
      },
      {
        name: '로또 당첨 페이지 이동',
        execute: async (page) => await navigateToLottoReslutPageStep(page),
      },
    ];

    // 단계 실행
    await executeSteps(steps);
  } catch (error) {
    debug('로또 구매 중 오류 발생:', error);
    throw error;
  }
}

// 프로그램 실행
resultLotto().catch(console.error);
