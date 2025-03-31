/**
 * 로또 번호 생성 관련 프롬프트 구성 파일
 */

// 기본 로또 번호 생성 프롬프트
export const LOTTO_GENERATION_PROMPT = `
다음은 과거 로또 당첨 번호 데이터입니다:
{LOTTO_HISTORY_DATA}

{CALCULATE_PROMPT}

위 데이터와 확률 계산 공식을 기반으로 로또 5개 번호추천해줘. 각 로또 번호는 1-45 사이의 6개 숫자로 구성되어 있으며 중복되지 않아야 합니다.
응답은 [[1회차 번호 6개], ... [5회차 번호 6개]] 형식의 JSON으로만 제공해주세요. 다른 설명은 필요 없습니다.`;

// 시스템 프롬프트 (OpenAI용)
export const LOTTO_SYSTEM_PROMPT =
  '당신은 로또 번호를 추천해주는 AI 도우미입니다. 정확한 JSON 형식으로만 응답해주세요.';
