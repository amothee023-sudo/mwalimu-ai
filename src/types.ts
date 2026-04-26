export type Mode = 'normal' | 'simplify' | 'example';

export interface ExplanationResponse {
  text: string;
  audio?: string; // base64
  quiz?: QuizQuestion[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}
