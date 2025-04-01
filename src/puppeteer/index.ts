import puppeteer from 'puppeteer';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/ko'; // 한국어 로케일 추가
import dotenv from 'dotenv';
import { getLottoRecommendation } from '../ai';

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
  COUNT: Number(process.env.LOTTO_COUNT || 3),
  SLACK_API_URL: process.env.SLACK_API_URL || '',
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
  page: any,
  stepName: string,
  error: any,
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
    await hookSlack(
      `[${stepName}] 오류 발생: ${error.message} - 스크린샷: ${errorScreenshotPath}`,
    );
  } catch (screenshotError) {
    debug(`[${stepName}] 오류 발생 스크린샷 저장 실패:`, screenshotError);
  }
}

async function hookSlack(message: string): Promise<void> {
  const koreaTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  // const payload: ISlackMessage = {
  // text: `> ${koreaTime} *로또 자동 구매 봇 알림* \n ${message}`,
  // };
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
    await axios.post(CONFIG.SLACK_API_URL, payload);
  } catch (error) {
    console.error('Slack 메시지 전송 실패:', error);
  }
}

async function buyLotto(): Promise<void> {
  await hookSlack(
    `${CONFIG.COUNT}개 자동 복권 구매 시작합니다! 나머지는 나의 로또 번호`,
  );

  // 로또 AI로부터 추천번호 받아오기
  const geminiResult = await getLottoRecommendation({ provider: 'google' });
  const recommendNumbers = geminiResult.recommendations;

  debug('브라우저 실행 모드:', headlessMode ? '헤드리스' : '일반');

  const browser = await puppeteer.launch({
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

  let page = null;

  try {
    page = await browser.newPage();

    // 디버그 모드에서 네트워크 요청 로깅
    if (debugMode) {
      page.on('console', (msg) => debug('브라우저 콘솔:', msg.text()));
      page.on('pageerror', (err) => debug('페이지 에러:', err));
      // page.on('request', (request) => debug('요청:', request.url()));
      // page.on('response', (response) =>
      //   debug('응답:', response.url(), response.status()),
      // );
    }

    // DOM 요소를 찾지 못할 때 대기 시간 설정
    await page.setDefaultTimeout(10000); // 10초로 증가

    // 1. 로그인 단계
    try {
      debug('로그인 페이지로 이동');
      await page.goto('https://dhlottery.co.kr/user.do?method=login', {
        waitUntil: 'networkidle0',
        timeout: 10000,
      });

      // 디버그 모드인 경우만 동작 중지 및 스크린샷
      if (debugMode) {
        // 특정 동작 전에 일시 중지하고 싶을 때
        await page.evaluate(() => {
          debugger;
        });

        // 스크린샷 찍기
        const screenshotPath = `./src/screens-images/debug/debug-${dayjs().format(
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

      if (!loginFormExists.hasIdInput || !loginFormExists.pwInputExists) {
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
        const html = await page.content();
        // debug('현재 페이지 HTML 길이:', html.length);
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

    // 2. 예치금 확인 단계
    try {
      debug('메인 페이지로 이동하여 예치금 확인');
      await page.goto(
        'https://dhlottery.co.kr/common.do?method=main&mainMode=default',
      );

      // 윈도우 팝업창 닫기
      await page.evaluateOnNewDocument(() => {
        window.open = () => null;
      });
      browser.on('targetcreated', async (target) => {
        const page = await target.page();
        console.log(page);
        if (page) {
          await page.close();
        }
      });

      // 사용자 이름 추출: ul.information의 첫번째 li의 strong 태그 선택
      const userName = await page.$eval(
        'ul.information li:first-child strong',
        (el) => el.textContent?.trim() || '',
      );

      // 예치금 추출: ul.information의 li.money 안에서 depositListView 링크의 strong 태그 선택
      const balanceText = await page.$eval(
        'ul.information li.money a[href*="depositListView"] strong',
        (el) => el.textContent?.trim() || '',
      );

      const balance = parseInt(balanceText.replace(/[,원]/g, ''));
      debug(`사용자: ${userName}, 예치금: ${balance}원`);
      await hookSlack(`로그인 사용자: ${userName}, 예치금: ${balance}`);

      if (1000 * CONFIG.COUNT > balance) {
        throw new Error(
          '예치금이 부족합니다! 충전해주세요! - https://dhlottery.co.kr/payment.do?method=payment',
        );
      }
    } catch (error) {
      debug('예치금 확인 단계에서 오류 발생:', error);
      await captureErrorScreenshot(page, '예치금확인', error);
      throw error;
    }

    // 3. 로또 구매 페이지 이동 및 번호 발급
    try {
      // 로또 구매 페이지
      await page.goto('https://ol.dhlottery.co.kr/olotto/game/game645.do');

      // 경고창 처리
      const alertButton = await page.$('#popupLayerAlert button');
      if (alertButton) {
        await alertButton.click();
      }

      // recommendNumbers에서 추천받은 번호로 로또 번호 선택하기
      try {
        debug('추천받은 로또 번호로 선택 시작', recommendNumbers);

        // 수동 선택 모드로 전환
        await page.waitForSelector('#num1');
        await page.click('#num1');

        // 추천받은 번호 배열 순회 (최대 5개 세트)
        for (let i = 0; i < recommendNumbers.length && i < 5; i++) {
          debug(
            `${i + 1}번째 추천번호 세트 선택 중: ${recommendNumbers[i].join(
              ', ',
            )}`,
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
            // await page.waitForTimeout(150); // 약간의 딜레이 추가
          }

          // 선택 완료 후 확인 버튼 클릭
          await page.waitForSelector('#btnSelectNum');
          await page.click('#btnSelectNum');
          debug(`${i + 1}번째 세트 선택 완료`);

          // 다음 세트를 위한 대기
          // await page.waitForTimeout(800);
        }

        debug('모든 추천 번호 선택 완료');
      } catch (error) {
        debug('추천 번호 선택 단계에서 오류 발생:', error);
        await captureErrorScreenshot(page, '추천번호선택', error);
        throw error;
      }
    } catch (error) {
      debug('자동번호 발급 단계에서 오류 발생:', error);
      await captureErrorScreenshot(page, '자동번호발급', error);
      throw error;
    }

    // recommendNumbers에서 추천받은 번호로 로또 번호 선택하기

    // // 4. 나의 로또 번호 선택
    // try {
    //   await page.click('text=나의로또번호');

    //   // 첫 번째, 두 번째 체크박스 선택
    //   const checkboxes = await page.$$('#myList li input[type="checkbox"]');
    //   if (checkboxes.length >= 2) {
    //     await checkboxes[0].click();
    //     await checkboxes[1].click();
    //   }

    //   // 확인 버튼 클릭
    //   await page.click('input[name="btnMyNumber"]');
    // } catch (error) {
    //   debug('나의 로또 번호 선택 단계에서 오류 발생:', error);
    //   await captureErrorScreenshot(page, '나의로또번호선택', error);
    //   throw error;
    // }

    // 5. 구매하기 (주석 처리되어 있음)
    // try {
    //   await page.click('input[value="구매하기"]');
    //   await page.waitForNetworkIdle();
    //   await page.waitForTimeout(2000);
    //   await page.click('input[type="button"][value="확인"]');
    //   await page.click('input[name="closeLayer"]');
    //   await hookSlack(
    //     `${CONFIG.COUNT}개 복권 구매 성공! - 확인하러가기: https://dhlottery.co.kr/myPage.do?method=notScratchListView`,
    //   );
    // } catch (error) {
    //   debug('구매 완료 단계에서 오류 발생:', error);
    //   await captureErrorScreenshot(page, '구매완료', error);
    //   throw error;
    // }
  } catch (error) {
    console.error('상세 에러:', error);
    debug('에러 발생:', error);
    await hookSlack(error as unknown as string);
    throw error;
  } finally {
    if (debugMode) {
      debug(
        '디버그 모드에서는 브라우저를 자동으로 닫지 않습니다. 수동으로 닫아주세요.',
      );
      // 디버그 모드에서는 브라우저 닫지 않음
    } else {
      await browser.close();
      debug('브라우저 종료');
    }
  }
}

// 프로그램 실행
buyLotto().catch(console.error);
