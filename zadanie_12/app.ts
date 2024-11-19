import { join } from 'path';
import { OpenAIService } from "./OpenAIService";
import { TextSplitter } from "./TextService";
import { VectorService } from './VectorService';
import type { ChatCompletion, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { readdirSync, statSync } from 'fs';
import type OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
const BASE_PATH = join(__dirname, 'do-not-share');
//const query = 'skradziony prototyp broni';

const query = 'reutrn text which is about stolen weapon prototype';

//const COLLECTION_NAME = "devs";

const COLLECTION_NAME = "devs_que";

const openai = new OpenAIService();
const vectorService = new VectorService(openai);
const textSplitter = new TextSplitter();

function createSystemPromptAudio(text: string,): ChatCompletionMessageParam {
  return {
    role: "system",
    content: `
       Return keyworlds from given text inside <file> section. focus on descriptions of events, things, places, people. Retun around 20 keywords.

       <file>
        ${text}
       </file>

       Return only keywords in Polish language, nothing else more, separated by comma.
      `
  }
};

async function checkResponseAndAddToArrays(text: string) {
  const config = {
    messages: [] as ChatCompletionMessageParam[],
    model: "gpt-4o-mini"
  }
  

  config.messages = [createSystemPromptAudio(text)];
  const reponse = await openai.completionBasicPrompt(config) as OpenAI.Chat.Completions.ChatCompletion;
  return reponse.choices[0].message.content;
}

async function initializeData() {
  const raportsFolder = readdirSync(BASE_PATH);
    const raports = await Promise.all(raportsFolder.map(async (file) => {
        const filePath = path.join(BASE_PATH, file);
        const stats = statSync(filePath);
        
        if (stats.isFile()) {
            const fileName = filePath.split('\\').pop()?.replace('.txt', '') || '';
            const fileContent = await fs.readFile(filePath, 'utf-8');
          //  const keywords = await checkResponseAndAddToArrays(fileContent);
           // const doc = await textSplitter.document(fileContent, fileName.replace('.txt', '').replaceAll('_', '.'), keywords, 'gpt-4o');
            //console.log(doc);
            const doc = await textSplitter.document(fileContent, 'gpt-4o', { fileName });
            return doc;
        }
        return '';
    }));

    //console.log(raports);

    await vectorService.initializeCollectionWithData(COLLECTION_NAME, raports);
}

async function main() {
    await initializeData();
    console.log('initializeData finished');

  //   const determineKeywords = await openai.completion({
  //       messages: [
  //           { role: 'system', content: `return information about 'skradziony prototyp broni'` }
  //       ]
  //   }) as ChatCompletion;

  //   //console.log('response: ' + determineKeywords.choices[0].message.content);

  //   const keywords = determineKeywords.choices[0].message.content?.split(',').map(a => a.trim()) || [];

  //  console.log(keywords);
  //  const keyWorldsMap = keywords.map(keyworld => ({
  //   key: "keywords",
  //   match: {
  //     value: keyworld
  //   }
  //   }));

  //   console.log(keyWorldsMap);

  //   const filter = keywords.length > 0 ? {
  //     should: keyWorldsMap
  //   } : undefined;

  //   console.log(filter);

     const searchResults = await vectorService.performSearch(COLLECTION_NAME, query, {}, 15);
    //console.log(searchResults);

    const relevanceChecks = await Promise.all(searchResults.map(async (result) => {
        const relevanceCheck = await openai.completion({
            messages: [
                { role: 'system', content: `You are a helpful assistant that determines 
                  if given text is about stolen weapon prototype. If yes, return "true", otherwise return "false".` },
                { role: 'user', content: `Query: ${query}\nText: ${result.payload?.text}` }
            ]
        }) as ChatCompletion;
        //console.log(relevanceCheck.choices[0].message.content);
        const isRelevant = relevanceCheck.choices[0].message.content?.includes('true');
        //console.log(isRelevant);
        return { ...result, isRelevant };
    }));

    const relevantResults = relevanceChecks.filter(result => result.isRelevant);

    console.log(`Query: ${query}`);
    
    for (const result of relevantResults) {
      const finalResponse = {
        apikey: 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
        task: 'wektory',
        answer: (result.payload?.fileName as string)?.replaceAll('_','-')
      }
      try {
        const finalrequest = await axios.post('https://centrala.ag3nts.org/report', finalResponse, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
       console.log('Response:', finalrequest.data);
       
      } catch (error) {
        console.error('Error sending request to centrala:');
        //console.log(error);
      }
      console.log(finalResponse);
    }
}

main().catch(console.error);