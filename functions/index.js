'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const {google} = require('googleapis');

const calendarId = 'xxxxxxx@group.calendar.google.com';
const serviceAccount = {"type": "service_account",
  "project_id": "newagent-cesxwn",
  "private_key_id": "xxxxxxxxxxxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\xxxxxxxxxxxxxxxxxxxxxxxx==\n-----END PRIVATE KEY-----\n",
  "client_email": "xxxxxxxxxx@newagent-cesxwn.iam.gserviceaccount.com",
  "client_id": "xxxxxxxxxxxxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/ristorante-bot-calendar%40newagent-cesxwn.iam.gserviceaccount.com"
};

const serviceAccountAuth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: 'https://www.googleapis.com/auth/calendar'
});

const calendar = google.calendar('v3');
 
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

const timeZone = 'Europe/Berlin';
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
 
  function controlloRichiesta(agent) {
    var time = "";
    var saved_time = "";
    if(agent.parameters.time !== ""){
      time = agent.parameters.time.split('T')[1].split(':')[0];
      saved_time = agent.parameters.time;
      if(parseInt(time, 10)<11 && parseInt(time, 10)!==0){
       time = parseInt(time, 10) + 12;
       saved_time = agent.parameters.time.split('T')[0] + "T" + time + ":" + agent.parameters.time.split('T')[1].split(':')[1] + ":" + agent.parameters.time.split('T')[1].split(':')[2]+ ":" + agent.parameters.time.split('T')[1].split(':')[3];
       }
    }
      
    const date = agent.parameters.date.split('T')[0];
    const num_persone = agent.parameters.num_persone;
    const gotDate = convertToDate(date).getDay()!=1 && date!=="";
    const gotTime = ((time>=11 && time<15) || (time>=18 && time<23));
    const gotPer = num_persone>0;
    
    const parameters = {
        saved_date: agent.parameters.date,
        saved_time: saved_time,
        saved_num_persone: agent.parameters.num_persone
    };
        
    if(gotTime && gotDate && gotPer){
        const dateTimeStart = convertTimestampToDate(agent.parameters.date, saved_time);
        // This variable holds the end time of the reservation, which is calculated by adding two hour to the start time.
        const dateTimeEnd = addHours(dateTimeStart, 2);
        const numberOfPeople = agent.parameters.num_persone;
        // The checkAvailabilityCalendar() function checks the availability of seats
        return checkAvailabilityCalendar(agent, dateTimeStart, dateTimeEnd, numberOfPeople).then(() => {
          agent.add(`Desidera confermare la sua prenotazione per il giorno ${date} alle ${time} per ${num_persone} persone?`);
          agent.context.set({
          'name':'richiedi_conferma',
          'lifespan': 1,
          'parameters': parameters,
        });
        }).catch((e) => {
          if(e instanceof RangeError){
          agent.add(`Mi dispiace, ma siamo al completo`); 
          }else{
          agent.add(`handoff to human`);
        }
      });
    } else if(!gotDate){
      	if(convertToDate(date).getDay()==1)
          agent.add(`Mi spiace ma il lunedì siamo chiusi. C'è qualche altro giorno che le andrebbe bene?`);
      	else
      		agent.add(`Per quando voleva prenotare?`);
      agent.context.delete('richiedi_conferma');
      agent.context.set({
        'name':'richiesta_di_prenotazione_data_mancante',
        'lifespan': 1,
        'parameters': parameters,
      });
    } else if(!gotTime){
        if(time==="")
          agent.add(`A che ora?`);
        else
          agent.add(`Le ricordo che siamo aperti dalle 11 alle 15 e dalle 18 alle 23. A che ora vuole prenotare?`);
      	agent.context.delete('richiedi_conferma');
      	agent.context.set({
        'name':'richiesta_di_prenotazione_orario_mancante',
        'lifespan': 1,
        'parameters': parameters,
      });
    } else if(!gotPer){
          agent.add(`Quante persone sarete?`);
          agent.context.delete('richiedi_conferma');
      	agent.context.set({
        'name':'richiesta_di_prenotazione_num_persone_mancante',
        'lifespan': 1,
        'parameters': parameters,
      });
    }
 }
  
 function controlloData(agent){
   const context = agent.context.get('richiesta_di_prenotazione_data_mancante');
   var time = "";
   var saved_time = "";
   if(context.parameters.saved_time !== ""){
      time = context.parameters.saved_time.split('T')[1].split(':')[0];
      saved_time = context.parameters.saved_time;
      if(parseInt(time, 10)<11 && parseInt(time, 10)!==0){
       saved_time = agent.parameters.time.split('T')[0] + "T" + time + ":" + agent.parameters.time.split('T')[1].split(':')[1] + ":" + agent.parameters.time.split('T')[1].split(':')[2]+ ":" + agent.parameters.time.split('T')[1].split(':')[3];
       time = parseInt(time, 10) + 12;
      }
    }
      
    const date = agent.parameters.date.split('T')[0];
    const num_persone = context.parameters.saved_num_persone;
    const gotDate = convertToDate(date).getDay()!=1 && date!=="";
    const gotTime = ((time>=11 && time<15) || (time>=18 && time<23));
    const gotPer = num_persone>0;
    
    const parameters = {
        saved_date: agent.parameters.date,
        saved_time: saved_time,
        saved_num_persone: context.parameters.saved_num_persone
    };
   
       if(gotTime && gotDate && gotPer){
        const dateTimeStart = convertTimestampToDate(agent.parameters.date, saved_time);
        // This variable holds the end time of the reservation, which is calculated by adding two hour to the start time.
        const dateTimeEnd = addHours(dateTimeStart, 2);
        const numberOfPeople = context.parameters.saved_num_persone;
        // The checkAvailabilityCalendar() function checks the availability of seats
        return checkAvailabilityCalendar(agent, dateTimeStart, dateTimeEnd, numberOfPeople).then(() => {
          agent.add(`Desidera confermare la sua prenotazione per il giorno ${date} alle ${time} per ${num_persone} persone?`);
          agent.context.set({
          'name':'richiedi_conferma',
          'lifespan': 1,
          'parameters': parameters,
          });
        }).catch((e) => {
          if(e instanceof RangeError){
          agent.add(`Mi dispiace, ma siamo al completo`); 
          }
          else{
          agent.add(`handoff to human`);
        }
      });
    } else if(!gotDate){
      	if(convertToDate(date).getDay()==1)
          agent.add(`Mi spiace ma il lunedì siamo chiusi. C'è qualche altro giorno che le andrebbe bene?`);
      	else
      		agent.add(`Per quando voleva prenotare?, le ricordo che il lunedì siamo chiusi`);
      agent.context.delete('richiedi_conferma');
      agent.context.set({
        'name':'richiesta_di_prenotazione_data_mancante_2',
        'lifespan': 1,
        'parameters': parameters,
      });
    } else if(!gotTime){
        if(time==="")
          agent.add(`A che ora?`);
        else
          agent.add(`Le ricordo che siamo aperti dalle 11 alle 15 e dalle 18 alle 23. A che ora vuole prenotare?`);
      	agent.context.delete('richiedi_conferma');
      	agent.context.set({
        'name':'richiesta_di_prenotazione_orario_mancante',
        'lifespan': 1,
        'parameters': parameters,
      });
    } else if(!gotPer){
          agent.add(`Quante persone sarete?`);
          agent.context.delete('richiedi_conferma');
      	agent.context.set({
        'name':'richiesta_di_prenotazione_num_persone_mancante',
        'lifespan': 1,
        'parameters': parameters,
      });
    }
 }
  
  function controlloData2(agent){
    const context = agent.context.get('richiesta_di_prenotazione_data_mancante_2');
    var time = "";
    var saved_time = "";
    if(context.parameters.saved_time !== ""){
      time = context.parameters.saved_time.split('T')[1].split(':')[0];
      saved_time = context.parameters.saved_time;
      if(parseInt(time, 10)<11 && parseInt(time, 10)!==0){
        saved_time = agent.parameters.time.split('T')[0] + "T" + time + ":" + agent.parameters.time.split('T')[1].split(':')[1] + ":" + agent.parameters.time.split('T')[1].split(':')[2]+ ":" + agent.parameters.time.split('T')[1].split(':')[3];
        time = parseInt(time, 10) + 12;
      }
    }
      
    const date = agent.parameters.date.split('T')[0];
    const num_persone = context.parameters.saved_num_persone;
    const gotDate = convertToDate(date).getDay()!=1 && date!=="";
    const gotTime = ((time>=11 && time<15) || (time>=18 && time<23));
    const gotPer = num_persone>0;
    
    const parameters = {
        saved_date: agent.parameters.date,
        saved_time: saved_time,
        saved_num_persone: context.parameters.saved_num_persone
    };
   
       if(gotTime && gotDate && gotPer){
        const dateTimeStart = convertTimestampToDate(agent.parameters.date, saved_time);
        // This variable holds the end time of the reservation, which is calculated by adding two hour to the start time.
        const dateTimeEnd = addHours(dateTimeStart, 2);
        const numberOfPeople = context.parameters.saved_num_persone;
        // The checkAvailabilityCalendar() function checks the availability of seats
        return checkAvailabilityCalendar(agent, dateTimeStart, dateTimeEnd, numberOfPeople).then(() => {
          agent.add(`Desidera confermare la sua prenotazione per il giorno ${date} alle ${time} per ${num_persone} persone?`);
          agent.context.set({
          'name':'richiedi_conferma',
          'lifespan': 1,
          'parameters': parameters,
        });
        }).catch((e) => {
          if(e instanceof RangeError){
          agent.add(`Mi dispiace, ma siamo al completo`); //TODO makesuggestion
          }
          else{
          agent.add(`handoff to human`);
        }
      });
    } else if(!gotDate){
      agent.add(`handoff to human:to implement`);
      agent.context.delete('richiedi_conferma');
    } else if(!gotTime){
        if(time==="")
          agent.add(`A che ora?`);
        else
          agent.add(`Le ricordo che siamo aperti dalle 11 alle 15 e dalle 18 alle 23. A che ora vuole prenotare?`);
      	agent.context.delete('richiedi_conferma');
      	agent.context.set({
        'name':'richiesta_di_prenotazione_orario_mancante',
        'lifespan': 1,
        'parameters': parameters,
      });
    } else if(!gotPer){
          agent.add(`Quante persone sarete?`);
          agent.context.delete('richiedi_conferma');
      	  agent.context.set({
            'name':'richiesta_di_prenotazione_num_persone_mancante',
            'lifespan': 1,
            'parameters': parameters,
      });
    }
 }
    function controlloOrario(agent){
      const context = agent.context.get('richiesta_di_prenotazione_orario_mancante');
      var time = "";
      var saved_time = "";
      if(agent.parameters.time !== ""){
        time = agent.parameters.time.split('T')[1].split(':')[0];
        saved_time = agent.parameters.time;
        if(parseInt(time, 10)<11 && parseInt(time, 10)!==0){
         time = parseInt(time, 10) + 12;
         saved_time = agent.parameters.time.split('T')[0] + "T" + time + ":" + agent.parameters.time.split('T')[1].split(':')[1] + ":" + agent.parameters.time.split('T')[1].split(':')[2]+ ":" + agent.parameters.time.split('T')[1].split(':')[3];
        }
      }
      
      	const date = context.parameters.saved_date.split('T')[0];
    	const num_persone = context.parameters.saved_num_persone;
   		const gotTime = ((time>=11 && time<15) || (time>=18 && time<23));
   		const gotPer = num_persone>0;
    
    	const parameters = {
        	saved_date: context.parameters.saved_date,
        	saved_time: saved_time,
        	saved_num_persone: context.parameters.saved_num_persone
   	 		};
     
     if(gotTime && gotPer){
        const dateTimeStart = convertTimestampToDate(context.parameters.saved_date, saved_time);
        // This variable holds the end time of the reservation, which is calculated by adding two hour to the start time.
        const dateTimeEnd = addHours(dateTimeStart, 2);
        const numberOfPeople = context.parameters.saved_num_persone;
        // The checkAvailabilityCalendar() function checks the availability of seats
        return checkAvailabilityCalendar(agent, dateTimeStart, dateTimeEnd, numberOfPeople).then(() => {
          agent.add(`Desidera confermare la sua prenotazione per il giorno ${date} alle ${time} per ${num_persone} persone?`);
          agent.context.set({
          'name':'richiedi_conferma',
          'lifespan': 1,
          'parameters': parameters,
        });
        }).catch((e) => {
          if(e instanceof RangeError){
          agent.add(`Mi dispiace, ma siamo al completo`);
          }
          else{
          agent.add(`handoff to human`);
        }
      });
    }else if(!gotTime){
        if(time==="")
          agent.add(`A che ora?`);
        else
          agent.add(`Le ricordo che siamo aperti dalle 11 alle 15 e dalle 18 alle 23. A che ora vuole prenotare?`);
      	agent.context.delete('richiedi_conferma');
      	agent.context.set({
        'name':'richiesta_di_prenotazione_orario_mancante2',
        'lifespan': 1,
        'parameters': parameters,
      });
    } else if(!gotPer){
          agent.add(`Quante persone sarete?`);
          agent.context.delete('richiedi_conferma');
      	  agent.context.set({
            'name':'richiesta_di_prenotazione_num_persone_mancante',
            'lifespan': 1,
            'parameters': parameters,
      });
    }
  }
  
  function controlloOrario2(agent){
    const context = agent.context.get('richiesta_di_prenotazione_orario_mancante2');
      var time = "";
      var saved_time = "";
      if(agent.parameters.time !== ""){
        time = agent.parameters.time.split('T')[1].split(':')[0];
        saved_time = agent.parameters.time;
        if(parseInt(time, 10)<11 && parseInt(time, 10)!==0){
         time = parseInt(time, 10) + 12;
         saved_time = agent.parameters.time.split('T')[0] + "T" + time + ":" + agent.parameters.time.split('T')[1].split(':')[1] + ":" + agent.parameters.time.split('T')[1].split(':')[2]+ ":" + agent.parameters.time.split('T')[1].split(':')[3];
        }
      }
      
      	const date = context.parameters.saved_date.split('T')[0];
    	const num_persone = context.parameters.saved_num_persone;
   		const gotTime = ((time>=11 && time<15) || (time>=18 && time<23));
   		const gotPer = num_persone>0;
    
    	const parameters = {
        	saved_date: context.parameters.saved_date,
        	saved_time: saved_time,
        	saved_num_persone: context.parameters.saved_num_persone
   	 		};
     
     if(gotTime && gotPer){
        const dateTimeStart = convertTimestampToDate(context.parameters.saved_date, saved_time);
        // This variable holds the end time of the reservation, which is calculated by adding two hour to the start time.
        const dateTimeEnd = addHours(dateTimeStart, 2);
        const numberOfPeople = context.parameters.saved_num_persone;
        // The checkAvailabilityCalendar() function checks the availability of seats
        return checkAvailabilityCalendar(agent, dateTimeStart, dateTimeEnd, numberOfPeople).then(() => {
          agent.add(`Desidera confermare la sua prenotazione per il giorno ${date} alle ${time} per ${num_persone} persone?`);
          agent.context.set({
          'name':'richiedi_conferma',
          'lifespan': 1,
          'parameters': parameters,
        });
        }).catch((e) => {
          if(e instanceof RangeError){
          agent.add(`Mi dispiace, ma siamo al completo`);
          }
          else{
          agent.add(`handoff to human`);
        }
      });
    }else if(!gotTime){
        agent.add(`handoff to human`);
      	agent.context.delete('richiedi_conferma');
    } else if(!gotPer){
          agent.add(`Quante persone sarete?`);
          agent.context.delete('richiedi_conferma');
      	  agent.context.set({
            'name':'richiesta_di_prenotazione_num_persone_mancante',
            'lifespan': 1,
            'parameters': parameters,
      });
    }
  }
  
  function controlloNumero(agent){
    	const context = agent.context.get('richiesta_di_prenotazione_num_persone_mancante');
     
      	const time = context.parameters.saved_time.split('T')[1].split(':')[0];
       	const date = context.parameters.saved_date.split('T')[0];
    	const num_persone = agent.parameters.num_persone;
   		const gotPer = num_persone>0;
    
    	const parameters = {
        	saved_date: context.parameters.saved_date,
        	saved_time: context.parameters.saved_time,
        	saved_num_persone: agent.parameters.num_persone
   	 		};

       if(gotPer){
        const dateTimeStart = convertTimestampToDate(context.parameters.saved_date, context.parameters.saved_time);
        // This variable holds the end time of the reservation, which is calculated by adding two hour to the start time.
        const dateTimeEnd = addHours(dateTimeStart, 2);
        const numberOfPeople = agent.parameters.num_persone;
        // The checkAvailabilityCalendar() function checks the availability of seats
        return checkAvailabilityCalendar(agent, dateTimeStart, dateTimeEnd, numberOfPeople).then(() => {
          agent.add(`Desidera confermare la sua prenotazione per il giorno ${date} alle ${time} per ${num_persone} persone?`);
          agent.context.set({
          'name':'richiedi_conferma',
          'lifespan': 1,
          'parameters': parameters,
        });
        }).catch((e) => {
          if(e instanceof RangeError){
          agent.add(`Mi dispiace, ma siamo al completo`);
          }
          else{
          agent.add(`handoff to human`);
        }
      });
      } else if(!gotPer){
            agent.add(`Non sono sicuro di aver capito, potresti ridirmi quante persone sarete?`);
            agent.context.delete('richiedi_conferma');
            agent.context.set({
              'name':'richiesta_di_prenotazione_num_persone_mancante2',
              'lifespan': 1,
              'parameters': parameters,
        });
      }
    }
  
  function controlloNumero2(agent){
    const context = agent.context.get('richiesta_di_prenotazione_num_persone_mancante2');
     
      	const time = context.parameters.saved_time.split('T')[1].split(':')[0];
       	const date = context.parameters.saved_date.split('T')[0];
    	const num_persone = agent.parameters.num_persone;
   		const gotPer = num_persone>0;
    
    	const parameters = {
        	saved_date: context.parameters.saved_date,
        	saved_time: context.parameters.saved_time,
        	saved_num_persone: agent.parameters.num_persone
   	 		};

       if(gotPer){
        const dateTimeStart = convertTimestampToDate(context.parameters.saved_date, context.parameters.saved_time);
        // This variable holds the end time of the reservation, which is calculated by adding two hour to the start time.
        const dateTimeEnd = addHours(dateTimeStart, 2);
        const numberOfPeople = agent.parameters.num_persone;
        // The checkAvailabilityCalendar() function checks the availability of seats
        return checkAvailabilityCalendar(agent, dateTimeStart, dateTimeEnd, numberOfPeople).then(() => {
          agent.add(`Desidera confermare la sua prenotazione per il giorno ${date} alle ${time} per ${num_persone} persone?`);
          agent.context.set({
          'name':'richiedi_conferma',
          'lifespan': 1,
          'parameters': parameters,
        });
        }).catch((e) => {
          if(e instanceof RangeError){
          agent.add(`Mi dispiace, ma siamo al completo`);
          }
          else{
          agent.add(`handoff to human`);
        }
      });
      } else if(!gotPer){
            agent.add(`handoff to human`);
            agent.context.delete('richiedi_conferma');
      }
  }
  
  function confermaPrenotazione(agent){
    const context = agent.context.get('richiedi_conferma');
    const time = context.parameters.saved_time;
    const date = context.parameters.saved_date;
    const num_persone = context.parameters.saved_num_persone;
    const dateTimeStart = convertTimestampToDate(date, time);
    // This variable holds the end time of the appointment, which is calculated by adding two hour to the start time.
    const dateTimeEnd = addHours(dateTimeStart, 2);
    return createCalendarEvent(agent, dateTimeStart, dateTimeEnd, num_persone).then(() => {
      agent.add(`La sua prenotazione è confermata`);
    }).catch((e) => {
      if(e instanceof RangeError){
      agent.add(`Siamo al completo`);
      }
      else{
      agent.add(`handoff to human`);
    }
    });
  }
  
  function fallbackData(agent){
      const context = agent.context.get('richiesta_di_prenotazione_data_mancante');
      const parameters = {
        saved_date: context.parameters.saved_date,
        saved_time: context.parameters.saved_time,
        saved_num_persone: context.parameters.saved_num_persone
    };
    
    agent.context.set({
              'name':'richiesta_di_prenotazione_data_mancante_2',
              'lifespan': 1,
              'parameters': parameters,
        });
    
    agent.add(`Non penso di aver capito, potrebbe ridirmi il giorno in cui voleva prenotare?, le ricordo che il lunedì siamo chiusi.`);
  }
  
    function fallbackOrario(agent){
      const context = agent.context.get('richiesta_di_prenotazione_orario_mancante');
      const parameters = {
        saved_date: context.parameters.saved_date,
        saved_time: context.parameters.saved_time,
        saved_num_persone: context.parameters.saved_num_persone
    };
    
    agent.context.set({
              'name':'richiesta_di_prenotazione_orario_mancante2',
              'lifespan': 1,
              'parameters': parameters,
        });
    
    agent.add(`Mi scusi ma non ho capito, potrebbe ridirmi l'ora per cui intende prenotare. Le ricordo che siamo aperti dalle 11 alle 15 per pranzo e dalle 18 alle 23 per cena`);
  }
  
   function fallbackNumero(agent){
      const context = agent.context.get('richiesta_di_prenotazione_num_persone_mancante');
      const parameters = {
        saved_date: context.parameters.saved_date,
        saved_time: context.parameters.saved_time,
        saved_num_persone: context.parameters.saved_num_persone
    };
    
    agent.context.set({
              'name':'richiesta_di_prenotazione_num_persone_mancante2',
              'lifespan': 1,
              'parameters': parameters,
        });
    
    agent.add(`Non sono sicuro di aver capito, potrebbe ridirmi in quanti sarete?`);
  }
  
  let intentMap = new Map();
  intentMap.set('Richiesta di prenotazione', controlloRichiesta);
  intentMap.set('Provvede Data', controlloData);
  intentMap.set('Provvede Data 2', controlloData2);
  intentMap.set('Provvede Orario', controlloOrario);
  intentMap.set('Provvede Orario 2', controlloOrario2);
  intentMap.set('Provvede Numero Persone', controlloNumero);
  intentMap.set('Provvede Numero Persone 2', controlloNumero2);
  intentMap.set('Provvede Data - fallback', fallbackData);
  intentMap.set('Provvede Orario - fallback', fallbackOrario);
  intentMap.set('Provvede Numero Persone - fallback', fallbackNumero);
  intentMap.set('Prenotazione Confermata', confermaPrenotazione);
  agent.handleRequest(intentMap);
    
});




