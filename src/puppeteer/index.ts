import puppeteer, { Page, Browser, ConsoleMessage, Target } from 'puppeteer';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/ko'; // 한국어 로케일 추가
import weekOfYear from 'dayjs/plugin/weekOfYear'; // 주차 계산을 위한 플러그인
import dotenv from 'dotenv';
import { getLottoRecommendation } from '../ai';

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
  // if (debugMode) {
  console.log(`[DEBUG ${dayjs().format('HH:mm:ss')}]`, ...args);
  // }
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

  // let offset = 0;

  // const checkUpdates = async () => {
  //   try {
  //     const response = await axios.get(
  //       `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/getUpdates`,
  //       {
  //         params: { offset, timeout: 30 },
  //       },
  //     );

  //     const updates = response.data.result;

  //     if (updates && updates.length > 0) {
  //       // 마지막 업데이트의 ID + 1을 다음 offset으로 설정
  //       offset = updates[updates.length - 1].update_id + 1;

  //       // 각 업데이트 처리
  //       for (const update of updates) {
  //         // 콜백 쿼리 처리 (버튼 클릭)
  //         if (update.callback_query) {
  //           const { id, data } = update.callback_query;
  //           await handleTelegramCallback(id, data);
  //         }
  //       }
  //     }
  //   } catch (error) {
  //     console.error('텔레그램 업데이트 확인 실패:', error);
  //   }

  //   // 재귀적으로 다음 업데이트 확인
  //   setTimeout(checkUpdates, 1000);
  // };

  // // 업데이트 확인 시작
  // checkUpdates();
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
      // reply_markup: {
      //   inline_keyboard: [
      //     [
      //       {
      //         text: '🎲 로또 번호 추첨',
      //         callback_data: 'generate_lotto',
      //       },
      //     ],
      //   ],
      // },
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
      // await axios.post(CONFIG.SLACK_API_URL, payload);
    }
  } catch (error) {
    console.error('슬랙 메시지 전송 실패:', error);
  }
}

async function hookAlert(message: string): Promise<void> {
  try {
    // 슬랙으로 메시지 전송
    await hookSlack(message);

    // 텔레그램으로 메시지 전송
    // await hookTelegram(message);
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

  return await puppeteer.launch({
    headless: headlessMode ? 'new' : false,
    defaultViewport: null,
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
    executablePath: process.env.CHROME_PATH || undefined,
  });
}

// 2. 페이지 설정 단계
async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();

  // 디버그 모드에서 네트워크 요청 로깅
  if (debugMode) {
    page.on('console', (msg: ConsoleMessage) =>
      debug('브라우저 콘솔:', msg.text()),
    );
    page.on('pageerror', (err: Error) => debug('페이지 에러:', err));
  }

  // 윈도우 팝업창 닫기 설정
  await page.evaluateOnNewDocument(() => {
    window.open = () => null;
  });

  browser.on('targetcreated', async (target: Target) => {
    const newPage = await target.page();
    if (newPage) {
      await newPage.close();
    }
  });

  // DOM 요소를 찾지 못할 때 대기 시간 설정
  await page.setDefaultTimeout(10000); // 10초로 설정

  return page;
}

