const tmi = require('tmi.js');
const fetch = require("node-fetch");
const exps = require("./exp.json");
const fs = require('fs');
const badWords = require("./badwords.json").words;
const regex = new RegExp(badWords.join('|'));
const express = require('express');
const app = express();
const path = require('path');
const commands = require('./commands.json');
const secret = require("./secret.json");

var token;
var opts;

fs.writeFile('expbkup.json', JSON.stringify(exps), (err) =>{
  if(err) throw err;
  console.log("XPS have been backed up!");
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/public/index.html'));
})

app.get('/api/userlevels', (req, res) =>{
  var people = [];
  for(person in exps.people){
    people.push(exps.people[person]);
  }
  people.sort((a,b)=>{
    return a.currentLevel - b.currentLevel;
  }).reverse();

  const json = {
    people
  }

  res.send(json);
});

app.listen(3000);


// Define configuration options
opts = {
  identity: {
    username: secret.twitch.username,
    password: secret.twitch.secret
  },
  channels: [
    secret.twitch.channelname
  ]
};


function createClient(){


  // Create a client with our options
  const client = new tmi.client(opts);

  // Register our event handlers (defined below)
  client.on('message', onMessageHandler);
  client.on('connected', onConnectedHandler);

  // Connect to Twitch:
  client.connect().catch(error =>{
    console.log(error);
  });

  // Called every time a message comes in
  function onMessageHandler (target, context, msg, self) {
    if (self) { return; } // Ignore messages from the bot

    // console.log(badWords);
    if(regex.test(msg)){
      client.deletemessage(target, context.id)
      .then((data) => {
          // data returns [channel]
      }).catch((err) => {
          console.error(err);
      });

    }
    console.log(context);

//    console.log(target);
   // console.log(context);
   // console.log(msg);
//    console.log(self);
    // Remove whitespace from chat message
    // console.log(exps.people[context.username]);
    //Formula: 1 + messageLength/10;
    if(!exps.people[context["user-id"]]){
      console.log("User not in database, adding them!");
      exps.people[context["user-id"]] = {
        "currentXP": 0,
        "currentLevel": 0,
        "username": context["username"]
      }
      // exps.people[context["user-id"]].currentXP = 0;
      // exps.people[context["user-id"]].currentLevel = 0;

    }
    const commandName = msg.trim();
    /*if(commands[commandName]){
      //client.say(target, commands[commandName].say);
      //console.log(commands[commandName].say);
      client.say(target, eval(commands[commandName].say));
      if(commands[commandName].command)
        eval(commands[commandName].command);
    }*/

    // If the command is known, let's execute it
    switch(commandName){
      case "!donate":
        client.say(target, "Donate at streamlabs.com/robotmonkey1000/home ! For more information about current goals use the !goals command.");
        break;
      case "!goals":
        client.say(target, "Monthly Donation Goal: Currently working towards a new mic as mine is breaking. Otherwise donations cover living costs and giveaway costs. This allows me to keep going forward with streaming and giveaways.");
        client.say(target, "Follower Goal: When reached depending on the milestone either a $20 or $60 giveaway.");
        break;
      /*
      case "!helpdsadsadsadsasadsads":
        client.say(target, "~Command~ ~!donate~ Gives information about donating and where to donate. ~!goals~ Gives information about current goals.");
        //
        //client.say(target, "!goals");
        break;
      */
      case "!xp":
        client.say(target, context.username + " is currently level " + exps.people[context["user-id"]].currentLevel + ". The current amount of xp is " + (exps.people[context["user-id"]].currentXP) + ", only " + (((exps.people[context["user-id"]].currentLevel + 1) * 100) - exps.people[context["user-id"]].currentXP) + "XP left to level up.");
        //client.say(target, context.username + " is currently level " + exps.people[context["user-id"]]);
        break;
      case "!discord":
        client.say(target, "Join the discord at: https://discordapp.com/invite/fsW6vgx");
        break;
      default:
        exps.people[context["user-id"]].currentXP += (1 + msg.length/10) * 10;
        //console.log(exps.people[context["user-id"]].currentXP);
        if(exps.people[context["user-id"]].currentXP >= ((exps.people[context["user-id"]].currentLevel + 1) * 100))
        {
          console.log(context.username + " has leveled up!");
          exps.people[context["user-id"]].currentXP = 0;
          exps.people[context["user-id"]].currentLevel++;
          exps.people[context["user-id"]].username = context.username;
          client.say(target, "Congratulations, " + context.username + " has become level " + exps.people[context["user-id"]].currentLevel);
          var json = JSON.stringify(exps);
          fs.writeFile('exp.json', json, (err) =>{
            if(err) throw err;
            console.log("XPS have been saved!");
          });
        }


    }

    // if (commandName === '!dice') {
    //   const num = rollDice();
    //   client.say(target, `You rolled a ${num}`);
    //   console.log(`* Executed ${commandName} command`);
    // } else {
    //   console.log(`* Unknown command ${commandName}`);
    // }
  }

  // Function called when the "dice" command is issued
  function rollDice () {
    const sides = 6;
    return Math.floor(Math.random() * sides) + 1;
  }

  // Called every time the bot connects to Twitch chat
  function onConnectedHandler (addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
  }
}


createClient();
