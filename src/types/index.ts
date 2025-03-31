// 로또 당첨 번호 인터페이스 정의
export interface ILottoNumbers {
  [key: string]: string[];
}

// AI 서비스 옵션 인터페이스
export interface IAIOptions {
  provider: 'google' | 'openai';
}

// 로또 번호 추천 결과 인터페이스
export interface ILottoRecommendation {
  recommendations: number[][];
}

// 프롬프트 설정 인터페이스
export interface IPromptConfig {
  calculatePrompt: string;
}
