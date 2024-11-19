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




function createSystemPrompt(informations: {
  aktykulFileText: string;
  questions: string;
  transcriptionAudio: string;
  rynekOpis: string;
  rynekGlitchOpis: string;
  fruit01FileOpis: string;
  fruit02FileOpis: string;
  strangeFruitFileOpis: string;
  resztkiFileOpis: string;
}): ChatCompletionMessageParam[] {
    return [{
      role: "system",
      content: `
        Below is article created by 'Andrzej Maj' about time traveling and new LLM model. Article is provided in <article> section , in html code. Every <h2> is a new section of the article
        In this article are 7 references. Each reference is marked with special tag for example: #REFERENCE_RYNEK_1 or #REFERENCE_FRUIT_2. This references are deccribed in <references> section.

        Include information from each reference from <references> section to the article, there where reference is mentioned it's important, because the context of this reference is very important.

        <references>

        #REFERENCE_RYNEK_1=${informations.rynekOpis} + ' Photo was taken by author of this article.'

        #REFERENCE_RYNEK_2=${informations.rynekGlitchOpis} + ' Photo was taken by author of this article.'

        #REFERENCE_FRUIT_1=${informations.fruit01FileOpis}    

        #REFERENCE_FRUIT_2=${informations.fruit02FileOpis} 
          
        #REFERENCE_FRUIT_3=${informations.strangeFruitFileOpis}   
                
        #REFERENCE_RESZTKI_3=${informations.resztkiFileOpis}      

        #REFERENCE_AUDIO_1=${informations.transcriptionAudio}

        </references>

        <article>
          ${informations.aktykulFileText}
        </article>
        

        <objectives>
           From user you will receive few questions. Based on the informations from <article> and included <references>, asnwer for userquestions.
           Every question will have self id. Structure is like this:
           o1=question_1?
           o2=question_2?
           o3=question_3?
           o4=question_4?
           o5=question_5?

        </objectives>

        As answer for ALL questions (in Polish language) return ONLY json object. Structure is like this:
        {
          01: answer_1,
          02: answer_2,
          03: answer_3,
          04: answer_4,
          05: answer_5
        }

        <thinking>
          Adress of the author of this article which is on top of the article can be helpful to answer on questions about images.
        </thinking>

        Do not include any other text in your response. Each answer must be short in one sentence. In Polish language.  
        `
    }, {
      role: "user",
      content: `${informations.questions}`
    }]
};


async function processImage(imageUrl: string): Promise<{ imageBase64: string; metadata: ResizedImageMetadata }> {
  try {
      const imageBuffer = readFileSync(imageUrl);
      const resizedImageBuffer = await sharp(imageBuffer)
          .resize(2048, 2048, { fit: 'inside' })
          .png({ compressionLevel: COMPRESSION_LEVEL })
          .toBuffer();

      await sharp(resizedImageBuffer).toFile(OPTIMIZED_IMAGE_PATH);

      const imageBase64 = resizedImageBuffer.toString('base64');
      const metadata = await sharp(resizedImageBuffer).metadata();

      if (!metadata.width || !metadata.height) {
          throw new Error("Unable to retrieve image dimensions.");
      }

      return { imageBase64, metadata: { width: metadata.width, height: metadata.height } };
  } catch (error) {
      console.error("Image processing failed:", error);
      throw error;
  }
}


