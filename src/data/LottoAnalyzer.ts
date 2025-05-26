// 로또 번호 분석 및 추천 시스템 (TypeScript)

interface LottoAnalysis {
  frequency: Map<number, number>;
  weightedScores: Map<number, number>;
  finalScores: Map<number, number>;
}

interface LottoCombination {
  numbers: number[];
  score: number;
}

export default class LottoAnalyzer {
  private data: number[][];

  constructor(data: number[][]) {
    this.data = data;
  }

  // 1. 출현 빈도 분석 + 이동 평균 조합
  private calculateFrequency(): Map<number, number> {
    const frequency = new Map<number, number>();

    // 메인 번호만 사용 (보너스 번호 제외)
    for (const draw of this.data) {
      for (const num of draw.slice(0, 6)) {
        frequency.set(num, (frequency.get(num) || 0) + 1);
      }
    }

    return frequency;
  }

  // 2. 가중 빈도 계산 (전체 출현율 × 0.3 + 최근 50회 출현율 × 0.7)
  private calculateWeightedScores(): Map<number, number> {
    const totalFreq = this.calculateFrequency();
    const recentFreq = new Map<number, number>();

    // 최근 50회 데이터
    const recentData = this.data.slice(0, Math.min(50, this.data.length));
    for (const draw of recentData) {
      for (const num of draw.slice(0, 6)) {
        recentFreq.set(num, (recentFreq.get(num) || 0) + 1);
      }
    }

    const weightedScores = new Map<number, number>();
    for (let num = 1; num <= 45; num++) {
      const totalRate = (totalFreq.get(num) || 0) / this.data.length;
      const recentRate = (recentFreq.get(num) || 0) / recentData.length;
      weightedScores.set(num, totalRate * 0.3 + recentRate * 0.7);
    }

    return weightedScores;
  }

  // 3. 핫/콜드 넘버 가중치 시스템
  private calculateFinalScores(): Map<number, number> {
    const weightedScores = this.calculateWeightedScores();
    const lastAppearance = new Map<number, number>();

    // 마지막 출현 회차 계산
    for (let i = 0; i < this.data.length; i++) {
      for (const num of this.data[i].slice(0, 6)) {
        if (!lastAppearance.has(num)) {
          lastAppearance.set(num, i);
        }
      }
    }

    const finalScores = new Map<number, number>();
    for (let num = 1; num <= 45; num++) {
      const freqScore = (weightedScores.get(num) || 0) * 50;
      const gapScore =
        ((lastAppearance.get(num) || this.data.length) / this.data.length) * 30;
      const patternScore = 20; // 기본 패턴 점수

      finalScores.set(num, freqScore + gapScore + patternScore);
    }

    return finalScores;
  }

  // 4. 번호 간격 분석 (Gap Analysis)
  private calculateGapScore(combination: number[]): number {
    if (combination.length !== 6) return 0;

    const sorted = [...combination].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 0; i < 5; i++) {
      gaps.push(sorted[i + 1] - sorted[i]);
    }

    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const idealGap = 7.5; // 45 / 6 ≈ 7.5

