# RistoranteBotDialogflow

To run the bot in Dialogflow:

1) Clone the repo
2) Create a new Dialogflow agent
3) Import the zip on Dialogflow
4) Copy functions/index.js and functions/package.json in the fulfillment section of Dialogflow 
5) In the index.js you have to insert your calendarID and your serviceAccount, you can do it following this guide:
https://dialogflow.com/docs/tutorial-build-an-agent/create-fulfillment-using-webhook


The bot is not ready to understand everything, but it should be ready to understand a typical conversation like this:


```
- Ciao

        Ciao, vuoi sapere gli orari di apertura oppure vuoi prenotare un tavolo?
        
        
- vorrei sapere gli orari di apertura
       
         Siamo aperti dal martedì alla domenica, per pranzo dalle 11:00 alle 15:00, per cena dalle 18:00 alle 23:00.


- vorrei effettuare una prenotazione
          
          Per quando voleva prenotare?
         
 - per martedi
          
          A che ora?
 
 - alle 9 di sera
 
          Quante persone sarete?
 
 - 4
          Desidera confermare la sua prenotazione per il giorno 2019-06-25 alle 21 per 4 persone?
 
 - sì 
          La sua prenotazione è confermata 
        
  -grazie, a presto
  
         Ciao, a presto.       
```
