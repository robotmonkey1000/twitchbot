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
const crypto = require('crypto');
const logins = require('./logins.json');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const port = 1000;

var token;
var opts;

fs.writeFile('expbkup.json', JSON.stringify(exps), (err) =>{
  if(err) throw err;
  console.log("XPS have been backed up!");
});

fs.writeFile('commandsbkup.json', JSON.stringify(commands), (err) =>{
  if(err) throw err;
  console.log("Commands have been backed up!");
});

app.use(express.urlencoded({ extended: false }));
//app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/public/commands/commands.html'));
});


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

app.get('/api/commands/get', (req, res) =>{
  res.send(commands);
});

function encrypt(text){
  console.log(text);
  return text;
}

function verify(username, password){
  for(let user of logins.logins){
      console.log("Checking");
      //console.log(user.userName, user.password);
      if((encrypt(username) == user.userName) && (encrypt(password) == user.password)){
        return true;
      }
    }
    return false;
}
app.post('/api/commands/add', (req, res) =>{

  if(!req.body.commandName || !req.body.userName || !req.body.password) {
    res.sendFile(path.join(__dirname + '/public/commands/commands.html'));
    return;
  }
  console.log(verify(req.body.userName, req.body.password));
  //console.log(req.body.userName, req.body.password);

  commands[req.body.commandName] = {
    "say": req.body.chatMessage,
    "command": req.body.serverCommand
  }
  if(commands[req.body.commandName] && req.body.chatMessage == "" && req.body.serverCommand == ""){
    delete commands[req.body.commandName];
  }
  fs.writeFile('commands.json', JSON.stringify(commands), (err) =>{
    if(err) throw err;
    console.log("Commands have been saved!");
  });
  //console.log(req.body);
  res.sendFile(path.join(__dirname + '/public/commands/commands.html'));
});

app.get('/widget/:widgetId', (req, res) =>{
  //console.log("YEET");
  console.log(req.params);
    //res.sendFile(path.join(__dirname + '/public/widget/' + req.params.widgetId + '/index.css'));
    res.sendFile(path.join(__dirname + '/public/widget/' + req.params.widgetId + '/index.html'));
});

app.use(express.static('public'))

//app.listen(3000);


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

  var userSwearCount = {
    "people":{

    }
  };

var pendingDuels = [];
  // Called every time a message comes in