    // 이상적 간격과의 편차가 작을수록 높은 점수
    return Math.max(0, 20 - Math.abs(avgGap - idealGap));
  }

  // 5. 짝수/홀수 & 구간별 밸런스 분석
  private calculateBalanceScore(combination: number[]): number {
    if (combination.length !== 6) return 0;

    let score = 0;

    // 짝수/홀수 밸런스
    const evenCount = combination.filter((num) => num % 2 === 0).length;
    const oddCount = 6 - evenCount;

    if (evenCount >= 2 && evenCount <= 4) {
      score += 20;
    }

    // 구간별 밸런스
    const lowCount = combination.filter((num) => num >= 1 && num <= 15).length;
    const midCount = combination.filter((num) => num >= 16 && num <= 30).length;
    const highCount = combination.filter(
      (num) => num >= 31 && num <= 45,
    ).length;

    if (lowCount >= 1 && midCount >= 1 && highCount >= 1) {
      score += 20;
    }

    return score;
  }

  // 6. 연속 번호 패턴 분석
  private calculateConsecutiveScore(combination: number[]): number {
    const sorted = [...combination].sort((a, b) => a - b);
    let consecutiveCount = 0;

    for (let i = 0; i < 5; i++) {
      if (sorted[i + 1] - sorted[i] === 1) {
        consecutiveCount++;
      }
    }

    // 연속 번호가 너무 많으면 감점
    return consecutiveCount <= 2 ? 10 : 0;
  }

  // 가중 확률 기반 번호 선택
  private weightedRandomSelection(
    scores: Map<number, number>,
    excludeNumbers: Set<number>,
  ): number {
    const availableNumbers = [];
    const weights = [];

    for (let num = 1; num <= 45; num++) {
      if (!excludeNumbers.has(num)) {
        availableNumbers.push(num);
        weights.push(scores.get(num) || 0);
      }
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0)
      return availableNumbers[
        Math.floor(Math.random() * availableNumbers.length)
      ];

    const random = Math.random() * totalWeight;
    let sum = 0;

    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random <= sum) {
        return availableNumbers[i];
      }
    }

    return availableNumbers[availableNumbers.length - 1];
  }

  // 밸런스를 고려한 조합 생성
  private generateBalancedCombination(
    scores: Map<number, number>,
    excludeNumbers: Set<number> = new Set(),
  ): number[] {
    const selected = [];
    const used = new Set(excludeNumbers);

    for (let i = 0; i < 6; i++) {
      const num = this.weightedRandomSelection(scores, used);
      selected.push(num);
      used.add(num);
    }

    return selected.sort((a, b) => a - b);
  }

  // 조합의 종합 점수 계산
  private calculateTotalScore(
    combination: number[],
    scores: Map<number, number>,
  ): number {
    const scoreSum = combination.reduce(
      (sum, num) => sum + (scores.get(num) || 0),
      0,
    );
    const gapScore = this.calculateGapScore(combination);
    const balanceScore = this.calculateBalanceScore(combination);
    const consecutiveScore = this.calculateConsecutiveScore(combination);

    return scoreSum / 10 + gapScore + balanceScore + consecutiveScore;
  }

  // 메인 분석 및 추천 함수
  public analyze(): LottoAnalysis {
    const frequency = this.calculateFrequency();
    const weightedScores = this.calculateWeightedScores();
    const finalScores = this.calculateFinalScores();

    return { frequency, weightedScores, finalScores };
  }

  // 5개 조합 추천
  public recommendCombinations(): LottoCombination[] {
    const { finalScores } = this.analyze();
    const combinations: LottoCombination[] = [];
    const usedNumbers = new Set<number>();

    for (let i = 0; i < 5; i++) {
      let bestCombination: number[] = [];
      let bestScore = -1;

      // 100번 시도하여 최적 조합 찾기
      for (let attempt = 0; attempt < 100; attempt++) {
        const candidate = this.generateBalancedCombination(
          finalScores,
          usedNumbers,
        );
        const score = this.calculateTotalScore(candidate, finalScores);

        if (score > bestScore) {
          bestScore = score;
          bestCombination = candidate;
        }
      }

      combinations.push({ numbers: bestCombination, score: bestScore });

      // 다음 조합을 위해 일부 번호 제외 (다양성 확보)
      bestCombination.slice(0, 2).forEach((num) => usedNumbers.add(num));
    }

    return combinations;
  }

  // 분석 결과 출력
  public printAnalysis(): void {
    const { frequency, finalScores } = this.analyze();

    console.log('=== 로또 번호 분석 결과 ===');

    // 상위 출현 빈도 번호
    console.log('\n상위 출현 빈도 번호:');
    const topFrequent = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    topFrequent.forEach(([num, count]) => {
      console.log(`번호 ${num}: ${count}회 출현`);
    });

    // 상위 종합 스코어 번호
    console.log('\n상위 종합 스코어 번호:');
    const topScores = Array.from(finalScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    topScores.forEach(([num, score]) => {
      console.log(`번호 ${num}: ${score.toFixed(2)}점`);
    });
  }

  // 추천 조합 출력
  public printRecommendations() {
    const combinations = this.recommendCombinations();

    console.log('\n=== 추천 로또 번호 5개 조합 ===');
    combinations.forEach((combo, index) => {
      console.log(
        `${index + 1}회차: [${combo.numbers.join(
          ', ',
        )}] (점수: ${combo.score.toFixed(2)})`,
      );
    });

    console.log('\n최종 추천 결과:');
    const result = combinations.map((combo) => combo.numbers);
    console.log(JSON.stringify(result));
    return result;
  }
}

// // 실행
// const analyzer = new LottoAnalyzer(lottoData);

// // 분석 결과 출력
// analyzer.printAnalysis();

// // 추천 조합 출력
// analyzer.printRecommendations();

// // 최종 결과만 반환
// const finalRecommendations = analyzer
//   .recommendCombinations()
//   .map((combo) => combo.numbers);
// console.log('\n=== 최종 추천 번호 ===');
// console.log(finalRecommendations);
