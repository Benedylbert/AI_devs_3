import { OpenAIService } from './OpenAIService';
import fs from 'fs/promises'; // Add this import at the top
import type { ChatCompletion, ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type OpenAI from 'openai';
import axios from 'axios';
import { readFileSync } from "fs";
import { readdirSync, statSync } from 'fs'; // Add this import
import { join } from "path";
import sharp from "sharp";
const OPTIMIZED_IMAGE_PATH = join(__dirname, 'lessons_optimized.png');
const COMPRESSION_LEVEL = 5;
import type { ResizedImageMetadata } from "./app.dt.ts";
const openaiService = new OpenAIService();
import path from 'path';

const BASE_PATH = join(__dirname, 'pliki_z_fabryki');
const FACTS_PATH = join(BASE_PATH, 'facts');
const rynekFile = join(BASE_PATH, '2024-11-12_report-00-sektor_C4.txt');
const rynekGlitchFile = join(BASE_PATH, '2024-11-12_report-01-sektor_A1.txt');
const aktykulFile = join(BASE_PATH, 'tekst.txt');
const resztkiFile = join(BASE_PATH, 'resztki.webp');
const strangeFruitFile = join(BASE_PATH, 'strangefruit.webp');
const fruit02File = join(BASE_PATH, 'fruit02.webp');
const fruit01File = join(BASE_PATH, 'fruit01.webp');
const rafalDyktafon = join(BASE_PATH, 'rafal_dyktafon.mp3');
let pliki = { } as Record<string, string>;


checkFiles();


async function checkFiles() {
  const folderPath = path.join(__dirname, 'pliki_z_fabryki');

  try {

    const responseCentralaNagrania = await axios.get('https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/phone_sorted.json', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/phone_sorted.json
    // https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/phone.json

    const zagraniaData = JSON.stringify(responseCentralaNagrania.data);
    //console.log(zagraniaData);

    const responseCentralaQuestions = await axios.get('https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/phone_questions.json', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const questionsData = JSON.stringify(responseCentralaQuestions.data);

   // console.log(questionsData);
  
    const facts = readdirSync(FACTS_PATH);
    //console.log('FACTS_PATH: ' + FACTS_PATH);
    let factsValues : string[];
    let counter = 0;

    const factStrings = await Promise.all(facts.map(async (file) => {
        const filePath = path.join(FACTS_PATH, file);
        const stats = statSync(filePath);
        
        if (stats.isFile()) {
            const factHeader = '||';
            const fileContent = await fs.readFile(filePath, 'utf-8');
            return `${factHeader}${fileContent}`;
        }
        return '';
    }));

    factsValues = factStrings.join('').split('||');

    //console.log('factsValues: ' + factsValues);
    const answerForQuestions = await checkResponseAndAddToArrays(zagraniaData, questionsData, factsValues);
    console.log(answerForQuestions);

    const finalResponse = {
      apikey: 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
      task: 'phone',
      answer: JSON.parse(answerForQuestions.replace(/'/g, '"')  // Replace single quotes with double quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/```json\n?/g, '')
      .replace(/```/g, '')
      .trim())
    }
  
    //console.log(JSON.parse(answerForQuestions));
  
    try {
      const finalrequest = await axios.post('https://centrala.ag3nts.org/report', finalResponse, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
     console.log('Response:', finalrequest.data);
     
    } catch (error) {
      console.error('Error sending request to centrala:');
      console.log(error.response.data);
    }
    //console.log(answerForQuestions);

  } catch (error) {
    console.error('Error reading directory:', error); //{{FLG:MYKINGDOM}} {{FLG:COORDINATES}}
  }
}

function createSystemPromptAudio(nagrania: string, facts: string, questionsData: string): ChatCompletionMessageParam {
  return {
    role: "system",
    content: `

    <conversations> include phone conversations. Answer for question from <questions> based on <conversations>. Questiona are in json obiekt, each question has id. For example"
    {
        "01":"question 01",
        "02":"question 02",
        "03":"question 03",
        "04":"question 04",
        "05":"question 05",
        "06":"question 06",
      }
    
    Helpful to answer can be also <facts> section to find which person is a liar. Becuase one of them is a liar. IF you will find liar, ignore informations from this person and remember who it was.
    Each conversation is between two people, always. they talk alternately.
       
      <facts>
        ${facts}
      <facts>

      Conversation are in json format. example:
      { "rozmowa1":[
       - statement person 1
       - statement  person 2
       - statement person 1
       - statement person 2
       ],
        "rozmowa2":[
       - statement person A
       - statement  person B
       - statement person A
       - statement person B
       ]
      }
      
      <conversations>
        ${nagrania}
      </conversations>

      <questions>
        ${questionsData}
      </questions>

      <big_thinking>
        before answer think about <conversations>, answer for question using information from <conversations>. <facts> can be helpful to find which person is a liar.
         IF you will find liar, ignore informations from this person and remember who it was.
      <big_thinking>

      Return answer in json format. ID of question is in <questions> section. Example:
      {
        "01":"answer for question 01",
        "02":"answer for question 02",
        "03":"answer for question 03",
        "04":"answer for question 04",
        "05":"answer for question 05",
        "06":"answer for question 06",
      }

      Answer should be in short form. Answwer for all questions! Samuel is a liar.
      `
  }
};

async function checkResponseAndAddToArrays(zagraniaData: string, questionsData: string, facts: string) {
  const config = {
    messages: [] as ChatCompletionMessageParam[],
    model: "gpt-4o"
  }
  
  config.messages = [createSystemPromptAudio(zagraniaData, facts, questionsData)];

  //console.log(config.messages);
  const reponse = await openaiService.completion(config) as OpenAI.Chat.Completions.ChatCompletion;
  const responseText = reponse.choices[0].message.content ?? '{}';
  return responseText;
}