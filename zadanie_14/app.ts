import { join } from "path";
import fs from 'fs/promises';
import { OpenAIService } from "./OpenAIService";
import type { ChatCompletion, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import axios from 'axios';
import { createInterface } from 'readline';

const openAIService = new OpenAIService();

const badResponses = [];

const usedNames: string[] = [];
const usedCities: string[] = [];

let counter = 0;

let basciBarbaraInformations = '';

// Add readline interface
const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    readline.question(query, (answer) => {
      resolve(answer);
    });
  });
}

function removeDiacritics(str: string): string {
  return str.normalize('NFD')
    .replace(/[\u0142]/g, 'l')  // special case for ł/Ł
    .replace(/[\u0141]/g, 'L')
    .replace(/[\u0105]/g, 'a')  // ą
    .replace(/[\u0104]/g, 'A')
    .replace(/[\u0119]/g, 'e')  // ę
    .replace(/[\u0118]/g, 'E')
    .replace(/[\u00F3]/g, 'o')  // ó
    .replace(/[\u00D3]/g, 'O')
    .replace(/[\u015B]/g, 's')  // ś
    .replace(/[\u015A]/g, 'S')
    .replace(/[\u017C\u017A]/g, 'z')  // ż/ź
    .replace(/[\u017B\u0179]/g, 'Z')
    .replace(/[\u0107]/g, 'c')  // ć
    .replace(/[\u0106]/g, 'C')
    .replace(/[\u0144]/g, 'n')  // ń
    .replace(/[\u0143]/g, 'N')
    .replace(/[^\x00-\x7F]/g, ''); // remove any remaining non-ASCII characters
}

