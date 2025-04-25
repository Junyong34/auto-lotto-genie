import { Page } from 'playwright';

// 각 단계를 별도 함수로 분리하기 위한 인터페이스
export interface IStep {
  name: string;
  execute: (page: Page, data?: any) => Promise<any>;
  skip?: boolean; // 단계 건너뛰기 여부
}

// 슬랙 메시지 인터페이스
export interface ISlackMessage {
  text: string;
}

// 로또 구매 설정 인터페이스
export interface ILottoConfig {
  USER_ID: string;
  USER_PW: string;
  COUNT: number;
  SLACK_API_URL: string;
  TELEGRAM_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}