function checkAvailabilityCalendar(agent, dateTimeStart, dateTimeEnd, numberOfPeople) {
  return new Promise((resolve, reject) => {
    calendar.events.list({
      auth: serviceAccountAuth, // List events for time period
      calendarId: calendarId,
      timeMin: dateTimeStart.toISOString(),
      timeMax: dateTimeEnd.toISOString()
    }, (err, calendarResponse) => {
      // Check if there is a table available
      if (err || checkAvailability(agent, calendarResponse, numberOfPeople)) {
        reject(err || new RangeError('numberOfPeople>50'));  //50 is the max available seats
      } else {
            resolve(calendarResponse);        
         }
    });
 });
}


function createCalendarEvent (agent, dateTimeStart, dateTimeEnd, numberOfPeople) {
  return new Promise((resolve, reject) => {
    calendar.events.list({
      auth: serviceAccountAuth, // List events for time period
      calendarId: calendarId,
      timeMin: dateTimeStart.toISOString(),
      timeMax: dateTimeEnd.toISOString()
    }, (err, calendarResponse) => {
      // Check if there is a table available
      if (err || checkAvailability(agent, calendarResponse, numberOfPeople)) {
        reject(err || new RangeError('numberOfPeople>50'));  //50 is the max available seats
      } else {
        // Create event for the requested time period
          calendar.events.insert({ auth: serviceAccountAuth,
            calendarId: calendarId,
            resource: {summary: 'Prenotazione Ristorante',
              start: {dateTime: dateTimeStart},
              end: {dateTime: dateTimeEnd},
              extendedProperties: {private:{numberOfPeople: numberOfPeople.toString() + ''}}}
          }, (err, event) => {
            if(err){
              reject(err);
            }
            else{
              resolve(event);
            }
          }
          );
        }
    });
  });
}

function checkAvailability(agent, calendarResponse, numberOfPeople){
        var sum = parseInt(numberOfPeople);
        for(var i=0; i<calendarResponse.data.items.length; i++){
           sum += parseInt(calendarResponse.data.items[i].extendedProperties.private["numberOfPeople"]);
        }
        if(sum<=50){
          return 0;
        }
        else{
          return 1;
        }
}

function addHours(dateObj, hoursToAdd){
  return new Date(new Date(dateObj).setHours(dateObj.getHours() + hoursToAdd));
}

function convertToDate(date){
  return new Date(Date.parse(date));
}

// A helper function that receives Dialogflow's 'date' and 'time' parameters and creates a Date instance.
function convertTimestampToDate(date, time){
  // Parse the date, time, and time zone offset values from the input parameters and create a new Date object
  return new Date(Date.parse(date.split('T')[0] + 'T' + time.split('T')[1].split('+')[0] + '+' + time.split('T')[1].split('+')[1]));  //works with gmt+ not with gmt-
}