// 3. 로그인 단계
async function loginStep(page: Page): Promise<void> {
  debug('로그인 단계 시작');

  try {
    debug('로그인 페이지로 이동');
    await page.goto('https://dhlottery.co.kr/user.do?method=login', {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });

    // 디버그 모드 처리
    if (debugMode) {
      await page.evaluate(() => {
        // debugger;
      });

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
    const loginFormExists = await page.evaluate(() => {
      const idInput = document.querySelector('[placeholder="아이디"]');
      const pwInput = document.querySelector('[placeholder="비밀번호"]');
      return {
        hasIdInput: !!idInput,
        hasPwInput: !!pwInput,
        html: document.documentElement.innerHTML,
      };
    });

    debug('로그인 폼 상태:', {
      idInputExists: loginFormExists.hasIdInput,
      pwInputExists: loginFormExists.hasPwInput,
    });

    if (!loginFormExists.hasIdInput || !loginFormExists.hasPwInput) {
      debug(
        '로그인 폼을 찾을 수 없음. 현재 HTML:',
        loginFormExists.html.substring(0, 500) + '...',
      );
      throw new Error('로그인 폼을 찾을 수 없습니다.');
    }

    debug('로그인 시도...');
    await page.type('[placeholder="아이디"]', CONFIG.USER_ID);
    debug('아이디 입력 완료');

    // 디버그 모드에서만 HTML 저장
    if (debugMode) {
      await page.content();
    }

    await page.type('[placeholder="비밀번호"]', CONFIG.USER_PW);
    debug('비밀번호 입력 완료, 로그인 버튼 클릭');

    await Promise.all([
      page.waitForNavigation(),
      page.click('form[name="jform"] .btn_common.lrg.blu'),
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
      'https://dhlottery.co.kr/common.do?method=main&mainMode=default',
    );

    // 사용자 이름 추출
    const userName = await page.$eval(
      'ul.information li:first-child strong',
      (el: Element) => el.textContent?.trim() || '',
    );

    // 예치금 추출
    const balanceText = await page.$eval(
      'ul.information li.money a[href*="depositListView"] strong',
      (el: Element) => el.textContent?.trim() || '',
    );

    const balance = parseInt(balanceText.replace(/[,원]/g, ''));
    debug(`사용자: ${userName.replace('*', '*')}, 예치금: ${balance}원`);
    await hookAlert(
      `로그인 사용자: ${userName.replace('*', '*')}, 예치금: ${balance}`,
    );

    if (1000 * CONFIG.COUNT > balance) {
      throw new Error(
        '예치금이 부족합니다! 충전해주세요! - https://dhlottery.co.kr/payment.do?method=payment',
      );
    }

    return { userName, balance };
  } catch (error) {
    debug('예치금 확인 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '예치금확인', error);
    throw error;
  }
}

// 5. 로또 구매 페이지 이동 단계
async function navigateToLottoPageStep(page: Page): Promise<void> {
  debug('로또 구매 페이지 이동 단계 시작');

  try {
    // 로또 구매 페이지
    await page.goto('https://ol.dhlottery.co.kr/olotto/game/game645.do', {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });

    // 경고창 처리
    const alertButton = await page.$('#popupLayerAlert button');
    if (alertButton) {
      await alertButton.click();
    }
  } catch (error) {
    debug('로또 구매 페이지 이동 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '페이지이동', error);
    throw error;
  }
}

// 6. AI 추천 번호 선택 단계
async function selectRecommendedNumbersStep(page: Page): Promise<void> {
  debug('AI 추천 번호 선택 단계 시작');
  try {
    // 로또 AI로부터 추천번호 받아오기 -
    // 현재 연도의 주차 번호 계산
    const currentWeek = dayjs().week();

    // 주차 번호에 따라 AI 제공자 결정 (짝수 주: Gemini, 홀수 주: OpenAI)
    const aiProvider = 'google'; //currentWeek % 2 === 0 ? 'google' : 'openai';
    const aiProviderName = aiProvider === 'google' ? 'Gemini AI' : 'OpenAI';

    await hookAlert(
      `${CONFIG.COUNT}개 자동 복권 구매 시작합니다! (이번 주 AI: ${aiProviderName}) 나머지는 나의 로또 번호`,
    );
    // 격주로 변경되는 provider 사용
    console.log(`\n----- ${aiProviderName} 사용 -----`);
    const aiResult = await getLottoRecommendation({ provider: aiProvider });
    const recommendNumbers = aiResult.recommendations;

    debug('추천받은 로또 번호로 선택 시작', recommendNumbers);
    // 수동 선택 모드로 전환
    await page.waitForSelector('#num1');
    await page.click('#num1');

    // 추천받은 번호 배열 순회 (최대 5개 세트)
    for (let i = 0; i < recommendNumbers.length && i < 5; i++) {
      debug(
        `${i + 1}번째 추천번호 세트 선택 중: ${recommendNumbers[i].join(', ')}`,
      );

      // 현재 세트의 6개 번호 순회하며 선택
      for (const number of recommendNumbers[i]) {
        debug(number);
        // 번호에 해당하는 DOM 요소 선택하여 클릭
        await page.waitForSelector(`#check645num${number}`);
        await page.evaluate((num) => {
          const element = document.getElementById(`check645num${num}`);
          if (element) element.click();
        }, number);
        debug(`번호 ${number} 선택됨`);
      }

      // 선택 완료 후 확인 버튼 클릭
      await page.waitForSelector('#btnSelectNum');
      await page.click('#btnSelectNum');
      debug(`${i + 1}번째 세트 선택 완료`);
    }

    debug('모든 추천 번호 선택 완료');
  } catch (error) {
    debug('추천 번호 선택 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '추천번호선택', error);
    throw error;
  }
}

// 7. 나의 로또 번호 선택 단계
async function selectMyLottoNumbersStep(page: Page): Promise<void> {
  debug('나의 로또 번호 선택 단계 시작');

  try {
    await page.click('text=나의로또번호');

    // 첫 번째, 두 번째 체크박스 선택
    const checkboxes = await page.$$('#myList li input[type="checkbox"]');
    if (checkboxes.length >= 2) {
      await checkboxes[0].click();
      await checkboxes[1].click();
    } else {
      debug('선택 가능한 나의 로또 번호가 2개 미만입니다.');
    }

    // 확인 버튼 클릭
    await page.click('input[name="btnMyNumber"]');
    debug('나의 로또 번호 선택 완료');
  } catch (error) {
    debug('나의 로또 번호 선택 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '나의로또번호선택', error);
    throw error;
  }
}

// 8. 구매 완료 단계
async function purchaseLottoStep(page: Page): Promise<void> {
  debug('구매 완료 단계 시작');

  try {
    await page.waitForSelector('#btnBuy');
    await page.click('#btnBuy');
    // await page.click('input[value="구매하기"]');
    // const elementBtn = await page.$('#btnBuy');

    try {
      // 타임아웃 시간을 10초로 늘림
      await page.waitForSelector('#popupLayerConfirm');

      debug('popupLayerConfirm 창 확인');
      // 그 다음 요소가 표시되는지 확인
      const isVisible2 = await page.evaluate(() => {
        const el = document.querySelector('#popupLayerConfirm');
        return el && window.getComputedStyle(el).display !== 'none';
      });

      const isVisible = await page.evaluate(() => {
        const el = document.querySelector(
          '#popupLayerConfirm',
        ) as HTMLDivElement;
        return el && el.style.display !== 'none';
      });

      debug('isVisible 값:' + isVisible);
      debug('isVisible2 값:' + isVisible2);
      // if (isVisible) {
      // 확인 버튼 클릭
      const approvedBtn = await page.$('.confirm');
      if (approvedBtn) {
        await page.click('.confirm');
      }
      // await page.evaluate(() => {
      //   const element = document.querySelector(
      //     `input[type="button"][value="확인"]`,
      //   ) as any;
      //   if (element) element.click();
      // });
      // }
      // 확인 버튼을 누른 후 필요한 경우 닫기 버튼 클릭
      const closeLayerExists = await page.$('input[name="closeLayer"]');
      if (closeLayerExists) {
        await page.click('input[name="closeLayer"]');
      }
      await hookAlert(
        `${CONFIG.COUNT}개 복권 구매 성공! - 확인하러가기: https://dhlottery.co.kr/myPage.do?method=notScratchListView`,
      );
    } catch (popupError) {
      debug('확인 팝업이 나타나지 않았습니다. 구매는 진행되었을 수 있습니다.');
      await hookAlert(`구매버튼 오류 발생`);
      throw popupError;
      // 팝업이 나타나지 않아도 구매는
      // 진행되었을 수 있으므로 계속 진행
    }

    debug('구매 완료');
  } catch (error) {
    debug('구매 완료 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '구매완료', error);
    throw error;
  }
}

// 10. 구매 테스트
async function buyTest(page: Page): Promise<void> {
  try {
    debug('추천받은 로또 번호로 선택 시작');
    // 수동 선택 모드로 전환
    await page.waitForSelector('#num1');
    await page.click('#num1');

    // 123456  배열 만들기
    const recommendNumbers = [[1, 2, 3, 4, 5, 6]];

    // 추천받은 번호 배열 순회 (최대 5개 세트)
    for (let i = 0; i < recommendNumbers.length && i < 5; i++) {
      debug(
        `${i + 1}번째 추천번호 세트 선택 중: ${recommendNumbers[i].join(', ')}`,
      );

      // 현재 세트의 6개 번호 순회하며 선택
      for (const number of recommendNumbers[i]) {
        debug(number);
        // 번호에 해당하는 DOM 요소 선택하여 클릭
        await page.waitForSelector(`#check645num${number}`);
        await page.evaluate((num) => {
          const element = document.getElementById(`check645num${num}`);
          if (element) element.click();
        }, number);
        debug(`번호 ${number} 선택됨`);
      }

      // 선택 완료 후 확인 버튼 클릭
      await page.waitForSelector('#btnSelectNum');
      await page.click('#btnSelectNum');
      debug(`${i + 1}번째 세트 선택 완료`);
    }

    debug('모든 추천 번호 선택 완료');

    // 구매하기 버튼 클릭
    console.log(11111);
    await page.evaluate(() => {
      console.log(2222);
      console.log(
        '버튼 클릭 전 팝업 상태:',
        (document.querySelector('#popupLayerConfirm') as any)?.style?.display,
      );
    });
    console.log(3333);
    await page.waitForSelector('#btnBuy');
    await page.click('#btnBuy');
    console.log(4444);
    // 클릭 후 팝업 상태 확인
    await page.evaluate(() => {
      console.log(
        '버튼 클릭 후 팝업 상태:',
        (document.querySelector('#popupLayerConfirm') as any)?.style?.display,
      );
    });

    await page.waitForSelector('#popupLayerConfirm', {
      visible: true,
      timeout: 10000,
    });
    console.log(5555);
    // 팝업이 나타날 때까지 대기
    // await page.waitForFunction(
    //   () => {
    //     const popup = document.querySelector(
    //       '#popupLayerConfirm',
    //     ) as HTMLDivElement;
    //     return popup && popup?.style?.display === 'block';
    //   },
    //   { timeout: 5000 }, // 5초 타임아웃
    // );

    console.log('팝업이 나타났습니다.');

    // 확인 버튼 클릭
    // await page.waitForSelector('.layer-alert input[value="확인"]');
    // await page.click('.layer-alert input[value="확인"]');

    console.log('확인 버튼을 클릭했습니다.');

    // 작업 완료 후 잠시 대기 (필요에 따라 조정)
    await page.waitForTimeout(3000);
  } catch (error) {
    debug('추천 번호 선택 단계에서 오류 발생:', error);
    await captureErrorScreenshot(page, '추천번호선택', error);
    throw error;
  }
}

// 단계 실행 관리자
async function executeSteps(
  steps: IStep[],
  initialData: any = {},
): Promise<void> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let stepData = { ...initialData };

  try {
    // 브라우저 초기화
    browser = await initializeBrowser();
    page = await setupPage(browser);

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
      // 디버그 모드에서는 브라우저 닫지 않음
    } else if (browser) {
      await browser.close();
      debug('브라우저 종료');
    }
  }
}

// 메인 실행 함수
async function buyLotto(): Promise<void> {
  try {
    // 텔레그램 업데이트 확인 시작
    // startTelegramUpdates();

    // 실행할 단계 정의
    const steps: IStep[] = [
      { name: '로그인', execute: async (page) => await loginStep(page) },
      {
        name: '예치금 확인',
        execute: async (page) => await checkBalanceStep(page),
      },
      {
        name: '로또 구매 페이지 이동',
        execute: async (page) => await navigateToLottoPageStep(page),
      },
      {
        name: '구메 테스트',
        execute: async (page) => await buyTest(page),
      },
      {
        name: 'AI 추천 번호 선택',
        execute: async (page) => await selectRecommendedNumbersStep(page),
        skip: true,
      },
      {
        name: '나의 로또 번호 선택',
        execute: async (page) => await selectMyLottoNumbersStep(page),
        skip: true,
      },
      {
        name: '구매 완료',
        execute: async (page) => await purchaseLottoStep(page),
        skip: true,
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
buyLotto().catch(console.error);