async function transformFiles() {
  try {
    const responseCentrala = await axios.get('https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/arxiv.txt', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Use Promise.all to wait for all async operations to complete
    const [
      questions,
      aktykulFileText,
      transcriptionAudio,
      rynekGlitchOpis,
      rynekOpis,
      strangeFruitFileOpis,
      fruit01FileOpis,
      fruit02FileOpis,
      resztkiFileOpis
    ] = await Promise.all([
      responseCentrala,
      fs.readFile(aktykulFile, 'utf-8'),
      openaiService.transcribeGroq(await fs.readFile(rafalDyktafon)),
      transcribePhotoPlace(rynekGlitchFile, 'Uszkodzenia widoczne w odtworzonym pliku graficznym'),
      transcribePhotoPlace(rynekFile, 'Orygionalne zdjęcie. Widok na kościół od strony zrobione przez Andrzeja. To nie Grudziądz.'),
      transcribePhoto(strangeFruitFile, 'Fuzja kodu genetycznego dwóch transportowanych owoców'),
      transcribePhoto(fruit01File, 'Owoc przed transportem w czasie'),
      transcribePhoto(fruit02File, 'Owoc pozbawiony pestek po transporcie'),
      transcribePhoto(resztkiFile, 'Resztki jedzenia znalezione w pobliżu komory temporalnej.<br>Ciasto było jeszcze ciepłe i chrupiące')
    ]);

    const response = {
      aktykulFileText,
      transcriptionAudio,
      rynekGlitchOpis,
      rynekOpis,
      strangeFruitFileOpis,
      fruit01FileOpis,
      fruit02FileOpis,
      resztkiFileOpis,
      questions: responseCentrala.data
    };

    if (Object.values(response).some(value => !value)) {
      throw new Error('Some response values are missing or undefined');
    }

    return response;
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error; // Re-throw the error to handle it in the calling function
  }
}


async function sendRequestToCentrala() {
  const responseWithText = await transformFiles();
  if (!responseWithText) throw new Error('Failed to transform files');


  const systemPrompt = createSystemPrompt(responseWithText);


  const config = {
    messages: systemPrompt,
    model: "gpt-4o"
  }

       
  const reponse = await openaiService.completion(config) as OpenAI.Chat.Completions.ChatCompletion;

  const answerFromAPI = JSON.parse(reponse.choices[0].message.content || '{}');
 

  const finalResponse = {
    apikey: 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
    task: 'arxiv',
    answer: answerFromAPI
  }

  //console.log(reponse);

  try {
    const finalrequest = await axios.post('https://centrala.ag3nts.org/report', finalResponse, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Response:', finalrequest.data);
  } catch (error) {
    console.error('Error sending request to centrala:');
   // console.log(error);
  }

  console.log('questions:');
  console.log(responseWithText.questions);
  console.log('answer:');
  console.log(finalResponse);
  
}

async function transcribePhoto(filePath: string, description: string) {

  const photo_data = await processImage(filePath);
  
  const messages: ChatCompletionMessageParam[] = [
    {
        role: "system",
        content: "You have perfect vision and you see what exactly on the image is, you can recognize objects, things in rooms. Foot presentent on this image. Respons return in Polish language."
    },
    {
        role: "user",
        content: [
            {
                type: "image_url",
                image_url: {
                    url: `data:image/jpeg;base64,${photo_data.imageBase64}`,
                    detail: "high"
                }
            },
            {
                type: "text",
                text: `Describe what you see on the image, things, foods, place. In description you have additional information about what you see, this informations can be useful.
                <description>
                  ${description}
                </description>
                `
            },
        ]
    }
];
const chatCompletion = await openaiService.completionImage(messages, "gpt-4o", false, false, 1024) as ChatCompletion;

return chatCompletion.choices[0].message.content ?? '';
}

async function transcribePhotoPlace(filePath: string, description: string) {

  const photo_data = await processImage(filePath);
  
  const messages: ChatCompletionMessageParam[] = [
    {
        role: "system",
        content: "You have perfect vision and you can see with details what exactly is in image. Recognize buildings etc. Respons return in Polish language."
    },
    {
        role: "user",
        content: [
            {
                type: "image_url",
                image_url: {
                    url: `data:image/jpeg;base64,${photo_data.imageBase64}`,
                    detail: "high"
                }
            },
            {
                type: "text",
                text: `Describe what you see on the image. This is photo of old market square, in one of the Poland city. Describe building, how this market is looks like.
               <description>
                  ${description}
                </description>
                `
            },
        ]
    }
];
const chatCompletion = await openaiService.completionImage(messages, "gpt-4o", false, false, 1024) as ChatCompletion;

return chatCompletion.choices[0].message.content ?? '';
}

checkFiles();


async function checkFiles() {
  const folderPath = path.join(__dirname, 'pliki_z_fabryki');

  try {

  
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


    const files = readdirSync(BASE_PATH);
    
    // Use Promise.all to wait for all file processing to complete
    await Promise.all(files.map(async (file) => {
      const filePath = path.join(folderPath, file);
      const stats = statSync(filePath);
      
      if (stats.isFile()) {
        const extension = filePath.split('.').pop()   ;
        const fileName = filePath.split('\\').pop() || '';
        
        if (extension === 'txt') {
          const textFile = await fs.readFile(filePath, 'utf-8');
          await checkResponseAndAddToArrays(textFile, fileName, factsValues);
        }
      }
    }));

    const finalResponse = {
      apikey: 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
      task: 'dokumenty',
      answer: pliki
    }
  
    //console.log(finalResponse);
  
    try {
      const finalrequest = await axios.post('https://centrala.ag3nts.org/report', finalResponse, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
     console.log('Response:', finalrequest.data);
     
    } catch (error) {
      console.error('Error sending request to centrala:');
      console.log(error);
    }
    console.log(finalResponse);

  } catch (error) {
    console.error('Error reading directory:', error);
  }
}

function createSystemPromptAudio(text: string, facts: string, filename: string): ChatCompletionMessageParam {
  return {
    role: "system",
    content: `
       To received <file> generate keywords. Below in section <facts> you have facts, which can be useful to generate keywords. Can include some additional informations but not all facts.
       This file include report about situation in factory. FileName can be usefull to connect facts with file. FileName have dance inside and from which sector is report.
      <facts>
        ${facts}
      <facts>
      
      <file>
        ${text}
      </file>

      fileName: ${filename}

      <big_thinking>
        before answer think about file and facts, then generate keywords. try to connect facts with informations from file. Keywords shoudl include also about situations in factory. For example about 
        capture of a teacher. about what the described people do, what they like to do, what they are good at etc. For example if they are programming, mention which language they are use, animals, things.
        In keyworlds include also information from which sektor is report, you can find this information in fileName.
      <big_thinking>

      Do każdego pliku wygeneruj słowa kluczowe w formie mianownika. (czyli np. “sportowiec”, a nie “sportowcem”, “sportowców” itp.) Return only keywords in Polish language, nothing else more.
      Return this keywords in one line separated by comma. 
      `
  }
};

async function checkResponseAndAddToArrays(text: string, fileName: string, facts: string) {
  const config = {
    messages: [] as ChatCompletionMessageParam[],
    model: "gpt-4o-mini"
  }
  

  config.messages = [createSystemPromptAudio(text, facts, fileName)];
  const reponse = await openaiService.completion(config) as OpenAI.Chat.Completions.ChatCompletion;
  const responseText = reponse.choices[0].message.content;
  //console.log('finename: ' + fileName);
  //console.log('responseText: ' + responseText);
  pliki[fileName] = responseText ?? '';


}