async function sendVerificationRequest(): Promise<void> {

  try {
   // const userInput = await askQuestion('Enter your query: ');

    //console.log(userInput);
    
    const basicInformations = await axios.get('https://centrala.ag3nts.org/dane/barbara.txt', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    basciBarbaraInformations = basicInformations.data

    const basicReponse = await openAIService.completion([
      createSystemBasicPrompt(basciBarbaraInformations)
   ], "gpt-4o") as ChatCompletion;

    const basicCleanedResponse = JSON.parse(basicReponse.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```/g, '')
    .trim());

    const names = basicCleanedResponse.names.split(',').map(name => name.trim());
    const cities = basicCleanedResponse.cities.split(',').map(city => city.trim());

    console.log(names);
    console.log(cities);


    console.log('######### SPRWDZAMY MIEJSCOWOSCI');
    for (const city of cities) {
      await doRequestIf(city, 'places');
    }


    console.log('######### SPRWDZAMY LUDZI');

    for (const name of names) {
      await doRequestIf(name, 'peoples');
    }

    loopOverCities(usedCities);
    
    readline.close();
  } catch (error) {
    console.error('Error sending verification request:', error);
    readline.close();
  }
}

async function doRequestIf(value: string, type: string) {
  console.log('SPRWDZAMY: ' + value + ' ' + type);

  if (type === 'peoples') {
    console.log('RESULT: ' + usedNames.includes(value));
    console.log('usedNames: ' + usedNames);
    if (usedNames.includes(value)) {
      console.log('JEST UZYTE: ' + value);
      return;
    }else {
      usedNames.push(value);
      await askForData(value, type);
    }
    
  } 

  if (type === 'places') {
    console.log('RESULT: ' + usedCities.includes(value));
    
    if (usedCities.includes(value)) {
      console.log('JEST UZYTE: ' + value);
      return;
    } else {
      usedCities.push(value);
      await askForData(value, type);
    }
    
  } 

}


async function askForData(value: string, type: string): Promise<void> {

  counter++;
  if (counter > 30) {
    console.log('Counter is greater than 30, will exit');
    process.exit(0);
  }

  const askBody = {
    "apikey": "e2581c1b-8fee-49d3-b7af-42533c7045ca",
    "query": removeDiacritics(value)
  }
  try {

    console.log('PYTANIEEEE request is to ask about: ' + value + ' ' + type);

    const basicInformations = await axios.post('https://centrala.ag3nts.org/' + type, askBody, {
    headers: {
      'Content-Type': 'application/json'
      }
    });
    const odpowiedzCentrali = basicInformations.data.message;
    console.log('ODZPOWIEDZ CENTRALI na pytanie response from centrala: ' + odpowiedzCentrali);
    //console.log(odpowiedzCentrali.toLowerCase());

    if (basicInformations.data.message.toLowerCase().includes('restricted') || basicInformations.data.message.toLowerCase().includes('centrala')) {
      addUsedValue(value, type);
      console.log('DODAJEMY DO UZYTEGO i jest złe: ' + value);
      return;
    } else {
    }
     
    const values = basicInformations.data.message.split(' ').map(value => value.trim());

    if (type === 'peoples') {
      for (const value of values) {
        await doRequestIf(value,'places');
      }
    } else if (type === 'places') {
      for (const value of values) {
      await doRequestIf(value,'peoples');
      }
    }
    

  } catch (error) {
    console.log('błąd w pytaniu');
    console.log(error.response?.data);
    addUsedValue(value, type);
  }
}

function addUsedValue(value: string, type: string): void {
  if (type === 'peoples') {
    usedNames.push(value);
  } else if (type === 'places') {
    usedCities.push(value);
  }
}

async function loopOverCities(cities: string[]): Promise<void> {
  for (const city of cities) {
    await responseToCentrala(city);
  }
}

function createSystemBasicPrompt(text: string): ChatCompletionMessageParam {
    return { 
      role: "system", 
      content: `
      Below you have basic informations about Barbara. We need to find in which city she is now. Analyze text from <text> and return polish names, without surnames and cities, separated by comma.
      All names and cities need to be in capital letters withour polish letters and in denominator form. 
      Examples for cities:
      - KRAKOW change to KRAKÓW
      - WROCŁAIA change to WROClAW
      - GDAŃSKA change to GDANSK
      Examples for names:
      - barbary change to BARBARA
      - rafała change to RAFAL
      - jackowi change to JACEK

      <text>
        ${text}
      </question>

      Response return in json format, with keys: names and cities. example: {"names": "BARBARA, RAFAL, JACEK", "cities": "KRAKÓW, WROClAW, GDANSK"}.
      ` 
    
    };
  };

  function createSystemPrompt(text: string): ChatCompletionMessageParam {
    return { 
      role: "system", 
      content: `
      Below you have basic informations about Barbara. We need to find in which city she is now. Analyze text from <text> and return polish names, without surnames and cities, separated by comma.
      All names and cities need to be in capital letters withour polish letters and in denominator form. 
      Examples for cities:
      - KRAKOW change to KRAKÓW
      - WROCŁAIA change to WROClAW
      - GDAŃSKA change to GDANSK
      Examples for names:
      - barbary change to BARBARA
      - rafała change to RAFAL
      - jackowi change to JACEK

      <text>
        ${text}
      </question>

      Response return in json format, with keys: names and cities. example: {"names": "BARBARA, RAFAL, JACEK", "cities": "KRAKÓW, WROClAW, GDANSK"}.
      ` 
    
    };
  };

  async function responseToCentrala(responseCity: string): Promise<void> {
    if (badResponses.includes(responseCity)) {
      return;
    }
    counter++;
    if (counter > 30) {
      console.log('Counter is greater than 30, will exit');
      process.exit(0);
    }
    console.log('ODZPOWIEDZ CENTRALI response to centralaa out: ' + responseCity);

    const responseCentrala = {
      "apikey": "e2581c1b-8fee-49d3-b7af-42533c7045ca",
      "task": "loop",
      "answer": responseCity
    }

    try {
      const finalrequest = await axios.post('https://centrala.ag3nts.org/report ', responseCentrala, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
  
       console.log('Response:', finalrequest.data);
       process.exit(0);
    } catch (error) {
      console.log('lipa w odpowiedzi');
      console.log(error.response?.data);
      badResponses.push(responseCity);
    }
  }

// Execute the function
sendVerificationRequest();