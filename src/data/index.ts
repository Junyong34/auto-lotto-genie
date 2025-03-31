import { google } from 'googleapis';
import dotenv from 'dotenv';
import { ILottoNumbers } from '../types';

dotenv.config();

/**
 * Google 스프레드시트에서 로또 당첨 번호 데이터를 가져오는 함수
 */
export async function getLottoWinningNumbers() {
  try {
    // 환경 변수에서 인증 정보 가져오기
    const CLIENT_EMAIL = process.env.CLIENT_EMAIL;
    const PRIVATE_KEY = process.env.PRIVATE_KEY?.replace(/\\n/g, '\n');
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

    if (!CLIENT_EMAIL || !PRIVATE_KEY || !SPREADSHEET_ID) {
      throw new Error('환경 변수가 올바르게 설정되지 않았습니다.');
    }

    // Google API 인증
    const authorize = new google.auth.JWT(
      CLIENT_EMAIL,
      undefined,
      PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets'],
    );

    // Google Sheets API 초기화
    const googleSheet = google.sheets({
      version: 'v4',
      auth: authorize,
    });

    // 스프레드시트 데이터 가져오기
    const response = await googleSheet.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'B4:T1101', // 원하는 범위
    });

    // 데이터 가공
    const lottoData = lottoWiningNumberList(response);

    // 결과 출력
    console.log('로또 당첨 번호 데이터 가져오기 성공:');
    const result = JSON.stringify(lottoData, null, 2);
    const lottoList = Object.keys(lottoData);
    console.log(lottoList.length + '개');
    // console.log(JSON.stringify(lottoData, null, 2));

    return lottoData;
  } catch (error) {
    console.error('로또 당첨 번호 데이터 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 스프레드시트 데이터를 가공하는 함수
 */
const lottoWiningNumberList = (ctx: any): ILottoNumbers => {
  const outputData: ILottoNumbers = {};

  if (!ctx.data || !ctx.data.values) {
    console.warn('데이터가 없거나 올바른 형식이 아닙니다.');
    return outputData;
  }

  ctx.data.values.forEach((row: string[], rowIndex: number) => {
    if (row && row.length > 0) {
      const key = row[0]; // 회차 번호 (B열)
      // 당첨 번호와 보너스 번호(null 값이 아닌 경우만)
      const values = row
        .slice(12, 19)
        .filter((val) => val !== null && val !== ''); // 당첨 번호 (N열부터 S열까지 - 6개 번호)
      const bonusNumber = row[19]; // 보너스 번호 (T열)

      if (values.length > 0) {
        // 보너스 번호가 유효한 경우만 추가
        if (bonusNumber && bonusNumber !== 'null' && bonusNumber !== '') {
          outputData[key] = [...values, bonusNumber];
        } else {
          outputData[key] = [...values];
        }
      }
    }
  });

  return outputData;
};

/**
 * 로또 당첨 번호 데이터를 배열 형태로 변환하는 함수
 */
export function convertToNumberArray(
  lottoData: ILottoNumbers,
  halfRandomly: boolean = false,
): number[][] {
  const result: number[][] = [];
  const draws = Object.keys(lottoData);

  // 랜덤으로 절반만 추출할지 여부 확인
  if (halfRandomly) {
    // 절반의 회차만 랜덤하게 선택
    const halfSize = Math.floor(draws.length / 2);
    const shuffled = [...draws].sort(() => 0.5 - Math.random());
    const selectedDraws = shuffled.slice(0, halfSize);

    // 선택된 회차 데이터만 변환
    selectedDraws.forEach((draw) => {
      const numbers = lottoData[draw].map((num) => parseInt(num, 10));
      result.push(numbers);
    });
  } else {
    // 모든 회차 데이터를 순회 (기존 방식)
    draws.forEach((draw) => {
      const numbers = lottoData[draw].map((num) => parseInt(num, 10));
      result.push(numbers);
    });
  }

  return result;
}

// 메인 실행 함수
async function main() {
  try {
    const lottoData = await getLottoWinningNumbers();

    // 전체 데이터를 배열 형태로 변환 (절반만 랜덤하게 추출)
    const halfRandomDrawsArray = convertToNumberArray(lottoData, true);
    console.log(
      '\n랜덤하게 추출한 당첨 번호 배열 수량:',
      halfRandomDrawsArray.length,
    );

    return halfRandomDrawsArray;
  } catch (error) {
    console.error('오류 발생:', error);
    return [];
  }
}

// 프로그램 실행
main();
