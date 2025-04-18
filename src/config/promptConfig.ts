import dotenv from 'dotenv';
import { IPromptConfig } from '../types';

// 환경 변수 로드
dotenv.config();

/**
 * .env 파일에서 프롬프트 설정 가져오기
 *
 * @returns 프롬프트 설정 객체
 */
export function loadPromptConfig(): IPromptConfig {
  const calculatePrompt = process.env.LOTTO_CALCULATE_PROMPT;

  if (!calculatePrompt) {
    // 기본 프롬프트 사용 (실제 프로덕션에서는 .env에 설정하는 것이 좋음)
    console.warn(
      'LOTTO_CALCULATE_PROMPT 환경 변수가 설정되지 않았습니다. 기본값을 사용합니다.',
    );
    return {
      calculatePrompt: getDefaultCalculatePrompt(),
    };
  }

  return {
    calculatePrompt,
  };
}

/**
 * 기본 계산 프롬프트 (환경 변수가 없을 경우 사용)
 */
function getDefaultCalculatePrompt(): string {
  return `
# 로또 번호 확률 계산 공식

## 1. 출현 빈도 분석 📊  
\\[
P(n) = \\frac{\\text{해당 숫자가 출현한 횟수}}{\\text{총 회차 수}}
\\]
예제: 숫자 7이 500회 중 60번 나왔다면,  
\\[
P(7) = \\frac{60}{500} = 0.12 \\quad (12\\%)
\\]

## 2. 이동 평균 (Moving Average) 적용 🔄  
\\[
MA_n = \\frac{X_1 + X_2 + ... + X_n}{n}
\\]
- \\( X \\) : 특정 번호의 출현 여부  
- \\( n \\) : 최근 분석할 회차 개수  

## 3. 짝수/홀수 & 높은 숫자/낮은 숫자 비율 분석 🔢  
- 짝수와 홀수의 비율을 조정하고,  
- 숫자를 낮은 범위(1~22)와 높은 범위(23~45)로 나누어 분석  

## 4. 기하 분포 (Geometric Distribution) 적용 🎲  
특정 번호가 오랜 기간 나오지 않았다면, 다음 회차에 나올 확률을 예측하는 공식:  
\\[
P(X = k) = (1 - p)^{k-1} p
\\]
- \\( p \\) : 특정 번호가 나올 확률  
- \\( k \\) : 번호가 다시 나올 때까지 걸린 회차  

## 5. 과거 당첨번호 로또 패턴
나는 로또가 조작이라고 생각해 어떤 패턴이 있을것 같은데
위 과거 로또 당첨 번호를 보고 너가 전문가니까 특정 패턴이나 규칙을 찾는 공식을 사용해서 번호 6개만 추천해줘 
`;
}
