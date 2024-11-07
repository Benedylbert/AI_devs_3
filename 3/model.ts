export interface TestData {
    question: string;
    answer: number;
    test?: {
      q: string;
      a: string | null;
    };
  }
  
export interface SecretFile {
    apikey: string;
    description: string;
    copyright: string;
    "test-data": TestData[];
  }
  
export interface AnswerFile {
    task: string;
    apikey: string;
    answer: SecretFile;
  }
  