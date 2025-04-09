import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { IAIOptions, ILottoRecommendation } from '../types';
import { getLottoWinningNumbers, convertToNumberArray } from '../data';
import { loadPromptConfig } from '../config/promptConfig';
import { LOTTO_GENERATION_PROMPT, LOTTO_SYSTEM_PROMPT } from './prompts';

// 환경 변수 로드
dotenv.config();

// API 키 검증
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
  throw new Error(
    'GEMINI_API_KEY 또는 OPENAI_API_KEY가 설정되어 있지 않습니다.',
  );
}

/**
 * Google Gemini AI를 사용하여 로또 번호 추천
 */
async function getGeminiLottoRecommendation(): Promise<number[][]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY가 설정되어 있지 않습니다.');
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // 로또 당첨 번호 데이터 가져오기
    const lottoData = await getLottoWinningNumbers();
    const lottoHistoryArray = convertToNumberArray(lottoData);
    const lottoHistoryData = JSON.stringify(lottoHistoryArray);

    // 계산 프롬프트 로드
    const { calculatePrompt } = loadPromptConfig();

    // 최종 프롬프트 생성
    const prompt = LOTTO_GENERATION_PROMPT.replace(
      '{LOTTO_HISTORY_DATA}',
      lottoHistoryData,
    ).replace('{CALCULATE_PROMPT}', calculatePrompt);

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // JSON 추출 (문자열에서 JSON 부분만 추출)
    const jsonMatch = responseText.match(/\[\s*\[.*\]\s*\]/s);
    if (!jsonMatch) {
      throw new Error('응답에서 JSON 형식을 찾을 수 없습니다.');
    }

    // JSON 파싱
    const recommendations = JSON.parse(jsonMatch[0]) as number[][];

    // 유효성 검사
    validateLottoRecommendations(recommendations);

    return recommendations;
  } catch (error) {
    console.error('Gemini API 오류:', error);
    throw new Error(
      `Gemini API 오류: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * OpenAI를 사용하여 로또 번호 추천
 */
async function getOpenAILottoRecommendation(): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
  }

  try {
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // 로또 당첨 번호 데이터 가져오기
    const lottoData = await getLottoWinningNumbers();
    const lottoHistoryArray = convertToNumberArray(lottoData);
    const lottoHistoryData = JSON.stringify(lottoHistoryArray);

    // 계산 프롬프트 로드
    const { calculatePrompt } = loadPromptConfig();

    // 최종 프롬프트 생성
    const prompt = LOTTO_GENERATION_PROMPT.replace(
      '{LOTTO_HISTORY_DATA}',
      lottoHistoryData,
    ).replace('{CALCULATE_PROMPT}', calculatePrompt);

    const completion = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        {
          role: 'system',
          content: LOTTO_SYSTEM_PROMPT,
        },
        { role: 'user', content: prompt },
      ],
      //   temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content;
    if (!responseText) {
      throw new Error('OpenAI에서 응답을 받지 못했습니다.');
    }

    // JSON 추출 (문자열에서 2차 배열 부분만 추출)
    const jsonMatch = responseText.match(/\[\s*\[.*\]\s*\]/s);
    if (!jsonMatch) {
      throw new Error('응답에서 JSON 형식을 찾을 수 없습니다.');
    }

    // JSON 파싱
    const recommendations = JSON.parse(jsonMatch[0]) as number[][];

    // 유효성 검사
    validateLottoRecommendations(recommendations);

    return recommendations;
  } catch (error) {
    console.error('OpenAI API 오류:', error);
    throw new Error(
      `OpenAI API 오류: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * 로또 번호 추천 결과의 유효성 검사
 */
function validateLottoRecommendations(recommendations: number[][]): void {
  if (!Array.isArray(recommendations) || recommendations.length !== 5) {
    throw new Error('추천 결과는 5개의 배열이어야 합니다.');
  }

  for (const set of recommendations) {
    if (!Array.isArray(set) || set.length !== 6) {
      throw new Error('각 추천 세트는 6개의 숫자로 구성되어야 합니다.');
    }

    // 각 숫자가 1-45 범위 내에 있는지 확인
    for (const num of set) {
      if (typeof num !== 'number' || num < 1 || num > 45) {
        throw new Error('로또 번호는 1에서 45 사이의 정수여야 합니다.');
      }
    }

    // 중복된 숫자가 없는지 확인
    const uniqueNumbers = new Set(set);
    if (uniqueNumbers.size !== 6) {
      throw new Error('각 로또 세트 내에 중복된 숫자가 있습니다.');
    }
  }
}

/**
 * 선택한 AI 서비스를 통해 로또 번호 추천 받기
 */
export async function getLottoRecommendation(
  options: IAIOptions = { provider: 'google' },
): Promise<ILottoRecommendation> {
  let recommendations: number[][];

  // 선택한 제공자에 따라 다른 AI 서비스 사용
  if (options.provider === 'google') {
    recommendations = await getGeminiLottoRecommendation();
  } else {
    recommendations = await getOpenAILottoRecommendation();
  }

  console.log(
    'AI 로또 번호 추천 결과:',
    JSON.stringify(recommendations, null, 2),
  );

  return { recommendations };
}

// 테스트 호출 (필요 시 주석 해제)
// async function test() {
//   try {
//     // Google Gemini 사용
//     await getLottoRecommendation({ provider: 'google' });
//
//     // OpenAI 사용
//     await getLottoRecommendation({ provider: 'openai' });
//   } catch (error) {
//     console.error('테스트 오류:', error);
//   }
// }
// test();
