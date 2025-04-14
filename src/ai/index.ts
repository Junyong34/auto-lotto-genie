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
    // const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro-exp-03-25',
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
      // organization: 'org-abc123xyz456', // 선택
      // baseURL: 'https://api.openai.com/v1', // 기본값
      // timeout: 10000, // 10초 타임아웃
      // maxRetries: 3, // 최대 3회 재시도
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

    // openai.chat.completions.create(); // GPT 모델 채팅 API
    // openai.images.generate(); // DALL·E 이미지 생성
    // openai.embeddings.create(); // 텍스트 임베딩
    // openai.files.create(); // 파일 업로드
    // openai.fineTuning.jobs.create(); // 파인튜닝
    // openai.audio.transcriptions.create(); // Whisper 음성 텍스트 변환

    const completion = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        {
          role: 'system',
          content: LOTTO_SYSTEM_PROMPT,
        },
        { role: 'user', content: prompt },
      ],
      //     messages: [...],                // 대화 내용 배열
      // temperature: 0.7,               // 창의성 조절 (0.0 ~ 2.0)
      // top_p: 1.0,                     // nucleus sampling (1.0 권장)
      // n: 1,                           // 응답 개수
      // stream: false,                 // 스트리밍 응답 사용 여부
      // stop: ['\n'],                   // 응답 중단 기준
      // max_tokens: 100,                // 응답 최대 토큰 수
      // presence_penalty: 0,           // 새로운 주제 생성 유도 (값 높을수록 참신한 응답 유도)
      // frequency_penalty: 0,          // 반복 방지 (값 높을수록 반복 억제)
      // user: 'user-id'                // 사용자 ID (로깅 및 abuse 방지용)
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
async function test() {
  try {
    // Google Gemini 사용
    // await getLottoRecommendation({ provider: 'google' });
    console.log('\n----- Google Gemini AI 사용 -----');
    const geminiResult = await getLottoRecommendation({ provider: 'google' });
    console.log('Gemini 추천 결과:', geminiResult.recommendations);

    // // OpenAI 사용
    // await getLottoRecommendation({ provider: 'openai' });
  } catch (error) {
    console.error('테스트 오류:', error);
  }
}
test();
