import { Neo4jService } from "./Neo4jService";
import { OpenAIService } from "./OpenAIService";
import { v4 as uuidv4 } from 'uuid';
import { thinkingSystemPrompt } from "./prompts";
import type { ChatCompletion, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
  throw new Error("NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set");
}

const openAIService = new OpenAIService();
const neo4jService = new Neo4jService(
  process.env.NEO4J_URI,
  process.env.NEO4J_USER,
  process.env.NEO4J_PASSWORD,
  openAIService
);

async function getUsersData(): Promise<any[]> {
  const filePath = path.join(__dirname, 'users.txt');
  
  try {
    // Try to read from file first
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    // If file doesn't exist or can't be read, fetch from API
    const requestBody = {
      "apikey": "e2581c1b-8fee-49d3-b7af-42533c7045ca",
      "task": "database",
      "query": "select * from users"
    };

    const responseUsers = await axios.post('https://centrala.ag3nts.org/apidb', requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const usersList = responseUsers.data['reply'];
    
    // Save to file for future use
    await fs.writeFile(filePath, JSON.stringify(usersList, null, 2));
    
    return usersList;
  }
}

async function getConnectionsData(): Promise<any[]> {
  const filePath = path.join(__dirname, 'connectors.txt');
  
  try {
    // Try to read from file first
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    // If file doesn't exist or can't be read, fetch from API
    const requestBody = {
      "apikey": "e2581c1b-8fee-49d3-b7af-42533c7045ca",
      "task": "database",
      "query": "select * from connections"
    };

    const responseConnectors = await axios.post('https://centrala.ag3nts.org/apidb', requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const connectorsList = responseConnectors.data['reply'];
    
    // Save to file for future use
    await fs.writeFile(filePath, JSON.stringify(connectorsList, null, 2));
    
    return connectorsList;
  }
}

function createSystemPrompt(indexName: string, user1: string, user2: string): ChatCompletionMessageParam {
  return { 
    role: "system", 
    content: `
    Create query for neo4j graph database. In database is index ${indexName}. This index includes nodes (User) with object:
    {
            "id": [string],
            "username": [string],
            "access_level": [string],
            "is_active": [string],
            "lastlog": [string]
    } 
    where [string] can by any value.

    User nodes aby in relation with name 'CONNECT' by user id. 

    <objectives>
      Generate query for neo4j graph databse which will return the shorest path between user with username ${user1} and ${user2}.
    </objectives>


    Return only valid query.
    
    ` 
  };
};


async function main3() {
    try {
      

      const indexNAME = 'user_index'

      const config = {
        messages: [createSystemPrompt(indexNAME, 'Barbara', 'Rafał')],
        model: "gpt-4o-mini"
      }

      const basicReponse = await openAIService.completion(config) as ChatCompletion;

      const query = `MATCH (start:User {username: 'Rafał'}), (end:User {username: 'Barbara'})
      MATCH path = shortestPath((start)-[*]-(end))
      RETURN path`

     console.log(query);


      // await neo4jService.createVectorIndex(indexNAME, 'User', 'embedding', 3072);
      // await neo4jService.waitForIndexToBeOnline(indexNAME);
       console.log("Vector indexes is online and ready.");
      const usersList = await getUsersData();
      const connectionsList = await getConnectionsData();


      // for (const user of usersList) {
      //     await neo4jService.addNode('User', { ...user});
      // }


      console.log("creating connections");

      // for (const connection of connectionsList) {
      //     const u1 = await neo4jService.findNodeByProperty('User', 'id', connection.user1_id);
      //     const u2 = await neo4jService.findNodeByProperty('User', 'id', connection.user2_id);
      //     await neo4jService.connectNodes(u1.id, u2.id, 'CONNECT', {});
      // }

      console.log("Done");

      const usero = await neo4jService.findNodeByProperty('User', 'username', 'Konrad');
      console.log(usero.properties.username);

      console.log("\n1. Shortes way between Barbara and Rafał:");
      const result1 = await neo4jService.executeQuery(query);

      console.log(result1.records[0]._fields);

      console.log(result1.records[0]._fields[0].segments);

      //Rafał, Azazel, Aleksander, Barbara




     


      // Create Actor nodes
      // const actors = [
      //   { name: 'Keanu Reeves', birthYear: 1964 },
      //   { name: 'Carrie-Anne Moss', birthYear: 1967 },
      //   { name: 'Laurence Fishburne', birthYear: 1961 },
      //   { name: 'Hugo Weaving', birthYear: 1960 }
      // ];
      // for (const actor of actors) {
      //   const embedding = await openAIService.createEmbedding(actor.name);
      //   await neo4jService.addNode('Actor', { ...actor, embedding });
      // }
  
      // // Create Movie nodes
      // const movies = [
      //   { title: 'The Matrix', releaseYear: 1999 },
      //   { title: 'The Matrix Reloaded', releaseYear: 2003 },
      //   { title: 'John Wick', releaseYear: 2014 },
      //   { title: 'The Lord of the Rings: The Fellowship of the Ring', releaseYear: 2001 }
      // ];
      // for (const movie of movies) {
      //   const embedding = await openAIService.createEmbedding(movie.title);
      //   await neo4jService.addNode('Movie', { ...movie, embedding });
      // }
  
      // Create ACTED_IN relationships
    //   const actedIn = [
    //     { actor: 'Keanu Reeves', movie: 'The Matrix', character: 'Neo' },
    //     { actor: 'Carrie-Anne Moss', movie: 'The Matrix', character: 'Trinity' },
    //     { actor: 'Laurence Fishburne', movie: 'The Matrix', character: 'Morpheus' },
    //     { actor: 'Hugo Weaving', movie: 'The Matrix', character: 'Agent Smith' },
    //     { actor: 'Keanu Reeves', movie: 'The Matrix Reloaded', character: 'Neo' },
    //     { actor: 'Carrie-Anne Moss', movie: 'The Matrix Reloaded', character: 'Trinity' },
    //     { actor: 'Laurence Fishburne', movie: 'The Matrix Reloaded', character: 'Morpheus' },
    //     { actor: 'Keanu Reeves', movie: 'John Wick', character: 'John Wick' }
    //   ];
    //   for (const role of actedIn) {
    //     const actor = await neo4jService.findNodeByProperty('Actor', 'name', role.actor);
    //     const movie = await neo4jService.findNodeByProperty('Movie', 'title', role.movie);
    //     if (actor && movie) {
    //       await neo4jService.connectNodes(actor.id, movie.id, 'ACTED_IN', { character: role.character });
    //     }
    //   }
  
    //   // Create Director nodes and DIRECTED relationships
    //   const directors = [
    //     { name: 'The Wachowskis', movies: ['The Matrix', 'The Matrix Reloaded'] },
    //     { name: 'Chad Stahelski', movies: ['John Wick'] }
    //   ];
    //   for (const director of directors) {
    //     const directorNode = await neo4jService.addNode('Director', { name: director.name });
    //     for (const movieTitle of director.movies) {
    //       const movie = await neo4jService.findNodeByProperty('Movie', 'title', movieTitle);
    //       if (movie) {
    //         await neo4jService.connectNodes(directorNode.id, movie.id, 'DIRECTED');
    //       }
    //     }
    //   }
  
    // // Perform vector search
    // console.log("\nVector search for 'Sauron':");
    // const searchQuery = "Sauron";
    // const movieResults = await neo4jService.performVectorSearch('movie_index', searchQuery, 1);
    // const actorResults = await neo4jService.performVectorSearch('actor_index', searchQuery, 1);

    // console.log("Most relevant movie:", movieResults[0].node.title);
    // console.log("Most relevant actor:", actorResults[0].node.name);


    // // Perform queries
    // console.log("\n1. Actors who acted in 'The Matrix':");
    // const query1 = `
    //   MATCH (actor:Actor)-[role:ACTED_IN]->(movie:Movie)
    //   WHERE movie.title = 'The Matrix'
    //   RETURN actor.name, role.character
    // `;
    // const result1 = await neo4jService.executeQuery(query1);
    // result1.records.forEach(record => {
    //   console.log(`${record.get('actor.name')} as ${record.get('role.character')}`);
    // });

    // console.log("\n2. Movies Keanu Reeves has acted in:");
    // const query2 = `
    //   MATCH (keanu:Actor {name: 'Keanu Reeves'})-[role:ACTED_IN]->(movie:Movie)
    //   RETURN movie.title, role.character, movie.releaseYear
    //   ORDER BY movie.releaseYear
    // `;
    // const result2 = await neo4jService.executeQuery(query2);
    // result2.records.forEach(record => {
    //   console.log(`${record.get('movie.title')} (${record.get('movie.releaseYear')}) as ${record.get('role.character')}`);
    // });

    // console.log("\n3. Directors who have worked with Keanu Reeves:");
    // const query3 = `
    //   MATCH (keanu:Actor {name: 'Keanu Reeves'})-[:ACTED_IN]->(movie:Movie)<-[:DIRECTED]-(director:Director)
    //   RETURN DISTINCT director.name, collect(movie.title) as movies
    // `;
    // const result3 = await neo4jService.executeQuery(query3);
    // result3.records.forEach(record => {
    //   console.log(`${record.get('director.name')} directed: ${record.get('movies').join(', ')}`);
    // });

    // console.log("\n4. Number of actors for each movie:");
    // const query4 = `
    //   MATCH (actor:Actor)-[:ACTED_IN]->(movie:Movie)
    //   RETURN movie.title, count(actor) as actorCount
    //   ORDER BY actorCount DESC
    // `;
    // const result4 = await neo4jService.executeQuery(query4);
    // result4.records.forEach(record => {
    //   console.log(`${record.get('movie.title')}: ${record.get('actorCount')} actors`);
    // });

    // console.log("\n5. Actors who have worked together in multiple movies:");
    // const query5 = `
    //   MATCH (actor1:Actor)-[:ACTED_IN]->(movie:Movie)<-[:ACTED_IN]-(actor2:Actor)
    //   WHERE actor1.name < actor2.name  // To avoid duplicates
    //   WITH actor1, actor2, collect(movie.title) as movies
    //   WHERE size(movies) > 1
    //   RETURN actor1.name, actor2.name, movies
    // `;
    // const result5 = await neo4jService.executeQuery(query5);
    // result5.records.forEach(record => {
    //   console.log(`${record.get('actor1.name')} and ${record.get('actor2.name')} worked together in: ${record.get('movies').join(', ')}`);
    // });

    // console.log("\n6. Oldest actor in each movie:");
    // const query6 = `
    //   MATCH (actor:Actor)-[:ACTED_IN]->(movie:Movie)
    //   WITH movie, actor
    //   ORDER BY actor.birthYear
    //   WITH movie, collect(actor)[0] as oldestActor
    //   RETURN movie.title, oldestActor.name, oldestActor.birthYear
    // `;
    // const result6 = await neo4jService.executeQuery(query6);
    // result6.records.forEach(record => {
    //   console.log(`${record.get('movie.title')}: ${record.get('oldestActor.name')} (born ${record.get('oldestActor.birthYear')})`);
    // });
  
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await neo4jService.close();
    }
  }
  
  main3();