function deleteDuel(duel){
    for(var _duel in pendingDuels)
    {
      if(pendingDuels[_duel] == duel)
      {
        //console.log(pendingDuels);
        pendingDuels.splice(_duel, 1);
        //console.log(pendingDuels);
        return;
      }
    }
    //console.log(pendingDuels, "\n");
    //console.log("No Duel Found\n", duel);
  }
  function onMessageHandler (target, context, msg, self) {
    if (self) { return; } // Ignore messages from the bot

    if(context.badges)
    {
      if(context.badges.vip)
      {
        if(userSwearCount.people[context.username]){
          if(regex.test(msg.toLowerCase())){
            userSwearCount.people[context.username].swearCount++;
            console.log("Vip is swearing!");
          }
        }else {
          userSwearCount.people[context.username] = {}
          userSwearCount.people[context.username].swearCount = 0;

        }
      }
    }
    // console.log(badWords);
    if(context.badges){
      if(context.badges.vip){
        if(userSwearCount.people[context.username].swearCount > 5)
        {
          if(regex.test(msg.toLowerCase())){
            client.deletemessage(target, context.id)
            .then((data) => {
                // data returns [channel]
            }).catch((err) => {
                console.error(err);
            });
          }
        }else{

        }
      }else {
        if(regex.test(msg.toLowerCase())){
          client.deletemessage(target, context.id)
          .then((data) => {
              // data returns [channel]
          }).catch((err) => {
              console.error(err);
          });
        }
      }
    }else {
      if(regex.test(msg.toLowerCase())){
        client.deletemessage(target, context.id)
        .then((data) => {
            // data returns [channel]
        }).catch((err) => {
            console.error(err);
        });
      }
    }

    //console.log(context);

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
    //Trimming the spaces in the message to get the command. This currently only allows commands without arguments
    var commandName = msg.trim().toLowerCase();
    commandName = commandName.split(' ');
    //console.log(commandName);

    //Checks the commands file to see if it has that specified command in it.
    if(commands[commandName[0]]){
      //client.say(target, commands[commandName].say);
      //console.log(commands[commandName].say);

      //the bot then says the response from the file, currently using the EVAL function but is terrible due to possible execution of unwanted code. Gonna fix this probably in next big update.
      client.say(target, eval(commands[commandName[0]].say));
      //If the command needs something executed by the bot (something like console.logs or adjusting settings) it uses the command property and executes it
      if(commands[commandName[0]].command)
        eval(commands[commandName[0]].command);
    }
//"say": "context.username + \" is currently level \" + exps.people[context[\"user-id\"]].currentLevel + \". The current amount of xp is \" + (exps.people[context[\"user-id\"]].currentXP) + \", only \" + (((exps.people[context[\"user-id\"]].currentLevel + 1) * 100) - exps.people[context[\"user-id\"]].currentXP) + \"XP left to level up.\"",

//Shoutout
//Discord Rank
//Join discord
//Play game with me

    // If the command is known and not in the file, let's execute it
    switch(commandName[0]){
      case '!duel':
        if(!commandName[1] || !commandName[2] || isNaN(commandName[2]) || commandName[1] == context.username)
        {
          return client.say(target, "Use !duel like \"!duel user maxLevels\". You also can't duel your self silly incase you tried!");
        }

        if(commandName[2] > exps.people[context["user-id"]].currentLevel)
        {
          return client.say(target, "You cannot duel with more levels then you have!");
        }
        var duel = {
          'starter': context.username,
          'other': commandName[1],
          'maxAmount': commandName[2]
        };
        pendingDuels.push(duel);
        setTimeout(deleteDuel, 45000, duel);
        //console.log(pendingDuels);
        client.say(target, `Hey @${commandName[1]}! You are asked to a duel with a bounty of upto ${commandName[2]}! Use \"!duelaccept ${context.username}\" to accept their duel!`);
        break;
      case '!duelaccept':
        //console.log(pendingDuels)
        for(var duel of pendingDuels)
        {
          //console.log(duel);
          if(duel.other == context.username && duel.starter == commandName[1])
          {
            client.say(target, `Duel Commencing!`);
            var starting = Math.floor(Math.random() * 2);
            var firstUserHitCount = 0;
            var secondUserHitCount = 0;
            var firstHit = 0;
            var secondHit = 0;
            var counter = 1;
            while( firstUserHitCount < 4 && secondUserHitCount < 4)
            {
              if(counter % 2 != 0)
              {
                firstHit = Math.floor(Math.random() * 4);
                if(firstHit != 0)
                {
                    firstUserHitCount++;
                }
              }
              else
              {
                secondHit = Math.floor(Math.random() * 4);
                if(secondHit != 0)
                {
                  secondUserHitCount++;
                }
              }
              counter++;
            }
            var levelAmount = Math.floor(Math.random() * parseInt(duel.maxAmount) + 1);
            //console.log(levelAmount);
            if(firstUserHitCount > 4)
            {
              if(starting == 1)
              {
                client.say(target, `${context.username} has won the duel! They gained ${levelAmount} levels!`);
                editLevel(context.username, levelAmount);
                editLevel(duel.starter, (-levelAmount));
              }
              else
              {
                client.say(target, `${duel.starter} has won the duel! They gained ${levelAmount} levels!`);
                editLevel(context.username, (-levelAmount));
                editLevel(duel.starter, levelAmount);
              }

            }else
            {
              if(starting == 1)
              {
                  client.say(target, `${duel.starter} has won the duel! They gained ${levelAmount} levels!`);
                  editLevel(context.username, (-levelAmount));
                  editLevel(duel.starter, levelAmount);
              }else
              {
                client.say(target, `${context.username} has won the duel! They gained ${levelAmount} levels!`);
                editLevel(context.username, levelAmount);
                editLevel(duel.starter, (-levelAmount));
              }
            }
            deleteDuel(duel);
            return;
            //console.log("A Duel Has Been Found");
          }
        }
        client.say(target, `No duel was found against user ${commandName[1]}.`);
        break;
      case "!goals":
        client.say(target, "Monthly Donation Goal: Currently working towards a new keyboard and mouse, as well as new PC parts!. Otherwise donations cover living costs and giveaway costs. This allows me to keep going forward with streaming and giveaways.");
        client.say(target, "Follower Goal: When reached depending on the milestone either a $20 or $60 giveaway.");
        break;
      case "!link":
        //link discord username to twitch account
        io.emit("tEvent", "something")
        break;
      case "!editlevel":
        if(commandName[1] && !isNaN(parseInt(commandName[2])) && context.mod)
        {
          //console.log("editing Level");
          if(commandName[1] == context.username){return;}
          editLevel(commandName[1], parseInt(commandName[2]));
        }
        break;
      default:

        //This is the base XP rate;
        var levelRate = 1;
        //This checks to see if the current messager has any badges (mod, vip, broadcaster, etc)
        if(context.badges)
        {
          var subReg = /(\w+\/\d+)/
          if(context['badge-info'])
            var info = context['badge-info'].split(subReg)
          //console.log();
          //console.log(context["badge-info"]);
          //If its the broadcaster messaging we dont want to level them up.
          if(context.badges.broadcaster) {return;}

          //Create a blocked list so people cannot level up
          if(context.username == "amoderat0r") {return;}

          // the user is a sub. The rate a sub gains xp is based on how long they have been subbing and then +2 so at one month it is (0 + 2 = 2) + 1 (which is the base rate)                                                                                                                      months + customRate + baseRate
          if(context.badges.subscriber)
          {
            var replaceSub = /(\w+\/)/g
            //console.log("A Sub has talked!");
            for(var data in info)
            {
              if(info[data].includes('subscriber')){
                console.log("foundMatch");
                info[data] = info[data].replace(replaceSub, '');
                console.log(context.username + ': ' + info[data]);
                //console.log(info[data]);
                //console.log(parseInt(info[data]));
                if(!isNaN(parseInt(info[data])))
                {
                  levelRate += parseInt(info[data]);
                }
                break;
              }
            }
            //levelRate += (parseInt(context.badges.subscriber) + 2);
            //console.log(context["username"] + ":" + context.badges.subscriber); //See what the number is;
            //exps.people[context["user-id"]].currentXP += ((parseInt(context.badges.subscriber) + 2) + msg.length/10) * 10;
          }
          // the user is a vip. VIP's get a rate of +1
          if(context.badges.vip)
          {
            levelRate += 1;
            console.log("Hey VIP talked! LevelRate: " + levelRate);
          }

        }
        console.log(context.username + " has a level rate of " + levelRate);
        exps.people[context["user-id"]].currentXP += (levelRate + msg.length/10) * 10;

        //console.log(exps.people[context["user-id"]].currentXP);
        if(exps.people[context["user-id"]].currentXP >= ((exps.people[context["user-id"]].currentLevel + 1) * 100))
        {
          console.log(context.username + " has leveled up!");
          exps.people[context["user-id"]].currentXP -= (exps.people[context["user-id"]].currentLevel + 1) * 100;
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
  function socialMedia(){
    client.say("robotmonkey1000", "Hey! Just a reminder to check out my instagram and twitter where I post about stream stuff and my life. Also Join the discord and meet some peeps and you can also talk with me! Use !twitter, !instagram, or !discord");
  }

  // Called every time the bot connects to Twitch chat
  function onConnectedHandler (addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
    setInterval(socialMedia, 2700000);
  }
}



function editLevel(username, amount)
{
  //console.log('yeet');
  for(var person in exps.people)
  {
    if(exps.people[person].username == username)
    {
      exps.people[person].currentLevel += amount;
      if(exps.people[person].currentLevel < 0)
      {
        exps.people[person].currentLevel = 0;
      }
      return;
    }
  }
}

http.listen(4000, function(){
  console.log('listening on *:4000');
});
io.on('connection', function(socket){
  console.log("A connection has been made");
});
createClient();
