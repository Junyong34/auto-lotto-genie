import { getLottoRecommendation } from '../ai';

async function testLottoAI() {
  console.log('===== AI 로또 번호 추천 테스트 시작 =====');

  try {
    console.log('\n----- Google Gemini AI 사용 -----');
    const geminiResult = await getLottoRecommendation({ provider: 'google' });
    console.log('Gemini 추천 결과:', geminiResult.recommendations);

    console.log('\n----- OpenAI 사용 -----');
    // const openaiResult = await getLottoRecommendation({ provider: 'openai' });
    // console.log('OpenAI 추천 결과:', openaiResult.recommendations);

    console.log('\n===== 테스트 완료 =====');
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  }
}

// 테스트 실행
testLottoAI();
